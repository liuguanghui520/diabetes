import { describe, expect, it } from "vitest";
import { config } from "../src/config.js";
import { runWorkflow } from "../src/difyClient.js";
import { riskAdviceSchema } from "../src/workflowSchemas.js";
import {
  expectNoUnsafeWorkflowText,
  expectSchema,
  expectSucceededWorkflow,
  expectWarningText,
  isExpectedInvalidWorkflowResult,
  normalizeWorkflowOutput
} from "./workflow-helpers.js";

const completeRiskInput = {
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

async function runRiskWorkflow(inputs) {
  return runWorkflow({ appName: "risk", inputs, user: String(inputs.user_id || config.testUserId) });
}

describe("WF-RISK 糖尿病风险建议工作流", () => {
  it("完整高风险评分生成结构化建议", async () => {
    const response = await runRiskWorkflow(completeRiskInput);
    expectSucceededWorkflow(response);

    const output = normalizeWorkflowOutput(response, ["advice", "result", "output"]);
    const normalized = output.advice ? output : { advice: output };

    expectSchema(normalized, riskAdviceSchema, "WF-RISK");
    expectWarningText(normalized.advice.warning);
    expectNoUnsafeWorkflowText(normalized);
  });

  it("已诊断糖尿病用户走疾病管理建议分支", async () => {
    const response = await runRiskWorkflow({
      ...completeRiskInput,
      diagnosed_diabetes: true,
      diabetes_type: "type2",
      risk_level: "diagnosed"
    });
    expectSucceededWorkflow(response);

    const output = normalizeWorkflowOutput(response, ["advice", "result", "output"]);
    const normalized = output.advice ? output : { advice: output };

    expectSchema(normalized, riskAdviceSchema, "WF-RISK diagnosed");
    expectNoUnsafeWorkflowText(normalized);
  });

  it("缺失 score_detail 时应明确失败或兜底", async () => {
    let result;
    try {
      result = await runRiskWorkflow({ ...completeRiskInput, score_detail: null });
    } catch (error) {
      result = error;
    }

    expect(isExpectedInvalidWorkflowResult(result), `异常输入未被明确处理：${JSON.stringify(result)}`).toBe(true);
  });
});
