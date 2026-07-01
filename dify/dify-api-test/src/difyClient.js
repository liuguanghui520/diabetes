import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
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
    Authorization: `Bearer ${config.difyApiKey}`
  }
});

let requiredFileVariablesPromise;

async function getRequiredFileVariables(user) {
  if (!config.autoUploadRequiredFiles) {
    return [];
  }

  requiredFileVariablesPromise ??= client
    .get("/parameters", { params: { user } })
    .then((response) => {
      const forms = response.data?.user_input_form || [];
      return forms
        .map((item) => item.file)
        .filter((item) => item?.required && item.variable)
        .map((item) => item.variable);
    });

  return requiredFileVariablesPromise;
}

async function uploadTestFile(user) {
  const filePath = resolve(config.testFilePath);
  const fileBuffer = await readFile(filePath);
  const formData = new FormData();

  formData.append("user", String(user));
  formData.append("file", new Blob([fileBuffer], { type: "text/plain" }), basename(filePath));

  const response = await client.post("/files/upload", formData);
  if (!response.data?.id) {
    throw new Error("Dify 文件上传成功响应缺少 id 字段。");
  }

  return {
    type: "document",
    transfer_method: "local_file",
    upload_file_id: response.data.id
  };
}

async function addRequiredFileInputs(inputs, user) {
  const nextInputs = { ...inputs };
  const requiredFileVariables = await getRequiredFileVariables(user);

  for (const variableName of requiredFileVariables) {
    if (!nextInputs[variableName]) {
      nextInputs[variableName] = await uploadTestFile(user);
    }
  }

  return nextInputs;
}

/**
 * 调用 Dify Chatflow 的阻塞模式接口。
 * 如果应用 Start 表单存在必填 file 变量，会自动上传占位文件并写入 inputs.file。
 * @param {object} params
 * @param {string} params.query 用户本轮提问。
 * @param {object} params.inputs Start 节点输入，医生智能体需要 user_id、doctor_id、app_type。
 * @param {string} params.user Dify user 标识，Express 场景通常与 user_id 一致。
 * @param {string} [params.conversationId] 续聊时传上一轮 conversation_id。
 * @returns {Promise<object>} Dify 原始响应数据。
 */
export async function sendChatMessage({ query, inputs, user, conversationId = "" }) {
  try {
    const preparedInputs = await addRequiredFileInputs(inputs, user);
    const response = await client.post("/chat-messages", {
      query,
      inputs: preparedInputs,
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
