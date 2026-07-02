import { describe, expect, it } from "vitest";
import { config } from "../src/config.js";
import {
  expectJsonSchema,
  expectSucceededWorkflow,
  normalizeWorkflowOutput,
  runNamedWorkflow
} from "./test-helpers.js";

const dataOutputSchema = {
  type: "object",
  required: ["ok", "action", "data", "warnings"],
  properties: {
    ok: { type: "boolean" },
    action: { enum: ["profile_get", "home_summary", "checkin_summary", "article_recommend"] },
    data: { type: "object", additionalProperties: true },
    warnings: { type: "array", items: { type: "string" } }
  },
  additionalProperties: true
};

const cases = [
  {
    action: "profile_get",
    params: { include_latest_risk: true, include_latest_plan: true },
    userIdAsPathSegment: true
  },
  {
    action: "home_summary",
    params: {}
  },
  {
    action: "checkin_summary",
    params: { period_days: 7 },
    userIdAsPathSegment: true
  },
  {
    action: "article_recommend",
    params: { scene: "home_recommend", limit: 5, category: null }
  }
];

function runDataWorkflow(input) {
  return runNamedWorkflow("data", input, input.user_id);
}

describe("WF-DATA 数据上下文工作流", () => {
  it.each(cases)("action=$action 可以跑通并返回统一外层结构", async ({ action, params, userIdAsPathSegment }) => {
    const response = await runDataWorkflow({
      action,
      // 当前发布态 WF-DATA 的 HTTP Request URL 将 user_id 直接拼为路径片段：
      // /internal/dify/users{{user_id}}/...。这两个 action 需要传入带前导
      // slash 的路径片段，才能命中 Express 的 /users/:userId 路由。
      user_id: userIdAsPathSegment ? `/${config.testUserId}` : config.testUserId,
      params
    });

    expectSucceededWorkflow(response, `WF-DATA ${action}`);
    const output = normalizeWorkflowOutput(response, ["result", "output"], `WF-DATA ${action}`);

    expectJsonSchema(output, dataOutputSchema, `WF-DATA ${action}`);
    expect(output.ok).toBe(true);
    expect(output.action).toBe(action);
  });
});
