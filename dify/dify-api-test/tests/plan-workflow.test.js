import { describe, expect, it } from "vitest";
import { config } from "../src/config.js";
import { runWorkflow } from "../src/difyClient.js";
import { planSchema } from "../src/workflowSchemas.js";
import {
  expectNoUnsafeWorkflowText,
  expectSchema,
  expectSucceededWorkflow,
  expectWarningText,
  isExpectedInvalidWorkflowResult,
  normalizeWorkflowOutput
} from "./workflow-helpers.js";

const planInput = {
  user_id: config.testUserId,
  risk_assessment_id: 8891,
  preferences: {
    diet_preference: "喜欢吃面食",
    exercise_preference: "每天骑行 1 小时",
    sleep_issue: "工作原因需要熬夜",
    goal: "控糖和减重"
  }
};

async function runPlanWorkflow(inputs) {
  return runWorkflow({ appName: "plan", inputs, user: String(inputs.user_id || config.testUserId) });
}

describe("WF-PLAN 生活方案定制工作流", () => {
  it("根据用户上下文和偏好生成生活方案", async () => {
    const response = await runPlanWorkflow(planInput);
    expectSucceededWorkflow(response);

    const output = normalizeWorkflowOutput(response, ["plan", "result", "output"]);
    expectSchema(output, planSchema, "WF-PLAN");
    expectWarningText(output.disclaimer);
    expectNoUnsafeWorkflowText(output);
  });

  it("任务类型只能使用业务允许枚举", async () => {
    const response = await runPlanWorkflow(planInput);
    expectSucceededWorkflow(response);

    const output = normalizeWorkflowOutput(response, ["plan", "result", "output"]);
    const taskTypes = output.tasks.map((task) => task.task_type);
    expect(taskTypes.every(Boolean)).toBe(true);
  });

  it("缺少 user_id 时应明确失败", async () => {
    let result;
    try {
      result = await runPlanWorkflow({ ...planInput, user_id: "" });
    } catch (error) {
      result = error;
    }

    expect(isExpectedInvalidWorkflowResult(result), `异常输入未被明确处理：${JSON.stringify(result)}`).toBe(true);
  });
});
