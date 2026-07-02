#!/usr/bin/env bash
set -Eeuo pipefail

# ============================================================
# P1 API 性能测试 / 压力测试脚本
# 工具: oha
#
# 输出格式与 P0 脚本保持一致:
#   oha-results/<RUN_TAG>/
#     ├── raw/                 # oha 原始 JSON
#     ├── cases/               # metadata + oha 包装 JSON
#     ├── manifest.jsonl       # 每次测试一行
#     └── all_results.json     # 所有 cases 合并后的 JSON 数组
#
# 认证方式:
#   1. AUTH_TOKEN=xxx ./run_p1_oha.sh
#   2. LOGIN_ACCOUNT=xxx LOGIN_PASSWORD=xxx ./run_p1_oha.sh
# ============================================================

BASE_URL="${BASE_URL:-http://localhost:5173}"
OUT_ROOT="${OUT_ROOT:-./oha-results}"
RUN_TAG="${RUN_TAG:-p1-$(date +%Y%m%d-%H%M%S)}"

PERF_DURATION="${PERF_DURATION:-30s}"
STRESS_DURATION="${STRESS_DURATION:-60s}"
WARMUP_DURATION="${WARMUP_DURATION:-5s}"
WARMUP_CONCURRENCY="${WARMUP_CONCURRENCY:-5}"

# 性能测试：温和基线
PERF_CONCURRENCIES="${PERF_CONCURRENCIES:-10 50}"

# 压力测试：逐步加压
STRESS_CONCURRENCIES="${STRESS_CONCURRENCIES:-100 200 400}"

# 每个场景重复次数
REPEAT="${REPEAT:-1}"

# 请求超时
TIMEOUT="${TIMEOUT:-10s}"

# 每次 oha 之间的冷却间隔
SLEEP_BETWEEN="${SLEEP_BETWEEN:-2}"

# 预检接口是否 2xx；非 2xx 默认跳过，避免把 401/404/500 误算入性能数据
PRECHECK="${PRECHECK:-1}"
SKIP_FAILED_PRECHECK="${SKIP_FAILED_PRECHECK:-1}"

# 预检遇到 429 时通常是上一个压测场景触发了服务端限流。
# 默认等待并重试，避免把限流恢复窗口误判为接口或变量错误。
PRECHECK_RETRIES="${PRECHECK_RETRIES:-6}"
PRECHECK_RETRY_SLEEP="${PRECHECK_RETRY_SLEEP:-10}"

# 是否关闭 keep-alive；默认不关闭，更适合测服务端吞吐
DISABLE_KEEPALIVE="${DISABLE_KEEPALIVE:-0}"

# oha 额外参数，例如:
#   OHA_EXTRA_ARGS="--insecure"
#   OHA_EXTRA_ARGS="--http2"
OHA_EXTRA_ARGS="${OHA_EXTRA_ARGS:-}"

# P1 动态资源 ID，可手工覆盖
ASSISTANT_CONVERSATION_ID="${ASSISTANT_CONVERSATION_ID:-}"
DOCTOR_ID="${DOCTOR_ID:-}"
DOCTOR_CONVERSATION_ID="${DOCTOR_CONVERSATION_ID:-}"

# 如果某些动态资源不存在，是否跳过对应详情接口
SKIP_MISSING_DYNAMIC_ENDPOINTS="${SKIP_MISSING_DYNAMIC_ENDPOINTS:-1}"

OUT_DIR="${OUT_ROOT}/${RUN_TAG}"
RAW_DIR="${OUT_DIR}/raw"
CASE_DIR="${OUT_DIR}/cases"
MANIFEST_FILE="${OUT_DIR}/manifest.jsonl"
ALL_RESULTS_FILE="${OUT_DIR}/all_results.json"

mkdir -p "${RAW_DIR}" "${CASE_DIR}"
: > "${MANIFEST_FILE}"

need_cmd() {
  local cmd="$1"
  if ! command -v "${cmd}" >/dev/null 2>&1; then
    echo "ERROR: missing command: ${cmd}" >&2
    exit 1
  fi
}

need_cmd oha
need_cmd jq
need_cmd curl

ulimit -n 65535 >/dev/null 2>&1 || true

BASE_URL="${BASE_URL%/}"

read -r -a PERF_CONCS <<< "${PERF_CONCURRENCIES}"
read -r -a STRESS_CONCS <<< "${STRESS_CONCURRENCIES}"
# shellcheck disable=SC2206
EXTRA_ARGS=( ${OHA_EXTRA_ARGS} )

