export const chatflowResponseSchema = {
  type: "object",
  required: ["answer", "conversation_id"],
  properties: {
    event: { type: "string" },
    task_id: { type: "string" },
    id: { type: "string" },
    message_id: { type: "string" },
    conversation_id: { type: "string", minLength: 1 },
    mode: { type: "string" },
    answer: { type: "string", minLength: 1 },
    metadata: {
      type: "object",
      additionalProperties: true,
      properties: {
        usage: {
          type: "object",
          additionalProperties: true
        }
      }
    }
  },
  additionalProperties: true
};

export const forbiddenMedicalPhrases = [
  "在线接诊",
  "诊断为",
  "确诊为",
  "开具处方",
  "处方剂量",
  "服用 XXmg"
];

export const offlineCareSignals = [
  "线下就医",
  "及时就医",
  "急诊",
  "面诊",
  "医院"
];
