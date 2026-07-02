#!/usr/bin/env bash
set -Eeuo pipefail

# ============================================================
# P0 API 性能测试 / 压力测试脚本
# 工具: oha
#
# 默认测试目标:
#   - GET /health
#   - GET /api/health/db
#   - GET /api/diabetes-types
#   - GET /api/articles
#   - GET /api/articles/:id
#   - GET /api/articles/:id/comments
#   - GET /api/doctors
#   - GET /api/doctors/:id
#
# 输出:
#   oha-results/<RUN_TAG>/
#     ├── raw/                 # oha 原始 JSON
#     ├── cases/               # 带 metadata 的包装 JSON
#     ├── manifest.jsonl       # 每次测试一行，便于索引
#     └── all_results.json     # 所有 cases 合并后的 JSON 数组
# ============================================================

BASE_URL="${BASE_URL:-http://localhost:5173}"
OUT_ROOT="${OUT_ROOT:-./oha-results}"
RUN_TAG="${RUN_TAG:-p0-$(date +%Y%m%d-%H%M%S)}"

PERF_DURATION="${PERF_DURATION:-30s}"
STRESS_DURATION="${STRESS_DURATION:-60s}"
WARMUP_DURATION="${WARMUP_DURATION:-5s}"
WARMUP_CONCURRENCY="${WARMUP_CONCURRENCY:-5}"

# 性能测试：相对温和，适合看基线吞吐、平均延迟、P95/P99
PERF_CONCURRENCIES="${PERF_CONCURRENCIES:-10 50}"

# 压力测试：逐步加压，适合观察拐点、错误率、尾延迟恶化
STRESS_CONCURRENCIES="${STRESS_CONCURRENCIES:-100 200 400}"

# 每个场景重复次数
REPEAT="${REPEAT:-1}"

# 每个请求超时时间
TIMEOUT="${TIMEOUT:-10s}"

# 每次 oha 之间的冷却间隔
SLEEP_BETWEEN="${SLEEP_BETWEEN:-2}"

# 是否预检接口 2xx；非 2xx 默认跳过，避免误测 404 页面
PRECHECK="${PRECHECK:-1}"
SKIP_FAILED_PRECHECK="${SKIP_FAILED_PRECHECK:-1}"

# 是否关闭 keep-alive。默认 0，更适合看服务端极限吞吐。
# 如果想更接近真实短连接场景，可设置 DISABLE_KEEPALIVE=1
DISABLE_KEEPALIVE="${DISABLE_KEEPALIVE:-0}"

# oha 额外参数，例如:
#   OHA_EXTRA_ARGS="--insecure"
#   OHA_EXTRA_ARGS="--http2"
OHA_EXTRA_ARGS="${OHA_EXTRA_ARGS:-}"

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

# 尽量提高文件描述符上限，避免高并发时 client 侧先失败
ulimit -n 65535 >/dev/null 2>&1 || true

BASE_URL="${BASE_URL%/}"

# shellcheck disable=SC2206
EXTRA_ARGS=( ${OHA_EXTRA_ARGS} )

read -r -a PERF_CONCS <<< "${PERF_CONCURRENCIES}"
read -r -a STRESS_CONCS <<< "${STRESS_CONCURRENCIES}"

slugify() {
  printf "%s" "$1" \
    | tr '/:?&= ' '_______' \
    | tr -cd '[:alnum:]_.-'
}

discover_first_id() {
  local path="$1"
  local json
  json="$(curl -fsS -H "Accept: application/json" "${BASE_URL}${path}" 2>/dev/null || true)"

  if [[ -z "${json}" ]]; then
    echo ""
    return 0
  fi

  jq -r '
    (try .data.items[0].id catch null) //
    (try .data.list[0].id catch null) //
    (try .data.records[0].id catch null) //
    (try .data.rows[0].id catch null) //
    (try .data[0].id catch null) //
    empty
  ' <<< "${json}" 2>/dev/null || true
}

