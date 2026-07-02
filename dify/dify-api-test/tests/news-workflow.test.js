import { describe, expect, it } from "vitest";
import { config } from "../src/config.js";
import { runWorkflow } from "../src/difyClient.js";
import { newsRecommendationSchema } from "../src/workflowSchemas.js";
import {
  expectSchema,
  expectSucceededWorkflow,
  isExpectedInvalidWorkflowResult,
  normalizeWorkflowOutput
} from "./workflow-helpers.js";

const newsInput = {
  scene: "home_recommend",
  user_id: config.testUserId,
  limit: 5,
  category: null
};

async function runNewsWorkflow(inputs) {
  return runWorkflow({ appName: "data", inputs: { action: "article_recommend", user_id: inputs.user_id, params: inputs }, user: String(inputs.user_id || config.testUserId) });
}

describe("WF-NEWS 健康资讯推荐工作流", () => {
  it("返回文章推荐列表和可解释理由", async () => {
    const response = await runNewsWorkflow(newsInput);
    expectSucceededWorkflow(response);

    const dataOutput = normalizeWorkflowOutput(response, ["articles", "result", "output"]);
    const articles = dataOutput.articles || dataOutput.data?.articles || dataOutput.data?.items || dataOutput.items;
    const output = { articles: articles || [] };

    expectSchema(output, newsRecommendationSchema, "WF-NEWS");
    expect(output.articles.length).toBeLessThanOrEqual(newsInput.limit);
  });

  it("非法 limit 应明确失败或给出警告", async () => {
    let result;
    try {
      result = await runNewsWorkflow({ ...newsInput, limit: -1 });
    } catch (error) {
      result = error;
    }

    expect(isExpectedInvalidWorkflowResult(result), `异常输入未被明确处理：${JSON.stringify(result)}`).toBe(true);
  });
});
