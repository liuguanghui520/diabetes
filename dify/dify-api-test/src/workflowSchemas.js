export const riskAdviceSchema = {
  type: "object",
  required: ["advice"],
  properties: {
    advice: {
      type: "object",
      required: ["summary", "diet", "exercise", "review", "warning"],
      properties: {
        summary: { type: "string", minLength: 1 },
        diet: { type: "array", items: { type: "string" } },
        exercise: { type: "array", items: { type: "string" } },
        review: { type: "array", items: { type: "string" } },
        warning: { type: "string", minLength: 1 }
      },
      additionalProperties: true
    }
  },
  additionalProperties: true
};

export const planSchema = {
  type: "object",
  required: ["title", "summary", "sections", "tasks", "disclaimer"],
  properties: {
    title: { type: "string", minLength: 1 },
    summary: { type: "string", minLength: 1 },
    sections: {
      type: "array",
      items: {
        type: "object",
        required: ["type", "title", "items"],
        properties: {
          type: { type: "string", minLength: 1 },
          title: { type: "string", minLength: 1 },
          items: { type: "array" }
        },
        additionalProperties: true
      }
    },
    tasks: {
      type: "array",
      items: {
        type: "object",
        required: ["task_type", "title"],
        properties: {
          task_type: {
            type: "string",
            enum: ["diet", "exercise", "water", "sleep", "glucose", "review"]
          },
          title: { type: "string", minLength: 1 }
        },
        additionalProperties: true
      }
    },
    disclaimer: { type: "string", minLength: 1 }
  },
  additionalProperties: true
};

export const checkinAnalysisSchema = {
  type: "object",
  required: ["completion_rate", "metrics", "evaluation", "improvements"],
  properties: {
    completion_rate: { type: "number", minimum: 0, maximum: 100 },
    metrics: { type: "object", additionalProperties: true },
    evaluation: { type: "string", minLength: 1 },
    improvements: {
      type: "array",
      items: { type: "string" }
    }
  },
  additionalProperties: true
};

export const reportInterpretationSchema = {
  type: "object",
  required: ["status", "indicators", "summary", "advice", "confirm_required"],
  properties: {
    status: { type: "string", minLength: 1 },
    indicators: {
      type: "array",
      items: {
        type: "object",
        required: ["name", "value", "unit", "status", "explanation"],
        properties: {
          name: { type: "string", minLength: 1 },
          value: {},
          unit: { type: "string" },
          status: { type: "string" },
          explanation: { type: "string" }
        },
        additionalProperties: true
      }
    },
    summary: { type: "string", minLength: 1 },
    advice: { type: "array", items: { type: "string" } },
    confirm_required: { type: "boolean" }
  },
  additionalProperties: true
};

export const newsRecommendationSchema = {
  type: "object",
  required: ["articles"],
  properties: {
    articles: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "title"],
        properties: {
          id: {},
          title: { type: "string", minLength: 1 },
          reason: { type: "string" }
        },
        additionalProperties: true
      }
    }
  },
  additionalProperties: true
};

export const forbiddenWorkflowTextPatterns = [
  /诊断为/,
  /确诊为/,
  /在线接诊/,
  /开具处方/,
  /处方剂量/
];
