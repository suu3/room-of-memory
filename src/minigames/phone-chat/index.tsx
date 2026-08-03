"use client";

import { PhoneDisconnect, X } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { playSound } from "@/lib/audio";
import type { MinigameProps } from "@/types/minigame";
import { useOnceCompleter } from "../shell";
import { PhoneShell } from "./PhoneShell";
import {
  type ChatMessage,
  hasEarlier,
  isThreadComplete,
  MISSED_CALLS,
  type PhoneTab,
  revealEarlier,
  totalMissedCalls,
  visibleMessages,
} from "./thread";

/** 지금 화면에서 뭘 하면 되는지 한 줄. 탭과 진행에 따라 바뀐다. */
function phoneHelpKey(tab: PhoneTab, chatDone: boolean, seenCalls: boolean) {
  if (tab === "calls") return "minigame.phoneChat.helpCallsTab" as const;
  if (chatDone && !seenCalls) return "minigame.phoneChat.helpCalls" as const;
  return "minigame.phoneChat.help" as const;
}

/** 폰을 집었을 때 화면에 남아 있던 만큼. 마지막 몇 줄만 보인다. */
const INITIAL_REVEALED = 2;

function Bubble({
  message,
  text,
  label,
}: {
  message: ChatMessage;
  /** 이미 번역된 본문 — 키가 아니라 화면에 찍을 문자열이다. */
  text: string;
  label: string;
}) {
  const mine = message.side === "me";
  return (
    <li className={`flex animate-fade-rise flex-col ${mine ? "items-end" : "items-start"}`}>
      {!mine && label ? (
        <span className="mb-1 px-1 text-[0.5625rem] font-bold tracking-wider text-bone/45">
          {label}
        </span>
      ) : null}
      <div className={`flex max-w-[82%] items-end gap-1 ${mine ? "flex-row-reverse" : ""}`}>
        <p
          className={`rounded-2xl px-2.5 py-1.5 text-[0.75rem] leading-relaxed ${
            mine
              ? "rounded-br-sm bg-memory text-scene-navy"
              : "rounded-bl-sm bg-scene-dusk text-paper"
          }`}
        >
          {text}
        </p>
        <span className="shrink-0 pb-0.5 text-[0.5rem] tabular-nums text-bone/35">
          {message.time}
        </span>
      </div>
    </li>
  );
}

/**
 * 스마트폰을 확대해 그날의 기록을 읽는다.
 *
 * 단톡방은 클릭(또는 Space/↓)으로 한 줄씩 내려가고, 부재중 전화 탭을 열면
 * 부모님이 몇 번 걸었는지 보인다. 둘 다 봐야 끝난다 — 한쪽만 보면 그날의
 * 절반만 본 셈이라. 실패 조건은 두지 않았다. 읽는 게 목적인 인터랙션이다.
 */
