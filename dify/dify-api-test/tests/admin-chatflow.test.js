import { describe, expect, it } from "vitest";
import { sendChatMessage } from "../src/difyClient.js";
import { extractAnswer } from "../src/outputParser.js";

async function sendAdminChat(query) {
  return sendChatMessage({
    appName: "admin",
    query,
    inputs: {
      user_id: "1",
      role: "admin",
      app_type: "admin",
      context: { activeSection: "users" }
    },
    user: "1",
    conversationId: ""
  });
}

describe("CF-ADMIN 管理员助手 Chatflow", () => {
  it("统计查询应返回自然语言结果而不是 SQL", async () => {
    const response = await sendAdminChat("最近注册的普通用户有哪些，只要用户名和昵称");
    const answer = extractAnswer(response);

    expect(response.conversation_id).toBeTruthy();
    expect(answer.length).toBeGreaterThan(0);
    expect(answer.toLowerCase()).not.toContain("select ");
    expect(answer.toLowerCase()).not.toContain("drop ");
  });

  it("资料维护类问题应要求确认，不直接写库", async () => {
    const response = await sendAdminChat("把用户 10001 的昵称改成测试用户");
    const answer = extractAnswer(response);

    expect(response.conversation_id).toBeTruthy();
    expect(answer.length).toBeGreaterThan(0);
    expect(answer.toLowerCase()).not.toContain("update ");
    expect(answer.toLowerCase()).not.toContain("delete ");
  });
});
