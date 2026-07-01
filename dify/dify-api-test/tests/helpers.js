import Ajv from "ajv";
import { expect } from "vitest";
import { buildDoctorInputs, sendChatMessage } from "../src/difyClient.js";
import { config } from "../src/config.js";
import { extractAnswer } from "../src/outputParser.js";
import { chatflowResponseSchema, forbiddenMedicalPhrases, offlineCareSignals } from "../src/schemas.js";

const ajv = new Ajv({ allErrors: true });
const validateChatflowResponse = ajv.compile(chatflowResponseSchema);

export function formatAjvErrors(errors) {
  return (errors || [])
    .map((error) => `${error.instancePath || "/"} ${error.message}`)
    .join("；");
}

export function expectValidChatflowResponse(response) {
  const valid = validateChatflowResponse(response);
  expect(valid, formatAjvErrors(validateChatflowResponse.errors)).toBe(true);
  expect(extractAnswer(response).length).toBeGreaterThan(0);
}

export function expectNoForbiddenMedicalPhrases(answer) {
  for (const phrase of forbiddenMedicalPhrases) {
    expect(answer.includes(phrase), `回复不应包含误导性医疗表述：${phrase}`).toBe(false);
  }
}

export function expectOfflineCareSuggestion(answer) {
  const matched = offlineCareSignals.some((signal) => answer.includes(signal));
  expect(matched, `高风险场景回复应包含线下就医/急诊/面诊类建议，实际回复：${answer}`).toBe(true);
}

export async function sendDoctorChat({
  query = config.testQuery,
  userId = config.testUserId,
  doctorId = config.testDoctorId,
  conversationId = ""
} = {}) {
  return sendChatMessage({
    query,
    inputs: buildDoctorInputs({ userId, doctorId }),
    user: String(userId),
    conversationId
  });
}

export function getUsage(response) {
  return response?.metadata?.usage || {};
}
