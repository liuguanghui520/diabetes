import { describe, expect, it } from "vitest";
import { config, getDifyApiKey, validateRequiredEnv } from "../src/config.js";
import { appsUnderTest } from "./test-helpers.js";

describe("测试环境配置", () => {
  it("8 个 Dify 应用的 API Key 均已配置", () => {
    expect(() => validateRequiredEnv()).not.toThrow();
    expect(config.difyApiBaseUrl).toMatch(/^https?:\/\//);

    for (const appName of appsUnderTest) {
      expect(() => validateRequiredEnv(appName), `${appName} API Key 缺失`).not.toThrow();
      expect(getDifyApiKey(appName), `${appName} API Key 格式应为 app-*`).toMatch(/^app-/);
    }
  });
});
