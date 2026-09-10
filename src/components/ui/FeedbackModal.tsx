"use client";

import { X } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FEEDBACK_BODY_MAX, FEEDBACK_CATEGORIES, type FeedbackCategory } from "@/lib/feedback";
import {
  gamePhaseOf,
  selectCollectedCount,
  selectRevisitedCount,
  useMemoryRoomStore,
} from "@/store/memory-room";
import {
  BACKDROP,
  BUTTON_PRIMARY,
  CHIP_BASE,
  CHIP_IDLE,
  CHIP_SELECTED,
  FOCUS_RING,
  PANEL_DARK,
} from "./ui-classes";

/** 성공은 상태로 남기지 않는다. 모달을 닫고 토스트로 알린 뒤 idle로 돌아간다. */
type SendState = "idle" | "sending" | "failed" | "unconfigured";

/** 토스트가 떠 있는 시간. 읽는 데 충분하고, 다음 조작을 가리기엔 짧게. */
const TOAST_MS = 3200;

/**
 * 진행 상태 요약: 버그 재현에 필요한 최소한만 자동으로 붙인다.
 * 개인정보가 아니라 게임 좌표다: 어디까지 왔고, 무슨 언어로, 어떤 화면에서.
 */
function buildMeta(language: string): string {
  const state = useMemoryRoomStore.getState();
  const parts = [
    `phase${gamePhaseOf(state)}`,
    `collected:${selectCollectedCount(state)}`,
    `revisited:${selectRevisitedCount(state)}`,
    `door:${state.doorOpened ? "open" : "closed"}`,
    `lang:${language}`,
    typeof window === "undefined" ? "" : `viewport:${window.innerWidth}x${window.innerHeight}`,
  ];
  return parts.filter(Boolean).join(" ");
}

/**
 * 피드백 모달. 접수는 /api/feedback이 구글 폼으로 넘긴다. 응답은 폼에 연결된
 * 스프레드시트에 쌓인다.
 *
 * 실패해도 본문을 지우지 않는다. 쓴 글이 날아가는 것이 이 폼의 최악이라,
 * 실패 문구 옆에 같은 내용으로 다시 보내는 길만 남긴다.
 */
export function FeedbackModal() {
  const { t, i18n } = useTranslation();
  const open = useMemoryRoomStore((state) => state.feedbackOpen);
  const setOpen = useMemoryRoomStore((state) => state.setFeedbackOpen);
  const setUiLock = useMemoryRoomStore((state) => state.setUiLock);
  const [category, setCategory] = useState<FeedbackCategory>("bug");
  const [body, setBody] = useState("");
  const [email, setEmail] = useState("");
  const [send, setSend] = useState<SendState>("idle");
  const [toastVisible, setToastVisible] = useState(false);

  useEffect(() => {
    if (!toastVisible) return;
    const timer = setTimeout(() => setToastVisible(false), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toastVisible]);

  useEffect(() => {
    setUiLock("feedback", open);
    return () => setUiLock("feedback", false);
  }, [open, setUiLock]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, setOpen]);

  const submit = async () => {
    if (send === "sending" || body.trim().length === 0) return;
    setSend("sending");
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, body, email, meta: buildMeta(i18n.language) }),
      });
      if (response.ok) {
        // 성공은 모달 안 문구가 아니라 토스트다. 닫힌 뒤에도 "갔다"가 보여야 한다
        setSend("idle");
        setBody("");
        setEmail("");
        setOpen(false);
        setToastVisible(true);
        return;
      }
      // 폼이 아직 연결 안 된 배포: 실패가 아니라 "준비 안 됨"으로 말한다
      setSend(response.status === 503 ? "unconfigured" : "failed");
    } catch {
      setSend("failed");
    }
  };

  return (
    <>
      {/* 모달이 닫힌 뒤에 뜨는 확인: 모달과 별개로 렌더해야 닫혀도 남는다 */}
      {toastVisible && (
        <div className="pointer-events-none absolute inset-x-0 bottom-10 z-50 flex justify-center">
          <p
            role="status"
            className={`animate-fade-rise px-4 py-2.5 text-sm font-medium ${PANEL_DARK}`}
          >
            {t("feedback.sent")}
          </p>
        </div>
      )}
      {open && (
        <div className="absolute inset-0 z-40 flex items-center justify-center overflow-hidden p-4">
          <button
            type="button"
            aria-label={t("feedback.close")}
            onClick={() => setOpen(false)}
            className={`cursor-pointer ${BACKDROP}`}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("feedback.title")}
            className={`relative w-full max-w-xl animate-fade-rise p-6 sm:p-8 ${PANEL_DARK}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="break-ko text-xl font-medium leading-snug text-ivory">
                  {t("feedback.title")}
                </h2>
                <p className="mt-1.5 break-ko text-pretty text-sm leading-normal text-fog">
                  {t("feedback.lead")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t("feedback.close")}
                className={`cursor-pointer text-fog transition-colors hover:text-ivory active:text-ivory/80 ${FOCUS_RING}`}
              >
                <X size={18} weight="bold" />
              </button>
            </div>

            <form
              className="mt-5 flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                void submit();
              }}
            >
              <fieldset className="flex gap-1.5">
                <legend className="sr-only">{t("feedback.categoryLabel")}</legend>
                {FEEDBACK_CATEGORIES.map((each) => (
                  <button
                    key={each}
                    type="button"
                    onClick={() => setCategory(each)}
                    aria-pressed={category === each}
                    className={`${CHIP_BASE} ${category === each ? CHIP_SELECTED : CHIP_IDLE}`}
                  >
                    {t(`feedback.category.${each}`)}
                  </button>
                ))}
              </fieldset>

              <div>
                <textarea
                  value={body}
                  onChange={(event) => setBody(event.target.value.slice(0, FEEDBACK_BODY_MAX))}
                  rows={5}
                  aria-label={t("feedback.bodyLabel")}
                  placeholder={t("feedback.bodyPlaceholder")}
                  className="w-full resize-none rounded-sm border border-line bg-night/40 px-3 py-2.5 text-sm leading-normal text-ivory outline-none transition-colors placeholder:text-ash focus-visible:border-memory"
                />
                <p className="mt-1 text-right text-xs tabular-nums text-ash">
                  {body.length} / {FEEDBACK_BODY_MAX}
                </p>
              </div>

              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-label={t("feedback.emailLabel")}
                placeholder={t("feedback.emailPlaceholder")}
                autoComplete="email"
                className="w-full rounded-sm border border-line bg-night/40 px-3 py-2 text-sm text-ivory outline-none transition-colors placeholder:text-ash focus-visible:border-memory"
              />

              <div className="flex items-center justify-between gap-3">
                {/* 결과는 한 줄로: sent만 초록 계열(memory) 없이 잉크로, 실패는 벽돌빛 */}
                <p
                  role="status"
                  className={`min-h-5 break-ko text-pretty text-xs ${
                    send === "failed" || send === "unconfigured"
                      ? "font-medium text-ember"
                      : "text-fog"
                  }`}
                >
                  {send === "failed" && t("feedback.failed")}
                  {send === "unconfigured" && t("feedback.unconfigured")}
                </p>
                <button
                  type="submit"
                  disabled={send === "sending" || body.trim().length === 0}
                  className={`${BUTTON_PRIMARY} shrink-0`}
                >
                  {t(send === "sending" ? "feedback.sending" : "feedback.submit")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
