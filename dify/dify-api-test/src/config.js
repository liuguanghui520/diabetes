import dotenv from "dotenv";

dotenv.config();

const requiredEnvNames = ["DIFY_API_BASE_URL"];

function readRequiredEnv(name) {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`缺少必要环境变量 ${name}，请复制 .env.example 为 .env 并填写真实配置。`);
  }
  return value.trim();
}

function readOptionalEnv(name) {
  const value = process.env[name];
  return value && value.trim() !== "" ? value.trim() : "";
}

function readNumberEnv(name, defaultValue) {
  const rawValue = process.env[name];
  if (rawValue === undefined || rawValue === "") {
    return defaultValue;
  }

  const value = Number(rawValue);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`环境变量 ${name} 必须是大于 0 的数字，当前值为：${rawValue}`);
  }
  return value;
}

function readBooleanEnv(name, defaultValue) {
  const rawValue = process.env[name];
  if (rawValue === undefined || rawValue === "") {
    return defaultValue;
  }
  return !["0", "false", "no", "off"].includes(rawValue.trim().toLowerCase());
}

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, "");
}

const appApiKeys = {
  default: readOptionalEnv("DIFY_API_KEY"),
  admin: readOptionalEnv("DIFY_ADMIN_API_KEY"),
  report: readOptionalEnv("DIFY_REPORT_API_KEY"),
  doctor: readOptionalEnv("DIFY_DOCTOR_API_KEY"),
  assistant: readOptionalEnv("DIFY_ASSISTANT_API_KEY"),
  plan: readOptionalEnv("DIFY_PLAN_API_KEY"),
  checkin: readOptionalEnv("DIFY_CHECKIN_API_KEY"),
  risk: readOptionalEnv("DIFY_RISK_API_KEY"),
  data: readOptionalEnv("DIFY_DATA_API_KEY")
};

export function getDifyApiKey(appName = "default") {
  const key = appApiKeys[appName] || appApiKeys.default;
  if (!key) {
    throw new Error(`缺少 Dify API Key：请配置 DIFY_${appName.toUpperCase()}_API_KEY 或 DIFY_API_KEY。`);
  }
  return key;
}

export function validateRequiredEnv(appName = "default") {
  for (const name of requiredEnvNames) {
    readRequiredEnv(name);
  }
  getDifyApiKey(appName);
}

export const config = {
  difyApiBaseUrl: normalizeBaseUrl(readRequiredEnv("DIFY_API_BASE_URL")),
  difyApiKey: appApiKeys.default,
  appApiKeys,
  requestTimeout: readNumberEnv("DIFY_REQUEST_TIMEOUT", 120000),
  maxElapsedTime: readNumberEnv("DIFY_MAX_ELAPSED_TIME", 60),
  maxTotalTokens: readNumberEnv("DIFY_MAX_TOTAL_TOKENS", 10000),
  maxTotalSteps: readNumberEnv("DIFY_MAX_TOTAL_STEPS", 20),
  autoUploadRequiredFiles: readBooleanEnv("DIFY_AUTO_UPLOAD_REQUIRED_FILES", true),
  testFilePath: process.env.DIFY_TEST_FILE_PATH || "test-assets/placeholder.txt",
  testUserId: process.env.TEST_USER_ID || "10001",
  testDoctorId: process.env.TEST_DOCTOR_ID || "3",
  testOtherDoctorId: process.env.TEST_OTHER_DOCTOR_ID || "4",
  testQuery: process.env.TEST_QUERY || "医生您好，我最近餐后血糖偏高。",
  testFollowUpQuery: process.env.TEST_FOLLOW_UP_QUERY || "那我平时饮食和运动需要注意什么？"
};
