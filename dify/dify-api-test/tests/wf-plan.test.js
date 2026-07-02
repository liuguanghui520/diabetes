import { describe, expect, it } from "vitest";
import { config } from "../src/config.js";
import {
  expectJsonSchema,
  expectMedicalDisclaimer,
  expectNoUnsafeMedicalText,
  expectSucceededWorkflow,
  isExplicitFailure,
  normalizeWorkflowOutput,
  runNamedWorkflow
} from "./test-helpers.js";

const planSchema = {
  type: "object",
  required: ["title", "summary", "sections", "tasks", "disclaimer"],
  properties: {
    title: { type: "string", minLength: 1 },
    summary: { type: "string", minLength: 1 },
    sections: { type: "array" },
    tasks: {
      type: "array",
      items: {
        type: "object",
        required: ["task_type", "title"],
        properties: {
          task_type: { enum: ["diet", "exercise", "water", "sleep", "glucose", "review"] },
          title: { type: "string", minLength: 1 }
        },
        additionalProperties: true
      }
    },
    disclaimer: { type: "string", minLength: 1 }
  },
  additionalProperties: true
};

const planInput = {
  user_id: config.testUserId,
  risk_assessment_id: 8891,
  preferences: {
    diet_preference: "喜欢吃面包",
    exercise_preference: "每天骑行 1 小时",
    sleep_issue: "工作原因需要熬夜",
    goal: "控糖和减重"
  }
};

describe("WF-PLAN 生活方案定制工作流", () => {
  it("根据用户上下文和偏好生成生活方案 JSON", async () => {
    const response = await runNamedWorkflow("plan", planInput, planInput.user_id);
    expectSucceededWorkflow(response, "WF-PLAN");

    const output = normalizeWorkflowOutput(response, ["plan", "result", "output"], "WF-PLAN");
    expectJsonSchema(output, planSchema, "WF-PLAN");
    expectMedicalDisclaimer(output.disclaimer);
    expectNoUnsafeMedicalText(output);
  });

  it("缺少 user_id 时必须失败或返回明确错误", async () => {
    let result;
    try {
      result = await runNamedWorkflow("plan", { ...planInput, user_id: "" }, config.testUserId);
    } catch (error) {
      result = error;
    }

    expect(isExplicitFailure(result), `user_id 缺失不应静默成功：${JSON.stringify(result)}`).toBe(true);
  });
});
