import axios from "axios";
import { config } from "./config.js";

function maskApiKey(value) {
  if (!value) return "";
  if (value.length <= 10) return "***";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function normalizeAxiosError(error) {
  const status = error.response?.status;
  const responseData = error.response?.data;
  const cause = error.message || "未知错误";

  return {
    message: "Dify Chatflow 请求失败",
    status,
    responseData,
    cause,
    request: {
      baseURL: config.difyApiBaseUrl,
      apiKey: maskApiKey(config.difyApiKey)
    }
  };
}

const client = axios.create({
  baseURL: config.difyApiBaseUrl,
  timeout: config.requestTimeout,
  headers: {
    Authorization: `Bearer ${config.difyApiKey}`,
    "Content-Type": "application/json"
  }
});

/**
 * 调用 Dify Chatflow 的阻塞模式接口。
 * @param {object} params
 * @param {string} params.query 用户本轮提问。
 * @param {object} params.inputs Start 节点输入，医生智能体需要 user_id、doctor_id、app_type。
 * @param {string} params.user Dify user 标识，Express 场景通常与 user_id 一致。
 * @param {string} [params.conversationId] 续聊时传上一轮 conversation_id。
 * @returns {Promise<object>} Dify 原始响应数据。
 */
export async function sendChatMessage({ query, inputs, user, conversationId = "" }) {
  try {
    const response = await client.post("/chat-messages", {
      query,
      inputs,
      response_mode: "blocking",
      conversation_id: conversationId,
      user
    });

    return response.data;
  } catch (error) {
    throw normalizeAxiosError(error);
  }
}

export function buildDoctorInputs({ userId, doctorId }) {
  return {
    user_id: String(userId),
    app_type: "doctor",
    doctor_id: String(doctorId)
  };
}