slugify() {
  printf "%s" "$1" \
    | tr '/:?&= ' '_______' \
    | tr -cd '[:alnum:]_.-'
}

oha_supports_flag() {
  local flag="$1"
  oha --help 2>/dev/null | grep -q -- "${flag}"
}

build_oha_common_args() {
  local -n out_ref="$1"
  local method="$2"
  local concurrency="$3"
  local duration="$4"

  out_ref=(
    oha
    --no-tui
    --output-format json
    -t "${TIMEOUT}"
    -m "${method}"
    -c "${concurrency}"
    -z "${duration}"
    -H "Accept: application/json"
    -H "Authorization: Bearer ${AUTH_TOKEN}"
  )

  if oha_supports_flag "--stats-success-breakdown"; then
    out_ref+=(--stats-success-breakdown)
  fi

  if [[ "${DISABLE_KEEPALIVE}" == "1" ]]; then
    out_ref+=(--disable-keepalive)
  fi

  out_ref+=("${EXTRA_ARGS[@]}")
}

login_and_get_token() {
  if [[ -n "${AUTH_TOKEN:-}" ]]; then
    return 0
  fi

  if [[ -z "${LOGIN_ACCOUNT:-}" || -z "${LOGIN_PASSWORD:-}" ]]; then
    echo "ERROR: P1 接口需要认证。请设置 AUTH_TOKEN，或设置 LOGIN_ACCOUNT + LOGIN_PASSWORD。" >&2
    echo "示例:" >&2
    echo "  AUTH_TOKEN='xxx' ./run_p1_oha.sh" >&2
    echo "  LOGIN_ACCOUNT='test' LOGIN_PASSWORD='123456' ./run_p1_oha.sh" >&2
    exit 1
  fi

  echo "LOGIN: acquiring token from ${BASE_URL}/api/auth/login"

  local login_json
  login_json="$(
    curl -fsS \
      -X POST \
      -H "Content-Type: application/json" \
      -H "Accept: application/json" \
      -d "$(jq -nc --arg account "${LOGIN_ACCOUNT}" --arg password "${LOGIN_PASSWORD}" '{account:$account,password:$password}')" \
      "${BASE_URL}/api/auth/login"
  )"

  AUTH_TOKEN="$(jq -r '.data.token // empty' <<< "${login_json}")"

  if [[ -z "${AUTH_TOKEN}" || "${AUTH_TOKEN}" == "null" ]]; then
    echo "ERROR: 登录成功响应中没有找到 .data.token。" >&2
    echo "${login_json}" >&2
    exit 1
  fi
}

auth_get_json() {
  local path="$1"
  curl -fsS \
    -H "Accept: application/json" \
    -H "Authorization: Bearer ${AUTH_TOKEN}" \
    "${BASE_URL}${path}" 2>/dev/null || true
}

public_get_json() {
  local path="$1"
  curl -fsS \
    -H "Accept: application/json" \
    "${BASE_URL}${path}" 2>/dev/null || true
}

extract_first_id() {
  jq -r '
    (try .data.items[0].id catch null) //
    (try .data.list[0].id catch null) //
    (try .data.records[0].id catch null) //
    (try .data.rows[0].id catch null) //
    (try .data[0].id catch null) //
    empty
  ' 2>/dev/null || true
}

auth_get_code() {
  local path="$1"
  curl -sS -o /dev/null -w "%{http_code}" \
    -H "Accept: application/json" \
    -H "Authorization: Bearer ${AUTH_TOKEN}" \
    "${BASE_URL}${path}" 2>/dev/null || true
}

discover_dynamic_ids() {
  local json

  if [[ -z "${DOCTOR_ID}" ]]; then
    json="$(public_get_json "/api/doctors?page=1&pageSize=1")"
    DOCTOR_ID="$(extract_first_id <<< "${json}")"
  fi

  if [[ -z "${DOCTOR_ID}" ]]; then
    DOCTOR_ID="1"
  fi

  if [[ -z "${ASSISTANT_CONVERSATION_ID}" ]]; then
    json="$(auth_get_json "/api/assistant/conversations")"
    ASSISTANT_CONVERSATION_ID="$(extract_first_id <<< "${json}")"
  fi

  if [[ -z "${DOCTOR_CONVERSATION_ID}" ]]; then
    json="$(auth_get_json "/api/doctors/${DOCTOR_ID}/conversations")"
    DOCTOR_CONVERSATION_ID="$(extract_first_id <<< "${json}")"
  fi
}

