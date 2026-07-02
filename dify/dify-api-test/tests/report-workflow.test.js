import { describe, expect, it } from "vitest";
import { config } from "../src/config.js";
import { runWorkflow } from "../src/difyClient.js";
import { reportInterpretationSchema } from "../src/workflowSchemas.js";
import {
  expectNoUnsafeWorkflowText,
  expectSchema,
  expectSucceededWorkflow,
  isExpectedInvalidWorkflowResult,
  normalizeWorkflowOutput
} from "./workflow-helpers.js";

const reportTextInput = {
  user_id: config.testUserId,
  report_file_id: 0,
  report_text: "空腹血糖 6.4 mmol/L，糖化血红蛋白 6.1%，甘油三酯 2.1 mmol/L。"
};

async function runReportWorkflow(inputs) {
  return runWorkflow({ appName: "report", inputs, user: String(inputs.user_id || config.testUserId) });
}

describe("WF-REPORT 体检报告解读工作流", () => {
  it("纯文本报告生成待确认解读结果", async () => {
    const response = await runReportWorkflow(reportTextInput);
    expectSucceededWorkflow(response);

    const output = normalizeWorkflowOutput(response, ["interpretation", "result", "output"]);
    expectSchema(output, reportInterpretationSchema, "WF-REPORT");
    expect(output.confirm_required).toBe(true);
    expectNoUnsafeWorkflowText(output);
  });

  it("空报告文本且无文件时应明确失败", async () => {
    let result;
    try {
      result = await runReportWorkflow({ ...reportTextInput, report_text: "" });
    } catch (error) {
      result = error;
    }

    expect(isExpectedInvalidWorkflowResult(result), `异常输入未被明确处理：${JSON.stringify(result)}`).toBe(true);
  });
});
