import { describe, expect, it } from "vitest";
import { config, getDifyApiKey } from "../src/config.js";

describe("CF-ASSISTANT 糖尿病助手 Chatflow", () => {
  it("基础健康问答可以建立 SSE 连接且不被参数校验拒绝", async () => {
    const response = await fetch(`${config.difyApiBaseUrl}/chat-messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getDifyApiKey("assistant")}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        query: "什么是 2 型糖尿病？",
        inputs: {
          user_id: config.testUserId,
          app_type: "assistant"
        },
        response_mode: "streaming",
        conversation_id: "",
        user: config.testUserId
      }),
      signal: AbortSignal.timeout(15000)
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type") || "").toContain("text/event-stream");
    await response.body?.cancel();
  });
});