validate_dynamic_ids() {
  local code

  if [[ -n "${ASSISTANT_CONVERSATION_ID}" ]]; then
    code="$(auth_get_code "/api/assistant/conversations/${ASSISTANT_CONVERSATION_ID}/messages")"
    if [[ ! "${code}" =~ ^2[0-9][0-9]$ ]]; then
      echo "WARN: ASSISTANT_CONVERSATION_ID=${ASSISTANT_CONVERSATION_ID} is not usable, http_code=${code}" >&2
      if [[ "${SKIP_MISSING_DYNAMIC_ENDPOINTS}" == "1" ]]; then
        ASSISTANT_CONVERSATION_ID=""
      fi
    fi
  fi

  if [[ -n "${DOCTOR_CONVERSATION_ID}" ]]; then
    code="$(auth_get_code "/api/doctors/${DOCTOR_ID}/conversations/${DOCTOR_CONVERSATION_ID}/messages")"
    if [[ ! "${code}" =~ ^2[0-9][0-9]$ ]]; then
      echo "WARN: DOCTOR_CONVERSATION_ID=${DOCTOR_CONVERSATION_ID} for DOCTOR_ID=${DOCTOR_ID} is not usable, http_code=${code}" >&2
      if [[ "${SKIP_MISSING_DYNAMIC_ENDPOINTS}" == "1" ]]; then
        DOCTOR_CONVERSATION_ID=""
      fi
    fi
  fi
}

declare -a ENDPOINTS=()

add_endpoint() {
  local name="$1"
  local method="$2"
  local path="$3"
  ENDPOINTS+=("${name}|${method}|${path}")
}

build_endpoints() {
  add_endpoint "auth_me" "GET" "/api/auth/me"
  add_endpoint "profile_get" "GET" "/api/profile"
  add_endpoint "privacy_settings_get" "GET" "/api/privacy-settings"
  add_endpoint "data_authorizations_get" "GET" "/api/data-authorizations"
  add_endpoint "data_authorizations_history" "GET" "/api/data-authorizations/history?page=1&pageSize=10"
  add_endpoint "risk_latest" "GET" "/api/risk-assessments/latest"
  add_endpoint "risk_history" "GET" "/api/risk-assessments?page=1&pageSize=10"
  add_endpoint "articles_favorites" "GET" "/api/articles/favorites?page=1&pageSize=10"
  add_endpoint "messages_list" "GET" "/api/messages?page=1&pageSize=10"
  add_endpoint "checkins_list" "GET" "/api/checkins?days=7"
  add_endpoint "checkins_analysis_get" "GET" "/api/checkins/analysis"
  add_endpoint "plan_tasks_list" "GET" "/api/plan-tasks"
  add_endpoint "plans_active" "GET" "/api/plans/active"
  add_endpoint "consultations_list" "GET" "/api/consultations?page=1&pageSize=10"
  add_endpoint "assistant_conversations" "GET" "/api/assistant/conversations"

  if [[ -n "${ASSISTANT_CONVERSATION_ID}" ]]; then
    add_endpoint "assistant_conversation_messages" "GET" "/api/assistant/conversations/${ASSISTANT_CONVERSATION_ID}/messages"
  elif [[ "${SKIP_MISSING_DYNAMIC_ENDPOINTS}" != "1" ]]; then
    add_endpoint "assistant_conversation_messages" "GET" "/api/assistant/conversations/1/messages"
  fi

  add_endpoint "doctor_conversations" "GET" "/api/doctors/${DOCTOR_ID}/conversations"

  if [[ -n "${DOCTOR_CONVERSATION_ID}" ]]; then
    add_endpoint "doctor_conversation_messages" "GET" "/api/doctors/${DOCTOR_ID}/conversations/${DOCTOR_CONVERSATION_ID}/messages"
  elif [[ "${SKIP_MISSING_DYNAMIC_ENDPOINTS}" != "1" ]]; then
    add_endpoint "doctor_conversation_messages" "GET" "/api/doctors/${DOCTOR_ID}/conversations/1/messages"
  fi
}

