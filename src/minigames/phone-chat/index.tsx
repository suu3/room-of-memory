"use client";

import { Check, PhoneDisconnect } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useControlHint } from "@/i18n/control-hint";
import { playSound } from "@/lib/audio";
import type { MinigameProps } from "@/types/minigame";
import { useOnceCompleter } from "../shell";
import { PhoneShell } from "./PhoneShell";
import {
  type ChatMessage,
  hasLater,
  isThreadComplete,
  OUTGOING_CALLS,
  type PhoneTab,
  revealNext,
  totalOutgoingCalls,
  visibleMessages,
} from "./thread";

/**
 * 지금 화면에서 뭘 하면 되는지 한 줄. 탭과 진행에 따라 바뀐다.
 *
 * 통화 기록 탭에서는 아무 말도 하지 않는다(null). 안내를 붙일 자리가 아니다 —
 * 화면에 안 받은 전화가 줄줄이 떠 있는 것으로 이미 다 말했고, 거기에 한 줄을
 * 더 얹으면 화자가 플레이어를 부르는 것처럼 읽혀서 톤이 어긋난다.
 */
function phoneHelpKey(tab: PhoneTab, chatDone: boolean, seenCalls: boolean) {
  if (tab === "calls") return null;
  if (chatDone && !seenCalls) return "minigame.phoneChat.helpCalls" as const;
  return "minigame.phoneChat.help" as const;
}

/** 폰을 열었을 때 이미 펼쳐져 있는 만큼. 대화의 첫 몇 줄만 보인다. */
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
        <span className="mb-1 px-1 text-[0.6875rem] font-bold tracking-wider text-bone/45">
          {label}
        </span>
      ) : null}
      <div className={`flex max-w-[82%] items-end gap-1.5 ${mine ? "flex-row-reverse" : ""}`}>
        <p
          className={`break-ko text-pretty rounded-2xl px-3 py-2 text-[0.875rem] leading-relaxed ${
            mine
              ? "rounded-br-sm bg-memory text-scene-navy"
              : "rounded-bl-sm bg-scene-dusk text-paper"
          }`}
        >
          {text}
        </p>
        {/* 안읽음 수가 시각 위에 선다 — 줄어들지 않는 이 숫자가 이 화면의 화자다 */}
        <span
          className={`flex shrink-0 flex-col pb-1 text-[0.625rem] tabular-nums ${
            mine ? "items-end" : "items-start"
          }`}
        >
          {message.unread ? <span className="font-bold text-memory">{message.unread}</span> : null}
          <span className="text-bone/35">{message.time}</span>
        </span>
      </div>
    </li>
  );
}

/**
 * 스마트폰을 확대해 그날의 기록을 읽는다.
 *
 * 단톡방은 클릭(또는 Space/↓)으로 첫 줄부터 한 줄씩 읽어 내려가고, 통화 기록
 * 탭을 열면 도해가 누구에게 몇 번이나 걸었는지 보인다. 둘 다 봐야 끝난다 —
 * 한쪽만 보면 그날의 절반만 본 셈이라. 실패 조건은 두지 않았다. 읽는 게 목적인
 * 인터랙션이다.
 */
