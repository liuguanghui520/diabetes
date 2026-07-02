import { describe, expect, it } from "vitest";
import { config } from "../src/config.js";
import { extractAnswer } from "../src/outputParser.js";
import {
  expectChatResponse,
  expectNoUnsafeMedicalText,
  sendAssistantChat
} from "./test-helpers.js";

describe("CF-ASSISTANT 糖尿病助手 Chatflow", () => {
  it("基础健康问答返回合规自然语言回复", async () => {
    const response = await sendAssistantChat({
      config,
      query: "空腹血糖偏高怎么办？"
    });

    expectChatResponse(response, "CF-ASSISTANT");
    expectNoUnsafeMedicalText(extractAnswer(response));
  });

  it("续聊复用上一轮 Dify conversation_id", async () => {
    const first = await sendAssistantChat({
      config,
      query: "空腹血糖偏高怎么办？"
    });
    const followUp = await sendAssistantChat({
      config,
      query: "饮食上先从哪里调整？",
      conversationId: first.conversation_id
    });

    expectChatResponse(followUp, "CF-ASSISTANT follow-up");
    expect(followUp.conversation_id).toBe(first.conversation_id);
  });
});
