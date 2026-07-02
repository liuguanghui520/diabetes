import { describe, expect, it } from "vitest";
import { config, validateRequiredEnv } from "../src/config.js";
import { extractAnswer } from "../src/outputParser.js";
import { expectValidChatflowResponse, sendDoctorChat } from "./helpers.js";

describe("Dify Chatflow 连接测试", () => {
  it("必要环境变量已配置", () => {
    expect(() => validateRequiredEnv()).not.toThrow();
    expect(config.difyApiBaseUrl).toMatch(/^https?:\/\//);
    expect(config.difyApiKey).toMatch(/^app-/);
  });

  it("能够成功调用医生智能体 Chatflow", async () => {
    const response = await sendDoctorChat();

    expectValidChatflowResponse(response);
    expect(extractAnswer(response).length).toBeGreaterThan(0);
  });
});
