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

const riskAdviceSchema = {
  type: "object",
  required: ["advice"],
  properties: {
    advice: {
      type: "object",
      required: ["summary", "diet", "exercise", "review", "warning"],
      properties: {
        summary: { type: "string", minLength: 1 },
        diet: { type: "array", items: { type: "string" } },
        exercise: { type: "array", items: { type: "string" } },
        review: { type: "array", items: { type: "string" } },
        warning: { type: "string", minLength: 1 }
      },
      additionalProperties: true
    }
  },
  additionalProperties: true
};

const baseRiskInput = {
  user_id: config.testUserId,
  assessment_id: 10,
  diagnosed_diabetes: false,
  diabetes_type: null,
  score_status: "complete",
  score_rule_version: "cdrs_2024_v1",
  age: 65,
  gender: "male",
  height_cm: 170,
  weight_kg: 85,
  waist_cm: 85,
  sbp_mm_hg: 110,
  family_history_diabetes: true,
  bmi: 29.41,
  score: 37,
  risk_level: "high",
  is_high_risk: true,
  score_detail: {
    age: 18,
    bmi: 3,
    family_history: 6,
    gender: 2,
    waist: 7,
    sbp: 1
  },
  missing_fields: [],
  past_history: ["心血管疾病"],
  labs: {
    fasting_glucose: null,
    postprandial_glucose: null,
    hba1c: null
  }
};

function normalizeRiskAdvice(response) {
  const output = normalizeWorkflowOutput(response, ["advice", "result", "output"], "WF-RISK");
  return output.advice ? output : { advice: output };
}

describe("WF-RISK 糖尿病风险建议工作流", () => {
  it("完整评分输入生成结构化风险建议，不重新覆盖评分字段", async () => {
    const response = await runNamedWorkflow("risk", baseRiskInput, baseRiskInput.user_id);
    expectSucceededWorkflow(response, "WF-RISK complete");

    const output = normalizeRiskAdvice(response);
    expectJsonSchema(output, riskAdviceSchema, "WF-RISK complete");
    expectMedicalDisclaimer(output.advice.warning);
    expectNoUnsafeMedicalText(output);
    expect(JSON.stringify(output)).not.toContain('"score":');
    expect(JSON.stringify(output)).not.toContain('"score_detail":');
  });

  it("已诊断糖尿病用户走疾病管理建议分支", async () => {
    const response = await runNamedWorkflow(
      "risk",
      {
        ...baseRiskInput,
        diagnosed_diabetes: true,
        diabetes_type: "type2",
        risk_level: "diagnosed"
      },
      baseRiskInput.user_id
    );

    expectSucceededWorkflow(response, "WF-RISK diagnosed");
    const output = normalizeRiskAdvice(response);
    expectJsonSchema(output, riskAdviceSchema, "WF-RISK diagnosed");
    expectNoUnsafeMedicalText(output);
  });

  it("缺少 score_detail 时必须失败或返回明确错误", async () => {
    let result;
    try {
      result = await runNamedWorkflow("risk", { ...baseRiskInput, score_detail: null }, baseRiskInput.user_id);
    } catch (error) {
      result = error;
    }

    expect(isExplicitFailure(result), `score_detail 缺失不应静默成功：${JSON.stringify(result)}`).toBe(true);
  });
});
