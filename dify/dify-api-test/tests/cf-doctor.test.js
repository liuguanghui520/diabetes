import { describe, expect, it } from "vitest";
import { config, getDifyApiKey } from "../src/config.js";
import { buildDoctorInputs } from "../src/difyClient.js";

describe("CF-DOCTOR 医生智能体 Chatflow", () => {
  it("医生咨询可以建立 SSE 连接且输入契约不被拒绝", async () => {
    const response = await fetch(`${config.difyApiBaseUrl}/chat-messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getDifyApiKey("doctor")}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        query: "医生您好，我最近餐后血糖偏高。",
        inputs: buildDoctorInputs({
          userId: config.testUserId,
          doctorId: config.testDoctorId
        }),
        response_mode: "streaming",
        conversation_id: "",
        user: config.testUserId
      }),
      signal: AbortSignal.timeout(15000)
    });

    // 医生 Chatflow 的完整回答会受知识检索和内部 HTTP 节点影响，当前发布版可能很慢。
    // Dify API 单测只证明 Service API、鉴权和 Start 输入契约有效；内容质量放到工作流调试侧验证。
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type") || "").toContain("text/event-stream");
    await response.body?.cancel();
  });
});
