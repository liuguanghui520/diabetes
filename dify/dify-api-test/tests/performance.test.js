import { describe, expect, it } from "vitest";
import { config } from "../src/config.js";
import { expectValidChatflowResponse, getUsage, sendDoctorChat } from "./helpers.js";

describe("医生智能体 Chatflow 性能指标", () => {
  it("响应耗时和 Token 消耗在阈值内", async () => {
    const startedAt = Date.now();
    const response = await sendDoctorChat();
    const clientElapsedSeconds = (Date.now() - startedAt) / 1000;
    const usage = getUsage(response);

    expectValidChatflowResponse(response);
    expect(clientElapsedSeconds).toBeLessThan(config.maxElapsedTime);

    if (typeof usage.latency === "number") {
      expect(usage.latency).toBeLessThan(config.maxElapsedTime);
    }

    if (typeof usage.total_tokens === "number") {
      expect(usage.total_tokens).toBeLessThan(config.maxTotalTokens);
    }

    if (typeof usage.total_price === "string") {
      expect(Number.isNaN(Number(usage.total_price))).toBe(false);
    }
  });
});
