import { describe, expect, it } from "vitest";
import { config } from "../src/config.js";
import { expectSucceededWorkflow, normalizeWorkflowOutput, runNamedWorkflow } from "./test-helpers.js";

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

describe("WF-PLAN 生活方案定制工作流", () => {
  it("生活方案工作流可以跑通并返回输出", async () => {
    const response = await runNamedWorkflow("plan", planInput, planInput.user_id);
    expectSucceededWorkflow(response, "WF-PLAN");

    const output = normalizeWorkflowOutput(response, ["plan", "result", "output"], "WF-PLAN");
    expect(output && typeof output).toBe("object");
    expect(JSON.stringify(output).length).toBeGreaterThan(20);
  });
});
