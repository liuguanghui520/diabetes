import Ajv from "ajv";
import { expect } from "vitest";
import { parseJsonOutput } from "../src/outputParser.js";
import { forbiddenWorkflowTextPatterns } from "../src/workflowSchemas.js";

const ajv = new Ajv({ allErrors: true });

export function compileSchema(schema) {
  return ajv.compile(schema);
}

export function formatAjvErrors(errors) {
  return (errors || [])
    .map((error) => `${error.instancePath || "/"} ${error.message}`)
    .join("；");
}

export function getWorkflowOutputs(response) {
  const outputs = response?.data?.outputs;
  if (!outputs || typeof outputs !== "object" || Array.isArray(outputs)) {
    throw new Error(`Dify Workflow 响应缺少 data.outputs：${JSON.stringify(response)}`);
  }
  return outputs;
}

export function normalizeWorkflowOutput(response, preferredFields = []) {
  const outputs = getWorkflowOutputs(response);

  for (const fieldName of preferredFields) {
    if (outputs[fieldName] !== undefined) {
      return parseJsonOutput(outputs[fieldName]);
    }
  }

  for (const value of Object.values(outputs)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value;
    }
    if (typeof value === "string") {
      try {
        return parseJsonOutput(value);
      } catch {
        // Keep scanning other fields.
      }
    }
  }

  return outputs;
}

export function expectSucceededWorkflow(response) {
  expect(response?.workflow_run_id, "响应应包含 workflow_run_id").toBeTruthy();
  expect(response?.data?.status, response?.data?.error || "Workflow 应执行成功").toBe("succeeded");
  expect(response?.data?.error).toBeFalsy();
}

export function expectSchema(output, schema, label) {
  const validate = compileSchema(schema);
  const valid = validate(output);
  expect(valid, `${label} Schema 校验失败：${formatAjvErrors(validate.errors)}`).toBe(true);
}

export function expectWarningText(text) {
  expect(typeof text).toBe("string");
  expect(text.trim().length).toBeGreaterThan(0);
}

export function expectNoUnsafeWorkflowText(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  for (const pattern of forbiddenWorkflowTextPatterns) {
    const matches = text.match(pattern);
    if (!matches) {
      continue;
    }

    const index = matches.index ?? 0;
    const context = text.slice(Math.max(0, index - 12), index + matches[0].length + 12);
    const isDisclaimer = /不|非|不是|不作为|不构成|不替代|不能|不开具/.test(context);
    expect(isDisclaimer, `输出存在疑似医疗边界风险表达：${context}`).toBe(true);
  }
}

export function isExpectedInvalidWorkflowResult(result) {
  if (result?.status && result.status >= 400) {
    return true;
  }

  if (result?.data?.status === "failed" || result?.data?.error) {
    return true;
  }

  const error = result?.data?.outputs?.error;
  if (typeof error === "string" && error.trim() !== "") {
    return true;
  }

  try {
    const output = normalizeWorkflowOutput(result);
    return output.ok === false || output.status === "failed" || Boolean(output.error);
  } catch {
    return false;
  }
}
