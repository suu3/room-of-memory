/**
 * 피드백 제출의 순수 로직: 검증과 구글 폼 페이로드 조립.
 *
 * 라우트 핸들러(src/app/api/feedback/route.ts)는 이걸 얇게 감싸기만 한다.
 * 서버 없이는 테스트하기 어려운 부분(fetch)과 순수한 부분(여기)을 갈라 둬야
 * 검증 규칙을 jsdom 없이 돌릴 수 있다.
 */

export const FEEDBACK_CATEGORIES = ["bug", "idea", "other"] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

/** 본문 상한. 구글 폼 장문 답변 한도보다 훨씬 안쪽: 이걸 넘기면 글이 아니라 덤프다. */
export const FEEDBACK_BODY_MAX = 2000;
export const FEEDBACK_EMAIL_MAX = 200;
export const FEEDBACK_META_MAX = 500;

export interface FeedbackPayload {
  category: FeedbackCategory;
  body: string;
  email: string;
  /** 게임 진행·언어·화면 크기 등 재현에 필요한 최소한: 클라이언트가 조립한다. */
  meta: string;
}

/**
 * 제출을 걸러낸다. 실패면 이유 키를 돌려준다. 라우트는 400에 이 키를 실어
 * 보내고, 클라이언트는 그걸 i18n 키로 바꿔 보여준다.
 */
export function validateFeedback(
  raw: unknown,
): { ok: true; payload: FeedbackPayload } | { ok: false; reason: string } {
  if (typeof raw !== "object" || raw === null) return { ok: false, reason: "malformed" };
  const input = raw as Record<string, unknown>;

  const body = typeof input.body === "string" ? input.body.trim() : "";
  if (body.length === 0) return { ok: false, reason: "empty" };
  if (body.length > FEEDBACK_BODY_MAX) return { ok: false, reason: "tooLong" };

  const category = FEEDBACK_CATEGORIES.includes(input.category as FeedbackCategory)
    ? (input.category as FeedbackCategory)
    : "other";

  const email =
    typeof input.email === "string" ? input.email.trim().slice(0, FEEDBACK_EMAIL_MAX) : "";
  const meta = typeof input.meta === "string" ? input.meta.slice(0, FEEDBACK_META_MAX) : "";

  return { ok: true, payload: { category, body, email, meta } };
}

/** 구글 폼 질문 id 묶음. 값은 전부 `entry.숫자` 형태다 (폼의 미리 채운 링크에서 뽑는다). */
export interface FeedbackFormConfig {
  formId: string;
  entryCategory: string;
  entryBody: string;
  entryEmail: string;
  entryMeta: string;
}

/**
 * entry id 표기 정규화: `entry.123`도 `123`도 받는다.
 *
 * 미리 채워진 링크에는 `entry.숫자`로 적히지만, 사람이 옮겨 적을 때 숫자만
 * 남기기 쉽다. 형식이 둘 다 아니면 null: 잘못 적힌 채로 구글에 보내면
 * 200이 오면서 데이터만 조용히 버려지는 게 이 연동의 함정이라, 알아볼 수
 * 있는 오류는 여기서 막는다.
 */
function normalizeEntryId(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^entry\.\d+$/.test(trimmed)) return trimmed;
  if (/^\d+$/.test(trimmed)) return `entry.${trimmed}`;
  return null;
}

/** env에서 폼 설정을 읽는다. 하나라도 비거나 형식이 어긋나면 null: 라우트가 503으로 알린다. */
export function readFormConfig(env: Record<string, string | undefined>): FeedbackFormConfig | null {
  const formId = env.FEEDBACK_GOOGLE_FORM_ID?.trim();
  const entryCategory = normalizeEntryId(env.FEEDBACK_ENTRY_CATEGORY);
  const entryBody = normalizeEntryId(env.FEEDBACK_ENTRY_BODY);
  const entryEmail = normalizeEntryId(env.FEEDBACK_ENTRY_EMAIL);
  const entryMeta = normalizeEntryId(env.FEEDBACK_ENTRY_META);
  if (!formId || !entryCategory || !entryBody || !entryEmail || !entryMeta) return null;
  return { formId, entryCategory, entryBody, entryEmail, entryMeta };
}

/** 구글 폼 formResponse 주소. */
export function formResponseUrl(config: FeedbackFormConfig): string {
  return `https://docs.google.com/forms/d/e/${config.formId}/formResponse`;
}

/** 폼 제출 본문. 빈 이메일도 그대로 보낸다. 구글 폼 쪽 질문이 선택이면 문제없다. */
export function buildFormBody(
  config: FeedbackFormConfig,
  payload: FeedbackPayload,
): URLSearchParams {
  return new URLSearchParams({
    [config.entryCategory]: payload.category,
    [config.entryBody]: payload.body,
    [config.entryEmail]: payload.email,
    [config.entryMeta]: payload.meta,
  });
}
