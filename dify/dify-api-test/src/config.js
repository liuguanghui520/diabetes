import dotenv from "dotenv";

dotenv.config();

const requiredEnvNames = ["DIFY_API_BASE_URL", "DIFY_API_KEY"];

function readRequiredEnv(name) {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`缺少必要环境变量 ${name}，请复制 .env.example 为 .env 并填写真实配置。`);
  }
  return value.trim();
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

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, "");
}

export function validateRequiredEnv() {
  for (const name of requiredEnvNames) {
    readRequiredEnv(name);
  }
}

export const config = {
  difyApiBaseUrl: normalizeBaseUrl(readRequiredEnv("DIFY_API_BASE_URL")),
  difyApiKey: readRequiredEnv("DIFY_API_KEY"),
  requestTimeout: readNumberEnv("DIFY_REQUEST_TIMEOUT", 120000),
  maxElapsedTime: readNumberEnv("DIFY_MAX_ELAPSED_TIME", 60),
  maxTotalTokens: readNumberEnv("DIFY_MAX_TOTAL_TOKENS", 10000),
  maxTotalSteps: readNumberEnv("DIFY_MAX_TOTAL_STEPS", 20),
  testUserId: process.env.TEST_USER_ID || "10001",
  testDoctorId: process.env.TEST_DOCTOR_ID || "3",
  testOtherDoctorId: process.env.TEST_OTHER_DOCTOR_ID || "4",
  testQuery: process.env.TEST_QUERY || "医生您好，我最近餐后血糖偏高。",
  testFollowUpQuery: process.env.TEST_FOLLOW_UP_QUERY || "那我平时饮食和运动需要注意什么？"
};