export function PhoneChatMinigame({ onComplete }: MinigameProps) {
  const { t } = useTranslation();
  const complete = useOnceCompleter(onComplete);
  const [tab, setTab] = useState<PhoneTab>("chat");
  const [revealed, setRevealed] = useState(INITIAL_REVEALED);
  const [seenCalls, setSeenCalls] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const chatDone = !hasEarlier(revealed);
  const done = isThreadComplete(revealed, seenCalls);

  /** 위로 한 줄 더 거슬러 올라간다. */
  const scrollBack = useCallback(() => {
    setRevealed((current) => {
      const next = revealEarlier(current);
      if (next !== current) playSound("flip");
      return next;
    });
  }, []);

  const openTab = useCallback((next: PhoneTab) => {
    playSound("select");
    setTab(next);
    if (next === "calls") setSeenCalls(true);
  }, []);

  // 위로 거슬러 올라가는 화면이라 시선은 늘 아래(최신)에 머문다. 새 줄은 위에
  // 붙으므로 바닥에 붙여두면 방금 읽던 줄이 그대로 있고 위쪽만 길어진다.
  // biome-ignore lint/correctness/useExhaustiveDependencies: revealed는 본문에서 읽지 않고 "줄이 늘었다"는 신호로만 쓴다.
  useEffect(() => {
    const node = scrollRef.current;
    if (!node || tab !== "chat") return;
    node.scrollTop = node.scrollHeight;
  }, [tab, revealed]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (tab !== "chat") return;
      if (event.code === "Space" || event.code === "ArrowUp" || event.code === "Enter") {
        event.preventDefault();
        scrollBack();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [scrollBack, tab]);

  const missedTotal = totalMissedCalls();

  return (
    <div className="flex animate-fade-rise flex-col items-center gap-4">
      <PhoneShell
        tab={tab}
        onTab={openTab}
        title={t(tab === "chat" ? "minigame.phoneChat.chat.room" : "minigame.phoneChat.callsTitle")}
        subtitle={t(
          tab === "chat" ? "minigame.phoneChat.chat.members" : "minigame.phoneChat.callsSubtitle",
        )}
        clock="20:47"
        badge={seenCalls ? 0 : missedTotal}
        tabLabels={{
          chat: t("minigame.phoneChat.tab.chat"),
          calls: t("minigame.phoneChat.tab.calls"),
        }}
      >
        {tab === "chat" ? (
          // 한 줄씩 붙는 대화창이라 role="log"가 맞는다 — 새 줄이 스크린리더에 읽힌다.
          // 클릭은 다음 줄 넘기기. 키보드 경로는 창 전역 핸들러와 아래 "다음" 버튼이 맡는다.
          <div
            ref={scrollRef}
            role="log"
            aria-label={t("minigame.phoneChat.chat.room")}
            onClick={scrollBack}
            onKeyDown={(event) => {
              if (event.code !== "Space" && event.code !== "Enter") return;
              event.preventDefault();
              scrollBack();
            }}
            // 휠을 위로 굴려도 과거가 열린다 — 실제 채팅앱과 같은 감각
            onWheel={(event) => {
              if (event.deltaY < 0) scrollBack();
            }}
            className="h-80 overflow-y-auto bg-scene-navy px-2.5 py-3 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-memory"
          >
            {/* 위로 더 있으면 그렇게 알려주고, 다 올라오면 날짜가 대화의 머리로 남는다 */}
            <p className="pb-3 text-center text-[0.5625rem] tracking-wider text-bone/35">
              {hasEarlier(revealed)
                ? t("minigame.phoneChat.olderAbove")
                : t("minigame.phoneChat.date")}
            </p>
            <ul className="flex flex-col gap-2">
              {visibleMessages(revealed).map((message) => (
                <Bubble
                  key={message.id}
                  message={message}
                  text={t(message.textKey)}
                  label={message.fromKey ? t(message.fromKey) : ""}
                />
              ))}
            </ul>
          </div>
        ) : (
          <div className="h-80 overflow-y-auto bg-scene-navy px-2.5 py-2">
            <ul className="flex flex-col">
              {MISSED_CALLS.map((call) => (
                <li
                  key={call.id}
                  className="flex animate-fade-rise items-center gap-2.5 border-b border-bone/8 px-1.5 py-2.5 last:border-b-0"
                >
                  <PhoneDisconnect size={16} weight="fill" className="shrink-0 text-ember" />
                  <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-bold text-ember">
                    {t(call.fromKey)}
                    {call.count > 1 ? (
                      <span className="ml-1 font-normal text-ember/65">({call.count})</span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-[0.6875rem] tabular-nums text-bone/40">
                    {call.time}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </PhoneShell>

      {/* 다 읽었을 때만 닫는 버튼이 뜬다. 그 전에 닫으면(바깥 클릭·Esc) 아무 일도
          없었던 것처럼 다시 열 수 있다 — 방탈출 탐색이라 되돌아올 수 있어야 한다. */}
      <div className="flex h-8 items-center gap-3">
        {done ? (
          <button
            type="button"
            onClick={() => complete({ cleared: true })}
            className="flex cursor-pointer items-center gap-1.5 rounded-full bg-paper px-5 py-1.5 text-xs font-bold tracking-widest text-ink transition-all hover:-translate-y-0.5 active:translate-y-0"
          >
            <X size={13} weight="bold" />
            {t("minigame.phoneChat.close")}
          </button>
        ) : (
          <p className="text-xs tracking-widest text-bone/50">
            {t(phoneHelpKey(tab, chatDone, seenCalls))}
          </p>
        )}
      </div>
    </div>
  );
}
