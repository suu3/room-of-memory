import { describe, expect, it } from "vitest";
import {
  buildFormBody,
  FEEDBACK_BODY_MAX,
  type FeedbackFormConfig,
  formResponseUrl,
  readFormConfig,
  validateFeedback,
} from "./feedback";

const CONFIG: FeedbackFormConfig = {
  formId: "1FAIpQLSe-example",
  entryCategory: "entry.111",
  entryBody: "entry.222",
  entryEmail: "entry.333",
  entryMeta: "entry.444",
};

describe("validateFeedback", () => {
  it("본문만 있으면 통과하고, 나머지는 기본값으로 채운다", () => {
    const result = validateFeedback({ body: "문이 안 열려요" });

    expect(result).toEqual({
      ok: true,
      payload: { category: "other", body: "문이 안 열려요", email: "", meta: "" },
    });
  });

  it("빈 본문과 공백 본문을 거른다", () => {
    expect(validateFeedback({ body: "" })).toEqual({ ok: false, reason: "empty" });
    expect(validateFeedback({ body: "   " })).toEqual({ ok: false, reason: "empty" });
    expect(validateFeedback(null)).toEqual({ ok: false, reason: "malformed" });
  });

  it("상한을 넘는 본문을 거른다 — 자르지 않는다, 쓴 사람이 알아야 한다", () => {
    const result = validateFeedback({ body: "가".repeat(FEEDBACK_BODY_MAX + 1) });

    expect(result).toEqual({ ok: false, reason: "tooLong" });
  });

  it("모르는 유형은 other로 넘어진다", () => {
    const result = validateFeedback({ body: "x", category: "praise" });

    expect(result.ok && result.payload.category).toBe("other");
  });
});

describe("readFormConfig", () => {
  it("다섯 값이 다 있어야 설정이 선다", () => {
    expect(
      readFormConfig({
        FEEDBACK_GOOGLE_FORM_ID: CONFIG.formId,
        FEEDBACK_ENTRY_CATEGORY: CONFIG.entryCategory,
        FEEDBACK_ENTRY_BODY: CONFIG.entryBody,
        FEEDBACK_ENTRY_EMAIL: CONFIG.entryEmail,
        FEEDBACK_ENTRY_META: CONFIG.entryMeta,
      }),
    ).toEqual(CONFIG);
    // 하나라도 빠지면 null — 라우트가 503으로 "아직 준비 안 됨"을 말한다
    expect(readFormConfig({ FEEDBACK_GOOGLE_FORM_ID: CONFIG.formId })).toBeNull();
    expect(readFormConfig({})).toBeNull();
  });

  it("entry. 접두사 없이 숫자만 적어도 받아준다", () => {
    // 미리 채워진 링크에서 옮겨 적다 보면 숫자만 남기기 쉽다 — 사람의 실수는 코드가 받는다
    const result = readFormConfig({
      FEEDBACK_GOOGLE_FORM_ID: CONFIG.formId,
      FEEDBACK_ENTRY_CATEGORY: "111",
      FEEDBACK_ENTRY_BODY: "222",
      FEEDBACK_ENTRY_EMAIL: "333",
      FEEDBACK_ENTRY_META: "444",
    });

    expect(result).toEqual(CONFIG);
  });

  it("숫자도 entry.N도 아닌 값은 설정 실패다 — 조용히 버려지느니 503이 낫다", () => {
    expect(
      readFormConfig({
        FEEDBACK_GOOGLE_FORM_ID: CONFIG.formId,
        FEEDBACK_ENTRY_CATEGORY: "https://docs.google.com/...",
        FEEDBACK_ENTRY_BODY: "222",
        FEEDBACK_ENTRY_EMAIL: "333",
        FEEDBACK_ENTRY_META: "444",
      }),
    ).toBeNull();
  });
});

describe("구글 폼 페이로드", () => {
  it("formResponse 주소와 entry 매핑이 폼 규격대로 선다", () => {
    expect(formResponseUrl(CONFIG)).toBe(
      "https://docs.google.com/forms/d/e/1FAIpQLSe-example/formResponse",
    );

    const body = buildFormBody(CONFIG, {
      category: "bug",
      body: "문이 안 열려요",
      email: "a@b.c",
      meta: "phase2",
    });
    expect(body.get("entry.111")).toBe("bug");
    expect(body.get("entry.222")).toBe("문이 안 열려요");
    expect(body.get("entry.333")).toBe("a@b.c");
    expect(body.get("entry.444")).toBe("phase2");
  });
});
