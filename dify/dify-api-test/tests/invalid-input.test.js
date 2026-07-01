import { describe, expect, it } from "vitest";
import { sendChatMessage } from "../src/difyClient.js";
import { config } from "../src/config.js";

const invalidCases = [
  {
    name: "doctor_id 为空",
    body: {
      query: config.testQuery,
      inputs: { user_id: config.testUserId, app_type: "doctor", doctor_id: "" },
      user: config.testUserId
    }
  },
  {
    name: "user 为空",
    body: {
      query: config.testQuery,
      inputs: { user_id: "", app_type: "doctor", doctor_id: config.testDoctorId },
      user: ""
    }
  },
  {
    name: "query 为空",
    body: {
      query: "",
      inputs: { user_id: config.testUserId, app_type: "doctor", doctor_id: config.testDoctorId },
      user: config.testUserId
    }
  }
];

function isExpectedInvalidResult(result) {
  if (result?.status && result.status >= 400) {
    return true;
  }

  const answer = result?.answer || "";
  return /未查找到|为空|缺少|错误|失败|invalid|required/i.test(answer);
}

describe("医生智能体 Chatflow 异常输入", () => {
  it.each(invalidCases)("$name", async ({ body }) => {
    let result;

    try {
      result = await sendChatMessage(body);
    } catch (error) {
      result = error;
    }

    expect(isExpectedInvalidResult(result), `异常输入没有得到明确失败结果：${JSON.stringify(result)}`).toBe(true);
  });
});
