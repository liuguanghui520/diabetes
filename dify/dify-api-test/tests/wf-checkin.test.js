import { describe, expect, it } from "vitest";
import { config } from "../src/config.js";
import { expectSucceededWorkflow, normalizeWorkflowOutput, runNamedWorkflow } from "./test-helpers.js";

const checkinInput = {
  user_id: config.testUserId,
  period_start: "2026-06-17",
  period_end: "2026-06-23"
};

describe("WF-CHECKIN 生活状态分析工作流", () => {
  it("生活状态分析工作流可以跑通并返回输出", async () => {
    const response = await runNamedWorkflow("checkin", checkinInput, checkinInput.user_id);
    expectSucceededWorkflow(response, "WF-CHECKIN");

    const output = normalizeWorkflowOutput(response, ["analysis", "result", "output"], "WF-CHECKIN");
    expect(output && typeof output).toBe("object");
    expect(JSON.stringify(output).length).toBeGreaterThan(10);
  });
});