precheck_endpoint() {
  local method="$1"
  local url="$2"
  local code
  local attempt=1
  local max_attempts=$((PRECHECK_RETRIES + 1))

  if [[ "${PRECHECK}" != "1" ]]; then
    return 0
  fi

  while (( attempt <= max_attempts )); do
    code="$(curl -sS -o /dev/null -w "%{http_code}" \
      -X "${method}" \
      -H "Accept: application/json" \
      -H "Authorization: Bearer ${AUTH_TOKEN}" \
      "${url}" 2>/dev/null || true)"

    if [[ -z "${code}" ]]; then
      code="000"
    fi

    if [[ "${code}" =~ ^2[0-9][0-9]$ ]]; then
      return 0
    fi

    if [[ "${code}" == "429" && "${PRECHECK_RETRIES}" -gt 0 && "${attempt}" -lt "${max_attempts}" ]]; then
      echo "WARN: precheck rate limited: ${method} ${url}, http_code=429, retry=${attempt}/${PRECHECK_RETRIES}, sleep=${PRECHECK_RETRY_SLEEP}s" >&2
      sleep "${PRECHECK_RETRY_SLEEP}"
      attempt=$((attempt + 1))
      continue
    fi

    break
  done

  echo "WARN: precheck failed: ${method} ${url}, http_code=${code}" >&2

  if [[ "${SKIP_FAILED_PRECHECK}" == "1" ]]; then
    return 1
  fi

  return 0
}

warmup_endpoint() {
  local method="$1"
  local url="$2"

  if [[ "${WARMUP_DURATION}" == "0" || "${WARMUP_DURATION}" == "0s" ]]; then
    return 0
  fi

  echo "WARMUP: ${method} ${url}, c=${WARMUP_CONCURRENCY}, z=${WARMUP_DURATION}"

  local -a cmd
  build_oha_common_args cmd "${method}" "${WARMUP_CONCURRENCY}" "${WARMUP_DURATION}"
  cmd+=("${url}")

  "${cmd[@]}" >/dev/null 2>&1 || true
}

run_oha_case() {
  local phase="$1"
  local endpoint_name="$2"
  local method="$3"
  local path="$4"
  local concurrency="$5"
  local duration="$6"
  local iteration="$7"

  local url="${BASE_URL}${path}"
  local started_at ended_at exit_code
  local safe_name case_id raw_file case_file console_file
  local cmd_redacted

  safe_name="$(slugify "${phase}_${endpoint_name}_c${concurrency}_${duration}_r${iteration}")"
  case_id="${safe_name}"
  raw_file="${RAW_DIR}/${case_id}.oha.json"
  case_file="${CASE_DIR}/${case_id}.json"
  console_file="${RAW_DIR}/${case_id}.console.log"

  local -a cmd
  build_oha_common_args cmd "${method}" "${concurrency}" "${duration}"
  cmd+=("${url}")

  cmd_redacted="$(
    printf "%q " "${cmd[@]}" \
      | sed -E 's/Authorization:\\ Bearer\\ [^ ]+/Authorization:\\ Bearer\\ <redacted>/g'
  )"

  echo "RUN: phase=${phase}, endpoint=${endpoint_name}, c=${concurrency}, z=${duration}, url=${url}"

  started_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

  set +e
  "${cmd[@]}" > "${raw_file}" 2> "${console_file}"
  exit_code=$?
  set -e

  ended_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

  if [[ -s "${raw_file}" ]] && jq -e . "${raw_file}" >/dev/null 2>&1; then
    jq -n \
      --arg run_tag "${RUN_TAG}" \
      --arg phase "${phase}" \
      --arg endpoint_name "${endpoint_name}" \
      --arg method "${method}" \
      --arg path "${path}" \
      --arg url "${url}" \
      --arg duration "${duration}" \
      --argjson concurrency "${concurrency}" \
      --argjson iteration "${iteration}" \
      --arg started_at "${started_at}" \
      --arg ended_at "${ended_at}" \
      --argjson exit_code "${exit_code}" \
      --arg raw_file "${raw_file}" \
      --arg console_file "${console_file}" \
      --arg cmd "${cmd_redacted}" \
      --slurpfile oha "${raw_file}" \
      '{
        metadata: {
          run_tag: $run_tag,
          phase: $phase,
          endpoint_name: $endpoint_name,
          method: $method,
          path: $path,
          url: $url,
          duration: $duration,
          concurrency: $concurrency,
          iteration: $iteration,
          started_at: $started_at,
          ended_at: $ended_at,
          exit_code: $exit_code,
          raw_file: $raw_file,
          console_file: $console_file,
          command: $cmd
        },
        oha: $oha[0]
      }' > "${case_file}"
  else
    jq -n \
      --arg run_tag "${RUN_TAG}" \
      --arg phase "${phase}" \
      --arg endpoint_name "${endpoint_name}" \
      --arg method "${method}" \
      --arg path "${path}" \
      --arg url "${url}" \
      --arg duration "${duration}" \
      --argjson concurrency "${concurrency}" \
      --argjson iteration "${iteration}" \
      --arg started_at "${started_at}" \
      --arg ended_at "${ended_at}" \
      --argjson exit_code "${exit_code}" \
      --arg raw_file "${raw_file}" \
      --arg console_file "${console_file}" \
      --arg cmd "${cmd_redacted}" \
      '{
        metadata: {
          run_tag: $run_tag,
          phase: $phase,
          endpoint_name: $endpoint_name,
          method: $method,
          path: $path,
          url: $url,
          duration: $duration,
          concurrency: $concurrency,
          iteration: $iteration,
          started_at: $started_at,
          ended_at: $ended_at,
          exit_code: $exit_code,
          raw_file: $raw_file,
          console_file: $console_file,
          command: $cmd
        },
        error: {
          message: "oha did not produce valid JSON output"
        }
      }' > "${case_file}"
  fi

  jq -nc \
    --arg run_tag "${RUN_TAG}" \
    --arg phase "${phase}" \
    --arg endpoint_name "${endpoint_name}" \
    --arg method "${method}" \
    --arg path "${path}" \
    --arg url "${url}" \
    --arg duration "${duration}" \
    --argjson concurrency "${concurrency}" \
    --argjson iteration "${iteration}" \
    --argjson exit_code "${exit_code}" \
    --arg case_file "${case_file}" \
    --arg raw_file "${raw_file}" \
    --arg console_file "${console_file}" \
    '{
      run_tag: $run_tag,
      phase: $phase,
      endpoint_name: $endpoint_name,
      method: $method,
      path: $path,
      url: $url,
      duration: $duration,
      concurrency: $concurrency,
      iteration: $iteration,
      exit_code: $exit_code,
      case_file: $case_file,
      raw_file: $raw_file,
      console_file: $console_file
    }' >> "${MANIFEST_FILE}"

  sleep "${SLEEP_BETWEEN}"
}