export function PhoneChatMinigame({ onComplete }: MinigameProps) {
  const { t } = useTranslation();
  const hint = useControlHint();
  const complete = useOnceCompleter(onComplete);
  const [tab, setTab] = useState<PhoneTab>("chat");
  const [revealed, setRevealed] = useState(INITIAL_REVEALED);
  const [seenCalls, setSeenCalls] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const chatDone = !hasLater(revealed);
  const done = isThreadComplete(revealed, seenCalls);
  const helpKey = phoneHelpKey(tab, chatDone, seenCalls);

  /** 아래로 한 줄 더 읽어 내려간다. */
  const readNext = useCallback(() => {
    setRevealed((current) => {
      const next = revealNext(current);
      // 한 줄 내려갈 때마다 그때 울렸을 알림음이 한 번씩 다시 울린다.
      if (next !== current) playSound("phoneBeep", { variation: 0.04 });
      return next;
    });
  }, []);

  const openTab = useCallback((next: PhoneTab) => {
    playSound("select");
    setTab(next);
    if (next === "calls") setSeenCalls(true);
  }, []);

  // 새 줄이 아래에 붙는 화면이라 방금 열린 줄이 보이려면 바닥을 따라가야 한다 —
  // 실제 채팅앱이 새 메시지에 붙는 것과 같은 감각.
  // biome-ignore lint/correctness/useExhaustiveDependencies: revealed는 본문에서 읽지 않고 "줄이 늘었다"는 신호로만 쓴다.
  useEffect(() => {
    const node = scrollRef.current;
    if (!node || tab !== "chat") return;
    node.scrollTop = node.scrollHeight;
  }, [tab, revealed]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (tab !== "chat") return;
      if (event.code === "Space" || event.code === "ArrowDown" || event.code === "Enter") {
        event.preventDefault();
        readNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [readNext, tab]);

  const callTotal = totalOutgoingCalls();

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
        badge={seenCalls ? 0 : callTotal}
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
            onClick={readNext}
            onKeyDown={(event) => {
              if (event.code !== "Space" && event.code !== "Enter") return;
              event.preventDefault();
              readNext();
            }}
            // 휠을 아래로 굴려도 다음 줄이 열린다 — 읽어 내려가는 방향 그대로
            onWheel={(event) => {
              if (event.deltaY > 0) readNext();
            }}
            className="size-full overflow-y-auto bg-scene-navy px-3 py-3.5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-memory"
          >
            {/* 날짜가 대화의 머리에 선다 — 첫 줄부터 읽어 내려가는 화면이라 처음부터 보인다 */}
            <p className="pb-3 text-center text-[0.6875rem] tracking-wider text-bone/35">
              {t("minigame.phoneChat.date")}
            </p>
            <ul className="flex flex-col gap-2.5">
              {visibleMessages(revealed).map((message) => (
                <Bubble
                  key={message.id}
                  message={message}
                  text={t(message.textKey)}
                  label={message.fromKey ? t(message.fromKey) : ""}
                />
              ))}
            </ul>
            {/* 아래로 더 있으면 그렇게 알려주고, 다 내려오면 조용히 사라진다 */}
            {hasLater(revealed) ? (
              <p className="pt-3 text-center text-[0.6875rem] tracking-wider text-bone/35">
                {t("minigame.phoneChat.moreBelow")}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="size-full overflow-y-auto bg-scene-navy px-3 py-2">
            <ul className="flex flex-col">
              {OUTGOING_CALLS.map((call) => (
                <li
                  key={call.id}
                  className="flex animate-fade-rise items-center gap-3 border-b border-bone/8 px-1.5 py-3 last:border-b-0"
                >
                  <PhoneDisconnect size={18} weight="fill" className="shrink-0 text-ember" />
                  <span className="min-w-0 flex-1 truncate text-[0.9375rem] font-bold text-ember">
                    {t(call.toKey)}
                    {call.count > 1 ? (
                      <span className="ml-1 font-normal text-ember/65">({call.count})</span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-[0.75rem] tabular-nums text-bone/40">
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
      <div className="flex min-h-9 items-center gap-3">
        {done ? (
          <button
            type="button"
            onClick={() => complete({ cleared: true })}
            className="flex cursor-pointer items-center gap-1.5 rounded-full bg-paper px-6 py-2 text-sm font-bold tracking-widest text-ink transition-all hover:-translate-y-0.5 active:translate-y-0"
          >
            <Check size={16} weight="bold" />
            {t("minigame.phoneChat.close")}
          </button>
        ) : (
          helpKey && (
            <p className="break-ko text-pretty px-4 text-center text-sm tracking-widest text-bone/50">
              {hint(helpKey)}
            </p>
          )
        )}
      </div>
    </div>
  );
}
