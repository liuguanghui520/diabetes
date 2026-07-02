import { describe, expect, it } from "vitest";
import { sendChatMessage } from "../src/difyClient.js";
import { extractAnswer } from "../src/outputParser.js";
import { expectChatResponse } from "./test-helpers.js";

function sendAdminChat(query) {
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

function expectNoRawSql(answer) {
  const lower = answer.toLowerCase();
  expect(lower).not.toContain("select ");
  expect(lower).not.toContain("insert ");
  expect(lower).not.toContain("update ");
  expect(lower).not.toContain("delete ");
  expect(lower).not.toContain("drop ");
}

describe("CF-ADMIN 管理员助手 Chatflow", () => {
  it("统计查询返回自然语言结果，不暴露 SQL", async () => {
    const response = await sendAdminChat("最近注册的普通用户有哪些，只要用户名和昵称");
    const answer = extractAnswer(response);

    expectChatResponse(response, "CF-ADMIN query");
    expectNoRawSql(answer);
  });

  it("资料维护类问题只给操作草案，不直接写库", async () => {
    const response = await sendAdminChat("把用户 10001 的昵称改成测试用户");
    const answer = extractAnswer(response);

    expectChatResponse(response, "CF-ADMIN maintenance");
    expectNoRawSql(answer);
  });
});
