import { describe, expect, it } from "vitest";
import { config } from "../src/config.js";
import { expectSucceededWorkflow, normalizeWorkflowOutput, runNamedWorkflow } from "./test-helpers.js";

const riskInput = {
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
  // 当前发布态 Start 节点把这两个字段配置为 json_object，按发布态传参即可。
  missing_fields: { items: [] },
  past_history: { items: ["心血管疾病"] },
  labs: {
    fasting_glucose: null,
    postprandial_glucose: null,
    hba1c: null
  }
};

describe("WF-RISK 糖尿病风险建议工作流", () => {
  it("风险建议工作流可以跑通并返回输出", async () => {
    const response = await runNamedWorkflow("risk", riskInput, riskInput.user_id);
    expectSucceededWorkflow(response, "WF-RISK");

    const output = normalizeWorkflowOutput(response, ["advice", "result", "output"], "WF-RISK");
    expect(output && typeof output).toBe("object");
    expect(JSON.stringify(output).length).toBeGreaterThan(20);
  });
});
