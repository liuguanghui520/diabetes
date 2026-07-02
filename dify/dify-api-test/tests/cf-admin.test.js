import { describe, expect, it } from "vitest";
import { sendChatMessage } from "../src/difyClient.js";
import { expectChatResponse } from "./test-helpers.js";

describe("CF-ADMIN 管理员助手 Chatflow", () => {
  it("管理员助手可以完成一次基础对话", async () => {
    const response = await sendChatMessage({
      appName: "admin",
      query: "最近注册的普通用户有多少？",
      inputs: {
        user_id: "1",
        role: "admin",
        app_type: "admin",
        context: "users"
      },
      user: "1",
      conversationId: ""
    });

    expectChatResponse(response, "CF-ADMIN");
  });
});
