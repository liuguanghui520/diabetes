const defaultSnippetLength = 600;

function stripMarkdownCodeFence(value) {
  const trimmed = value.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1].trim() : trimmed;
}

function snippet(value, maxLength = defaultSnippetLength) {
  const text = String(value);
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

/**
 * 解析模型可能返回的 JSON 对象或 JSON 字符串。
 * 医生 Chatflow 当前主要返回自然语言，本函数保留给后续 JSON 输出型节点复用。
 * @param {unknown} value Dify 输出字段值。
 * @returns {object}
 */
export function parseJsonOutput(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value;
  }

  if (typeof value !== "string") {
    throw new Error(`JSON 输出必须是对象或字符串，当前类型为 ${typeof value}。`);
  }

  const cleanedValue = stripMarkdownCodeFence(value);
  try {
    const parsed = JSON.parse(cleanedValue);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("JSON 顶层必须是对象。");
    }
    return parsed;
  } catch (error) {
    throw new Error(`JSON 解析失败：${error.message}。原始输出片段：${snippet(cleanedValue)}`);
  }
}

export function extractAnswer(response) {
  if (!response || typeof response !== "object") {
    throw new Error("Dify 响应必须是对象。");
  }
  if (typeof response.answer !== "string") {
    throw new Error("Dify Chatflow 响应缺少字符串类型的 answer 字段。");
  }
  return response.answer.trim();
}
