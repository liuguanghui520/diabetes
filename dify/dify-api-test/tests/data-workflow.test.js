import Ajv from "ajv";
import { describe, expect, it } from "vitest";
import { config } from "../src/config.js";
import { runWorkflow } from "../src/difyClient.js";
import { parseJsonOutput } from "../src/outputParser.js";
import {
  actionRequiredDataHints,
  dataWorkflowOutputSchema,
  sensitiveFieldNames
} from "../src/dataWorkflowSchemas.js";

const ajv = new Ajv({ allErrors: true });
const validateDataWorkflowOutput = ajv.compile(dataWorkflowOutputSchema);

function formatAjvErrors(errors) {
  return (errors || [])
    .map((error) => `${error.instancePath || "/"} ${error.message}`)
    .join("；");
}

function getWorkflowOutputs(response) {
  const outputs = response?.data?.outputs;
  if (!outputs || typeof outputs !== "object" || Array.isArray(outputs)) {
    throw new Error(`Dify Workflow 响应缺少 data.outputs：${JSON.stringify(response)}`);
  }
  return outputs;
}

function normalizeDataWorkflowOutput(response) {
  const outputs = getWorkflowOutputs(response);

  if (
    typeof outputs.ok === "boolean" &&
    typeof outputs.action === "string" &&
    outputs.data &&
    typeof outputs.data === "object" &&
    Array.isArray(outputs.warnings)
  ) {
    return outputs;
  }

  for (const value of Object.values(outputs)) {
    if (typeof value === "string" || (value && typeof value === "object" && !Array.isArray(value))) {
      try {
        const parsed = parseJsonOutput(value);
        if (typeof parsed.ok === "boolean" && typeof parsed.action === "string") {
          return parsed;
        }
      } catch {
        // Some workflow output fields are plain strings. Keep scanning other fields.
      }
    }
  }

  throw new Error(`无法从 data.outputs 中解析 WF-DATA 输出：${JSON.stringify(outputs)}`);
}

function collectSensitiveFields(value, path = "$", hits = []) {
  if (!value || typeof value !== "object") {
    return hits;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => collectSensitiveFields(item, `${path}[${index}]`, hits));
    return hits;
  }

  for (const [key, childValue] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (sensitiveFieldNames.includes(key.toLowerCase())) {
      hits.push(childPath);
    }
    collectSensitiveFields(childValue, childPath, hits);
  }

  return hits;
}

function expectValidDataWorkflowOutput(output, expectedAction) {
  const valid = validateDataWorkflowOutput(output);
  expect(valid, formatAjvErrors(validateDataWorkflowOutput.errors)).toBe(true);
  expect(output.ok).toBe(true);
  expect(output.action).toBe(expectedAction);
  expect(Array.isArray(output.warnings)).toBe(true);

  const sensitiveHits = collectSensitiveFields(output.data);
  expect(sensitiveHits, `输出 data 中不应包含敏感字段：${sensitiveHits.join(", ")}`).toEqual([]);
}

function expectActionDataShape(output) {
  const requiredHints = actionRequiredDataHints[output.action] || [];
  for (const fieldName of requiredHints) {
    expect(output.data, `${output.action} 输出 data 应包含 ${fieldName}`).toHaveProperty(fieldName);
  }

  if (output.action === "article_recommend") {
    const articleList = output.data.articles || output.data.items;
    expect(Array.isArray(articleList), "article_recommend 输出 data 应包含 articles 或 items 数组").toBe(true);
  }
}

async function runDataWorkflow(inputs) {
  return runWorkflow({
    appName: "data",
    inputs,
    user: String(inputs.user_id || config.testUserId)
  });
}

const normalCases = [
  {
    name: "profile_get 组装用户上下文",
    inputs: {
      action: "profile_get",
      user_id: config.testUserId,
      params: {
        include_latest_risk: true,
        include_latest_plan: true
      }
    }
  },
  {
    name: "home_summary 获取首页摘要",
    inputs: {
      action: "home_summary",
      user_id: config.testUserId,
      params: {}
    }
  },
  {
    name: "checkin_summary 获取打卡摘要",
    inputs: {
      action: "checkin_summary",
      user_id: config.testUserId,
      params: {
        period_days: 7
      }
    }
  },
  {
    name: "article_recommend 获取文章候选集",
    inputs: {
      action: "article_recommend",
      user_id: config.testUserId,
      params: {
        scene: "home_recommend",
        limit: 5,
        category: null
      }
    }
  }
];

const invalidCases = [
  {
    name: "action 为空",
    inputs: {
      action: "",
      user_id: config.testUserId,
      params: {}
    }
  },
  {
    name: "action 非白名单",
    inputs: {
      action: "delete_user",
      user_id: config.testUserId,
      params: {}
    }
  },
  {
    name: "user_id 为空",
    inputs: {
      action: "profile_get",
      user_id: "",
      params: {}
    }
  },
  {
    name: "params 类型错误",
    inputs: {
      action: "profile_get",
      user_id: config.testUserId,
      params: "include_latest_risk=true"
    }
  },
  {
    name: "params 包含非法字段",
    inputs: {
      action: "profile_get",
      user_id: config.testUserId,
      params: {
        include_latest_risk: true,
        sql: "drop table sys_user",
        password: "should-not-pass"
      }
    }
  }
];

function isExpectedInvalidResult(result) {
  if (result?.status && result.status >= 400) {
    return true;
  }

  const directError = result?.data?.outputs?.error;
  if (typeof directError === "string" && directError.trim() !== "") {
    return true;
  }

  try {
    const output = normalizeDataWorkflowOutput(result);
    return output.ok === false || output.warnings.length > 0;
  } catch {
    return result?.data?.status === "failed" || Boolean(result?.data?.error);
  }
}

describe("WF-DATA 数据上下文工作流", () => {
  it.each(normalCases)("$name", async ({ inputs }) => {
    const response = await runDataWorkflow(inputs);
    expect(response?.workflow_run_id, "响应应包含 workflow_run_id").toBeTruthy();
    expect(response?.data?.status).toBe("succeeded");

    const output = normalizeDataWorkflowOutput(response);
    expectValidDataWorkflowOutput(output, inputs.action);
    expectActionDataShape(output);
  });

  it.each(invalidCases)("$name", async ({ inputs }) => {
    let result;
    try {
      result = await runDataWorkflow(inputs);
    } catch (error) {
      result = error;
    }

    expect(isExpectedInvalidResult(result), `异常输入没有得到明确失败或警告：${JSON.stringify(result)}`).toBe(true);
  });
});
