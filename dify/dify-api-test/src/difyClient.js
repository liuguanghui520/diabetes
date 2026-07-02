import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import axios from "axios";
import { config, getDifyApiKey } from "./config.js";

function maskApiKey(value) {
  if (!value) return "";
  if (value.length <= 10) return "***";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function createClient(appName = "default") {
  const apiKey = getDifyApiKey(appName);
  return axios.create({
    baseURL: config.difyApiBaseUrl,
    timeout: config.requestTimeout,
    headers: {
      Authorization: `Bearer ${apiKey}`
    }
  });
}

function normalizeAxiosError(error, appName = "default") {
  const status = error.response?.status;
  const responseData = error.response?.data;
  const cause = error.message || "未知错误";
  const apiKey = getDifyApiKey(appName);

  const responseText = responseData ? `；响应体：${JSON.stringify(responseData)}` : "";
  const normalizedError = new Error(`Dify 请求失败：${cause}${responseText}`);
  normalizedError.status = status;
  normalizedError.responseData = responseData;
  normalizedError.cause = cause;
  normalizedError.request = {
    appName,
    baseURL: config.difyApiBaseUrl,
    apiKey: maskApiKey(apiKey)
  };
  return normalizedError;
}

const requiredFileVariablesCache = new Map();

async function getRequiredFileVariables(client, appName, user) {
  if (!config.autoUploadRequiredFiles) {
    return [];
  }

  if (!requiredFileVariablesCache.has(appName)) {
    requiredFileVariablesCache.set(
      appName,
      client.get("/parameters", { params: { user } }).then((response) => {
        const forms = response.data?.user_input_form || [];
        return forms
          .map((item) => item.file)
          .filter((item) => item?.required && item.variable)
          .map((item) => item.variable);
      })
    );
  }

  return requiredFileVariablesCache.get(appName);
}

async function uploadTestFile(client, user) {
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

async function addRequiredFileInputs({ client, appName, inputs, user }) {
  const nextInputs = { ...inputs };
  const requiredFileVariables = await getRequiredFileVariables(client, appName, user);

  for (const variableName of requiredFileVariables) {
    if (!nextInputs[variableName]) {
      nextInputs[variableName] = await uploadTestFile(client, user);
    }
  }

  return nextInputs;
}

function normalizeStreamingChatResponse(events) {
  let answer = "";
  let messageId = "";
  let conversationId = "";
  let taskId = "";
  let metadata = {};

  for (const event of events) {
    if (event.event === "message" || event.event === "agent_message") {
      answer += event.answer || "";
    }
    if (event.event === "message_replace") {
      answer = event.answer || "";
    }
    if (event.conversation_id) {
      conversationId = event.conversation_id;
    }
    if (event.message_id || event.id) {
      messageId = event.message_id || event.id;
    }
    if (event.task_id) {
      taskId = event.task_id;
    }
    if (event.event === "message_end" && event.metadata) {
      metadata = event.metadata;
    }
    if (event.event === "error") {
      throw new Error(`Dify Chatflow 流式返回错误：${event.message || event.code || "unknown"}`);
    }
  }

  return {
    event: "message",
    task_id: taskId,
    id: messageId,
    message_id: messageId,
    conversation_id: conversationId,
    mode: "chat",
    answer,
    metadata,
    raw_events: events
  };
}

function parseSseBlock(block) {
  const dataLines = block
    .split(/\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trim())
    .filter((line) => line && line !== "[DONE]");

  return dataLines.map((line) => {
    try {
      return JSON.parse(line);
    } catch {
      return null;
    }
  }).filter(Boolean);
}

function collectStreamingChatEvents(stream) {
  return new Promise((resolve, reject) => {
    const events = [];
    let buffer = "";
    let settled = false;

    function finish() {
      if (settled) return;
      settled = true;
      stream.destroy();
      resolve(events);
    }

    function fail(error) {
      if (settled) return;
      settled = true;
      stream.destroy();
      reject(error);
    }

    stream.setEncoding("utf8");
    stream.on("data", (chunk) => {
      buffer += chunk;
      const blocks = buffer.split(/\n\n+/);
      buffer = blocks.pop() || "";

      for (const block of blocks) {
        for (const event of parseSseBlock(block)) {
          events.push(event);
          if (event.event === "error") {
            fail(new Error(`Dify Chatflow 流式返回错误：${event.message || event.code || "unknown"}`));
            return;
          }
          if (event.event === "message_end" || event.event === "workflow_paused") {
            finish();
            return;
          }
        }
      }
    });
    stream.on("end", () => {
      if (buffer.trim()) {
        events.push(...parseSseBlock(buffer));
      }
      finish();
    });
    stream.on("error", fail);
  });
}

/**
 * 调用 Dify Chatflow 接口。默认使用 Dify 文档推荐的 streaming 模式，
 * 并在测试客户端内解析 SSE，避免把流式响应误当成普通 JSON。
 * @param {object} params
 * @param {string} [params.appName] 应用名，用于选择对应的 Dify API Key。
 * @param {string} params.query 用户本轮提问。
 * @param {object} params.inputs Start 节点输入。
 * @param {string} params.user Dify user 标识。
 * @param {string} [params.conversationId] 续聊时传上一轮 conversation_id。
 * @returns {Promise<object>} Dify 原始响应数据。
 */
export async function sendChatMessage({
  appName = "default",
  query,
  inputs,
  user,
  conversationId = "",
  responseMode = "streaming"
}) {
  const client = createClient(appName);

  try {
    const preparedInputs = await addRequiredFileInputs({ client, appName, inputs, user });
    const response = await client.post("/chat-messages", {
      query,
      inputs: preparedInputs,
      response_mode: responseMode,
      conversation_id: conversationId,
      user
    }, {
      responseType: responseMode === "streaming" ? "stream" : "json"
    });

    if (responseMode === "streaming") {
      return normalizeStreamingChatResponse(await collectStreamingChatEvents(response.data));
    }

    return response.data;
  } catch (error) {
    throw normalizeAxiosError(error, appName);
  }
}

/**
 * 调用 Dify Workflow 阻塞模式接口。
 * @param {object} params
 * @param {string} params.appName 应用名，用于选择对应的 Dify API Key。
 * @param {object} params.inputs Workflow Start 输入。
 * @param {string} params.user Dify user 标识。
 * @returns {Promise<object>} Dify 原始响应数据。
 */
export async function runWorkflow({ appName, inputs, user }) {
  const client = createClient(appName);

  try {
    const preparedInputs = await addRequiredFileInputs({ client, appName, inputs, user });
    const response = await client.post("/workflows/run", {
      inputs: preparedInputs,
      response_mode: "blocking",
      user
    });

    return response.data;
  } catch (error) {
    throw normalizeAxiosError(error, appName);
  }
}

export function buildDoctorInputs({ userId, doctorId }) {
  return {
    user_id: String(userId),
    app_type: "doctor",
    doctor_id: String(doctorId)
  };
}
