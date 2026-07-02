import { describe, expect, it } from "vitest";
import { config } from "../src/config.js";
import {
  expectJsonSchema,
  expectNoUnsafeMedicalText,
  expectSucceededWorkflow,
  isExplicitFailure,
  normalizeWorkflowOutput,
  runNamedWorkflow
} from "./test-helpers.js";

const reportSchema = {
  type: "object",
  required: ["status", "indicators", "summary", "advice", "confirm_required"],
  properties: {
    status: { type: "string", minLength: 1 },
    indicators: { type: "array" },
    summary: { type: "string", minLength: 1 },
    advice: { type: "array", items: { type: "string" } },
    confirm_required: { type: "boolean" }
  },
  additionalProperties: true
};

const reportTextInput = {
  user_id: config.testUserId,
  report_file_id: 0,
  report_text: "空腹血糖 6.4 mmol/L，糖化血红蛋白 6.1%，甘油三酯 2.1 mmol/L。"
};

describe("WF-REPORT 体检报告解读工作流", () => {
  it("纯文本报告生成待确认解读结果", async () => {
    const response = await runNamedWorkflow("report", reportTextInput, reportTextInput.user_id);
    expectSucceededWorkflow(response, "WF-REPORT");

    const output = normalizeWorkflowOutput(response, ["interpretation", "result", "output"], "WF-REPORT");
    expectJsonSchema(output, reportSchema, "WF-REPORT");
    expect(output.confirm_required).toBe(true);
    expectNoUnsafeMedicalText(output);
  });

  it("空报告文本且无文件时必须失败或返回明确错误", async () => {
    let result;
    try {
      result = await runNamedWorkflow("report", { ...reportTextInput, report_text: "" }, reportTextInput.user_id);
    } catch (error) {
      result = error;
    }

    expect(isExplicitFailure(result), `空报告不应静默成功：${JSON.stringify(result)}`).toBe(true);
  });
});