ARTICLE_ID="${ARTICLE_ID:-$(discover_first_id "/api/articles?page=1&pageSize=1")}"
DOCTOR_ID="${DOCTOR_ID:-$(discover_first_id "/api/doctors?page=1&pageSize=1")}"

ARTICLE_ID="${ARTICLE_ID:-1}"
DOCTOR_ID="${DOCTOR_ID:-1}"

declare -a ENDPOINTS=(
  "health|GET|/health"
  "api_health_db|GET|/api/health/db"
  "diabetes_types|GET|/api/diabetes-types"
  "articles_list|GET|/api/articles?page=1&pageSize=10"
  "article_detail|GET|/api/articles/${ARTICLE_ID}"
  "article_comments|GET|/api/articles/${ARTICLE_ID}/comments?page=1&pageSize=10"
  "doctors_list|GET|/api/doctors?page=1&pageSize=10"
  "doctor_detail|GET|/api/doctors/${DOCTOR_ID}"
)

precheck_endpoint() {
  local method="$1"
  local url="$2"
  local code

  if [[ "${PRECHECK}" != "1" ]]; then
    return 0
  fi

  code="$(curl -sS -o /dev/null -w "%{http_code}" \
    -X "${method}" \
    -H "Accept: application/json" \
    "${url}" 2>/dev/null || true)"

  if [[ -z "${code}" ]]; then
    code="000"
  fi

  if [[ "${code}" =~ ^2[0-9][0-9]$ ]]; then
    return 0
  fi

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

  local -a cmd=(
    oha
    --no-tui
    --output-format quiet
    -w
    -t "${TIMEOUT}"
    -m "${method}"
    -c "${WARMUP_CONCURRENCY}"
    -z "${WARMUP_DURATION}"
    -H "Accept: application/json"
  )

  if [[ "${DISABLE_KEEPALIVE}" == "1" ]]; then
    cmd+=(--disable-keepalive)
  fi

  cmd+=("${EXTRA_ARGS[@]}")
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
  local safe_name case_id raw_file case_file console_file cmd_string

  safe_name="$(slugify "${phase}_${endpoint_name}_c${concurrency}_${duration}_r${iteration}")"
  case_id="${safe_name}"
  raw_file="${RAW_DIR}/${case_id}.oha.json"
  case_file="${CASE_DIR}/${case_id}.json"
  console_file="${RAW_DIR}/${case_id}.console.log"

  local -a cmd=(
    oha
    --no-tui
    --output-format json
    --stats-success-breakdown
    -w
    -t "${TIMEOUT}"
    -m "${method}"
    -c "${concurrency}"
    -z "${duration}"
    -H "Accept: application/json"
    -o "${raw_file}"
  )

  if [[ "${DISABLE_KEEPALIVE}" == "1" ]]; then
    cmd+=(--disable-keepalive)
  fi

  cmd+=("${EXTRA_ARGS[@]}")
  cmd+=("${url}")

  cmd_string="$(printf "%q " "${cmd[@]}")"

  echo "RUN: phase=${phase}, endpoint=${endpoint_name}, c=${concurrency}, z=${duration}, url=${url}"

  started_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

  set +e
  "${cmd[@]}" > "${console_file}" 2>&1
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
      --arg cmd "${cmd_string}" \
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
      --arg cmd "${cmd_string}" \
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

echo "============================================================"
echo "P0 API oha test started"
echo "BASE_URL=${BASE_URL}"
echo "OUT_DIR=${OUT_DIR}"
echo "ARTICLE_ID=${ARTICLE_ID}"
echo "DOCTOR_ID=${DOCTOR_ID}"
echo "PERF_CONCURRENCIES=${PERF_CONCURRENCIES}"
echo "STRESS_CONCURRENCIES=${STRESS_CONCURRENCIES}"
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
echo "P0 API oha test finished"
echo "Output directory: ${OUT_DIR}"
echo "Manifest JSONL:   ${MANIFEST_FILE}"
echo "All results JSON: ${ALL_RESULTS_FILE}"
echo "============================================================"
