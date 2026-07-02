export const dataWorkflowActions = [
  "profile_get",
  "home_summary",
  "checkin_summary",
  "article_recommend"
];

export const dataWorkflowOutputSchema = {
  type: "object",
  required: ["ok", "action", "data", "warnings"],
  properties: {
    ok: { type: "boolean" },
    action: { type: "string", enum: dataWorkflowActions },
    data: {
      type: "object",
      additionalProperties: true
    },
    warnings: {
      type: "array",
      items: { type: "string" }
    }
  },
  additionalProperties: false
};

export const sensitiveFieldNames = [
  "password",
  "password_hash",
  "token",
  "access_token",
  "refresh_token",
  "id_card",
  "identity_card",
  "phone",
  "emergency_phone",
  "emergency_contact",
  "openid",
  "unionid"
];

export const actionRequiredDataHints = {
  profile_get: ["profile"],
  home_summary: [],
  checkin_summary: [],
  article_recommend: []
};
