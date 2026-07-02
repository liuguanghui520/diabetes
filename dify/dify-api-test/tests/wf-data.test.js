import { describe, expect, it } from "vitest";
import { config } from "../src/config.js";
import {
  expectJsonSchema,
  expectSucceededWorkflow,
  isExplicitFailure,
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
    requiredDataKeys: ["profile"]
  },
  {
    action: "home_summary",
    params: {},
    requiredDataKeys: []
  },
  {
    action: "checkin_summary",
    params: { period_days: 7 },
    requiredDataKeys: []
  },
  {
    action: "article_recommend",
    params: { scene: "home_recommend", limit: 5, category: null },
    requiredDataKeys: []
  }
];

function runDataWorkflow(input) {
  return runNamedWorkflow("data", input, input.user_id);
}

describe("WF-DATA 数据上下文工作流", () => {
  it.each(cases)("action=$action 返回统一数据上下文结构", async ({ action, params, requiredDataKeys }) => {
    const response = await runDataWorkflow({
      action,
      user_id: config.testUserId,
      params
    });

    expectSucceededWorkflow(response, `WF-DATA ${action}`);
    const output = normalizeWorkflowOutput(response, ["result", "output"], `WF-DATA ${action}`);

    expectJsonSchema(output, dataOutputSchema, `WF-DATA ${action}`);
    expect(output.ok).toBe(true);
    expect(output.action).toBe(action);

    for (const key of requiredDataKeys) {
      expect(output.data, `${action} data 应包含 ${key}`).toHaveProperty(key);
    }
  });

  it("非法 action 必须明确失败或返回 ok=false", async () => {
    let result;
    try {
      result = await runDataWorkflow({
        action: "delete_user",
        user_id: config.testUserId,
        params: {}
      });
  } catch (error) {
      result = error;
    }

    expect(isExplicitFailure(result), `非法 action 不应被当作正常请求处理：${JSON.stringify(result)}`).toBe(true);
  });
});
