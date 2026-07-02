import { describe, expect, it } from "vitest";
import { config } from "../src/config.js";
import { sendChatMessage } from "../src/difyClient.js";
import { extractAnswer } from "../src/outputParser.js";
import { expectNoForbiddenMedicalPhrases, expectValidChatflowResponse } from "./helpers.js";

async function sendAssistantChat({ query, conversationId = "" }) {
  return sendChatMessage({
    appName: "assistant",
    query,
    inputs: {
      user_id: config.testUserId,
      app_type: "assistant"
    },
    user: config.testUserId,
    conversationId
  });
}

describe("CF-ASSISTANT 糖尿病助手 Chatflow", () => {
  it("基础健康问答返回合规回复", async () => {
    const response = await sendAssistantChat({ query: "空腹血糖偏高怎么办？" });
    const answer = extractAnswer(response);

    expectValidChatflowResponse(response);
    expect(answer.length).toBeGreaterThan(0);
    expectNoForbiddenMedicalPhrases(answer);
  });

  it("续聊复用 Dify conversation_id", async () => {
    const firstResponse = await sendAssistantChat({ query: "空腹血糖偏高怎么办？" });
    const followUpResponse = await sendAssistantChat({
      query: "那我饮食上先从哪里调整？",
      conversationId: firstResponse.conversation_id
    });

    expectValidChatflowResponse(followUpResponse);
    expect(followUpResponse.conversation_id).toBe(firstResponse.conversation_id);
  });
});
