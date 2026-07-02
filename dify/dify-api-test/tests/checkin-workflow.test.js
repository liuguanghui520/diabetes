import { describe, expect, it } from "vitest";
import { config } from "../src/config.js";
import { runWorkflow } from "../src/difyClient.js";
import { checkinAnalysisSchema } from "../src/workflowSchemas.js";
import {
  expectSchema,
  expectSucceededWorkflow,
  isExpectedInvalidWorkflowResult,
  normalizeWorkflowOutput
} from "./workflow-helpers.js";

const checkinInput = {
  user_id: config.testUserId,
  period_start: "2026-06-17",
  period_end: "2026-06-23"
};

async function runCheckinWorkflow(inputs) {
  return runWorkflow({ appName: "checkin", inputs, user: String(inputs.user_id || config.testUserId) });
}

describe("WF-CHECKIN 生活状态分析工作流", () => {
  it("分析周期打卡记录并返回完成率和改进建议", async () => {
    const response = await runCheckinWorkflow(checkinInput);
    expectSucceededWorkflow(response);

    const output = normalizeWorkflowOutput(response, ["analysis", "result", "output"]);
    expectSchema(output, checkinAnalysisSchema, "WF-CHECKIN");
    expect(output.completion_rate).toBeGreaterThanOrEqual(0);
    expect(output.completion_rate).toBeLessThanOrEqual(100);
  });

  it("结束日期早于开始日期时应明确失败", async () => {
    let result;
    try {
      result = await runCheckinWorkflow({
        ...checkinInput,
        period_start: "2026-06-23",
        period_end: "2026-06-17"
      });
    } catch (error) {
      result = error;
    }

    expect(isExpectedInvalidWorkflowResult(result), `异常输入未被明确处理：${JSON.stringify(result)}`).toBe(true);
  });
});