login_and_get_token
discover_dynamic_ids
validate_dynamic_ids
build_endpoints

echo "============================================================"
echo "P1 API oha test started"
echo "BASE_URL=${BASE_URL}"
echo "OUT_DIR=${OUT_DIR}"
echo "DOCTOR_ID=${DOCTOR_ID}"
echo "ASSISTANT_CONVERSATION_ID=${ASSISTANT_CONVERSATION_ID:-<none>}"
echo "DOCTOR_CONVERSATION_ID=${DOCTOR_CONVERSATION_ID:-<none>}"
echo "PERF_CONCURRENCIES=${PERF_CONCURRENCIES}"
echo "STRESS_CONCURRENCIES=${STRESS_CONCURRENCIES}"
echo "PRECHECK_RETRIES=${PRECHECK_RETRIES}"
echo "PRECHECK_RETRY_SLEEP=${PRECHECK_RETRY_SLEEP}s"
echo "============================================================"

for endpoint in "${ENDPOINTS[@]}"; do
  IFS='|' read -r endpoint_name method path <<< "${endpoint}"
  url="${BASE_URL}${path}"

  if ! precheck_endpoint "${method}" "${url}"; then
    echo "SKIP: ${method} ${url}" >&2
    continue
  fi

  warmup_endpoint "${method}" "${url}"

  for ((iteration = 1; iteration <= REPEAT; iteration++)); do
    for concurrency in "${PERF_CONCS[@]}"; do
      run_oha_case "performance" "${endpoint_name}" "${method}" "${path}" "${concurrency}" "${PERF_DURATION}" "${iteration}"
    done

    for concurrency in "${STRESS_CONCS[@]}"; do
      run_oha_case "stress" "${endpoint_name}" "${method}" "${path}" "${concurrency}" "${STRESS_DURATION}" "${iteration}"
    done
  done
done

if compgen -G "${CASE_DIR}/*.json" >/dev/null; then
  jq -s . "${CASE_DIR}"/*.json > "${ALL_RESULTS_FILE}"
else
  echo "[]" > "${ALL_RESULTS_FILE}"
fi

echo "============================================================"
echo "P1 API oha test finished"
echo "Output directory: ${OUT_DIR}"
echo "Manifest JSONL:   ${MANIFEST_FILE}"
echo "All results JSON: ${ALL_RESULTS_FILE}"
echo "============================================================"
