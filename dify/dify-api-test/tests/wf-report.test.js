import { describe, expect, it } from "vitest";
import { config } from "../src/config.js";
import { runNamedWorkflow } from "./test-helpers.js";

const reportTextInput = {
  user_id: config.testUserId,
  report_file_id: 0,
  report_text: "空腹血糖 6.4 mmol/L，糖化血红蛋白 6.1%，甘油三酯 2.1 mmol/L。"
};

describe("WF-REPORT 体检报告解读工作流", () => {
  it("发布态 Service API 对缺少文件的纯文本请求给出明确参数错误", async () => {
    let result;
    try {
      result = await runNamedWorkflow("report", reportTextInput, reportTextInput.user_id);
    } catch (error) {
      result = error;
    }

    expect(result?.status).toBe(400);
    expect(JSON.stringify(result?.responseData || {})).toContain("file is required");
  });
});
