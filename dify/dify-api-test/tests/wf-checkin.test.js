import { describe, expect, it } from "vitest";
import { config } from "../src/config.js";
import {
  expectJsonSchema,
  expectSucceededWorkflow,
  isExplicitFailure,
  normalizeWorkflowOutput,
  runNamedWorkflow
} from "./test-helpers.js";

const checkinSchema = {
  type: "object",
  required: ["completion_rate", "metrics", "evaluation", "improvements"],
  properties: {
    completion_rate: { type: "number", minimum: 0, maximum: 100 },
    metrics: { type: "object", additionalProperties: true },
    evaluation: { type: "string", minLength: 1 },
    improvements: { type: "array", items: { type: "string" } }
  },
  additionalProperties: true
};

const checkinInput = {
  user_id: config.testUserId,
  period_start: "2026-06-17",
  period_end: "2026-06-23"
};

describe("WF-CHECKIN 生活状态分析工作流", () => {
  it("分析周期打卡记录并输出完成率、评价和改进建议", async () => {
    const response = await runNamedWorkflow("checkin", checkinInput, checkinInput.user_id);
    expectSucceededWorkflow(response, "WF-CHECKIN");

    const output = normalizeWorkflowOutput(response, ["analysis", "result", "output"], "WF-CHECKIN");
    expectJsonSchema(output, checkinSchema, "WF-CHECKIN");
  });

  it("结束日期早于开始日期时必须失败或返回明确错误", async () => {
    let result;
    try {
      result = await runNamedWorkflow(
        "checkin",
        { ...checkinInput, period_start: "2026-06-23", period_end: "2026-06-17" },
        checkinInput.user_id
      );
    } catch (error) {
      result = error;
    }

    expect(isExplicitFailure(result), `非法日期范围不应静默成功：${JSON.stringify(result)}`).toBe(true);
  });
});
