"use client";

import {
  BaseballIcon,
  ChatCircleDotsIcon,
  CheckIcon,
  FlowerIcon,
  GameControllerIcon,
  type Icon,
  MountainsIcon,
  PhoneDisconnectIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { KeyHint } from "@/components/ui/shared/Keycap";
import { useControlHint } from "@/i18n/control-hint";
import { playSound } from "@/lib/audio";
import type { MinigameProps } from "@/types/minigame";
import { useOnceCompleter } from "../shell";
import { PhoneShell } from "./PhoneShell";
import {
  type AvatarKind,
  CHAT_ROOMS,
  type ChatMessage,
  type ChatRoomId,
  FAMILY_CHAT,
  GROUP_CHAT,
  hasLater,
  isThreadComplete,
  OUTGOING_CALLS,
  type PhoneTab,
  PROFILE_AVATARS,
  revealNext,
  scrollReads,
  startsRun,
  swipeReads,
  totalOutgoingCalls,
  visibleMessages,
} from "./thread";

/**
 * 지금 화면에서 뭘 하면 되는지 한 줄. 탭·열린 방·진행에 따라 바뀐다.
 *
 * 통화 기록 탭에서는 아무 말도 하지 않는다(null). 안내를 붙일 자리가 아니다.
 * 화면에 안 받은 전화가 줄줄이 떠 있는 것으로 이미 다 말했고, 거기에 한 줄을
 * 더 얹으면 화자가 플레이어를 부르는 것처럼 읽혀서 톤이 어긋난다.
 */
function phoneHelpKey(
  tab: PhoneTab,
  room: ChatRoomId | null,
  chatDone: boolean,
  seenCalls: boolean,
  seenFamily: boolean,
) {
  if (tab !== "chat") return null;
  if (room === "friends" && !chatDone) return "minigame.phoneChat.help" as const;
  if (room === null && !chatDone && !seenFamily) return "minigame.phoneChat.helpList" as const;
  if (!chatDone) return "minigame.phoneChat.helpFriends" as const;
  if (!seenFamily) return "minigame.phoneChat.helpFamily" as const;
  if (!seenCalls) return "minigame.phoneChat.helpCalls" as const;
  return null;
}

/** 목록의 한 줄에 쓰는 방 정보: 이름, 미리보기(마지막 줄), 날짜, 인원 아이콘. */
const ROOM_META = {
  friends: {
    nameKey: "minigame.phoneChat.chat.room",
    last: GROUP_CHAT[GROUP_CHAT.length - 1],
    // 단톡은 그 전날 밤에서 멈췄다. 그날(phoneChat.date)은 엄마 대화방과 통화 기록의 날이다
    dateKey: "minigame.phoneChat.chat.date",
  },
  family: {
    nameKey: "minigame.phoneChat.family.room",
    last: FAMILY_CHAT[FAMILY_CHAT.length - 1],
    dateKey: "minigame.phoneChat.family.date",
  },
} as const;

/** 폰을 열었을 때 이미 펼쳐져 있는 만큼. 대화의 첫 몇 줄만 보인다. */
const INITIAL_REVEALED = 2;

/** 프사 그림: 아이콘과 바탕색. 색은 씬 팔레트 토큰이다 (DESIGN.md). */
const AVATAR_LOOK: Record<AvatarKind, { icon: Icon; tone: string }> = {
  baseball: { icon: BaseballIcon, tone: "bg-scene-sage" },
  gamepad: { icon: GameControllerIcon, tone: "bg-scene-clay" },
  flower: { icon: FlowerIcon, tone: "bg-scene-amber" },
  mountains: { icon: MountainsIcon, tone: "bg-scene-leaf" },
};

/** 메신저 프사 한 칸. 그림이 없는 상대는 이름 첫 글자를 둔다. */
function Avatar({ kind, label }: { kind?: AvatarKind; label: string }) {
  const look = kind ? AVATAR_LOOK[kind] : null;
  const Glyph = look?.icon;
  return (
    <span
      aria-hidden
      className={`flex size-8 shrink-0 items-center justify-center rounded-xl text-scene-navy ${
        look?.tone ?? "bg-scene-dusk"
      }`}
    >
      {Glyph ? (
        <Glyph size={18} weight="fill" />
      ) : (
        <span className="text-[0.75rem] font-bold text-bone/70">{label.slice(0, 1)}</span>
      )}
    </span>
  );
}

function Bubble({
  message,
  text,
  label,
  first,
}: {
  message: ChatMessage;
  /** 이미 번역된 본문: 키가 아니라 화면에 찍을 문자열이다. */
  text: string;
  label: string;
  /** 한 사람이 연달아 보낸 묶음의 첫 줄: 프사와 이름이 여기만 붙는다 (startsRun). */
  first: boolean;
}) {
  const mine = message.side === "me";
  const body = (
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
      {/* 안읽음 수가 시각 위에 선다. 줄어들지 않는 이 숫자가 이 화면의 화자다 */}
      <span
        className={`flex shrink-0 flex-col pb-1 text-[0.625rem] tabular-nums ${
          mine ? "items-end" : "items-start"
        }`}
      >
        {message.unread ? <span className="font-bold text-memory">{message.unread}</span> : null}
        <span className="text-bone/35">{message.time}</span>
      </span>
    </div>
  );
  if (mine) return <li className="flex animate-fade-rise flex-col items-end">{body}</li>;
  return (
    <li className="flex animate-fade-rise items-start gap-2">
      {/* 묶음의 이어지는 줄은 프사 자리를 비워 둔다: 말풍선 줄이 첫 줄과 나란히 선다 */}
      {first ? (
        <Avatar
          kind={message.fromKey ? PROFILE_AVATARS[message.fromKey] : undefined}
          label={label}
        />
      ) : (
        <span aria-hidden className="w-8 shrink-0" />
      )}
      <div className="flex min-w-0 flex-1 flex-col items-start">
        {first && label ? (
          <span className="mb-1 px-1 text-[0.6875rem] font-bold tracking-wider text-bone/45">
            {label}
          </span>
        ) : null}
        {body}
      </div>
    </li>
  );
}

/**
 * 스마트폰을 확대해 그날의 기록을 읽는다.
 *
 * 하단 탭은 채팅과 통화 둘이다. 채팅 탭은 대화방 목록(친구 단톡방 · 가족 단톡방)에서
 * 방을 눌러 들어간다. 친구 단톡방은 클릭(또는 Space/↓)으로 첫 줄부터 한 줄씩 읽어
 * 내려가고, 가족 단톡방은 한 번에 보인다. 통화 탭을 열면 도해가 누구에게 몇 번이나
 * 걸었는지 보인다. 셋 다 봐야 끝난다. 실패 조건은 두지 않았다. 읽는 게 목적인 인터랙션이다.
 *
 * 엄마와의 1:1 방(그날 아침 7시 12분 문자)은 1페이즈 폰에 없다. 폰 2차(mom-chat)의 몫이다.
 */
export function PhoneChatMinigame({ onComplete }: MinigameProps) {
  const { t } = useTranslation();
  const hint = useControlHint();
  const complete = useOnceCompleter(onComplete);
  const [tab, setTab] = useState<PhoneTab>("chat");
  const [room, setRoom] = useState<ChatRoomId | null>(null);
  const [revealed, setRevealed] = useState(INITIAL_REVEALED);
  const [seenCalls, setSeenCalls] = useState(false);
  const [seenFamily, setSeenFamily] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const chatDone = !hasLater(revealed);
  const done = isThreadComplete(revealed, seenCalls, seenFamily);
  const helpKey = phoneHelpKey(tab, room, chatDone, seenCalls, seenFamily);
  const readingFriends = tab === "chat" && room === "friends";
  /**
   * 다음에 볼 것이 다른 방에 있으면 뒤로가기가 부른다. 방 목록을 거쳐야 한다는 걸
   * 모르고 헤맸다 (엄마 대화방은 방 하나라 뒤로가기가 없어서 더 그렇다).
   */
  const backCue =
    tab === "chat" &&
    ((room === "friends" && chatDone && !seenFamily) || (room === "family" && !chatDone));

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

  const openRoom = useCallback((next: ChatRoomId | null) => {
    playSound("select");
    setRoom(next);
    if (next === "family") setSeenFamily(true);
  }, []);

  // 새 줄이 아래에 붙는 화면이라 방금 열린 줄이 보이려면 바닥을 따라가야 한다.
  // 실제 채팅앱이 새 메시지에 붙는 것과 같은 감각.
  // biome-ignore lint/correctness/useExhaustiveDependencies: revealed는 본문에서 읽지 않고 "줄이 늘었다"는 신호로만 쓴다.
  useEffect(() => {
    const node = scrollRef.current;
    if (!node || !readingFriends) return;
    node.scrollTop = node.scrollHeight;
  }, [readingFriends, revealed]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!readingFriends) return;
      if (event.code === "Space" || event.code === "ArrowDown" || event.code === "Enter") {
        event.preventDefault();
        readNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [readNext, readingFriends]);

  // 스크롤도 클릭처럼 다음 줄을 연다. 폰 화면(대화창) 위에서만 듣는다:
  // 휠은 아래로 굴릴 때, 터치는 위로 쓸어 올릴 때 (둘 다 읽어 내려가는 방향).
  useEffect(() => {
    const node = scrollRef.current;
    if (!node || !readingFriends) return;
    let lastReadAt = Number.NEGATIVE_INFINITY;
    let touchY: number | null = null;
    const onWheel = (event: WheelEvent) => {
      if (!scrollReads(event.deltaY, event.timeStamp, lastReadAt)) return;
      lastReadAt = event.timeStamp;
      readNext();
    };
    const onTouchStart = (event: TouchEvent) => {
      touchY = event.touches[0]?.clientY ?? null;
    };
    const onTouchMove = (event: TouchEvent) => {
      const y = event.touches[0]?.clientY;
      if (touchY === null || y === undefined || !swipeReads(touchY, y)) return;
      touchY = y;
      readNext();
    };
    node.addEventListener("wheel", onWheel, { passive: true });
    node.addEventListener("touchstart", onTouchStart, { passive: true });
    node.addEventListener("touchmove", onTouchMove, { passive: true });
    return () => {
      node.removeEventListener("wheel", onWheel);
      node.removeEventListener("touchstart", onTouchStart);
      node.removeEventListener("touchmove", onTouchMove);
    };
  }, [readNext, readingFriends]);

  const callTotal = totalOutgoingCalls();

  const header =
    tab === "calls"
      ? {
          title: t("minigame.phoneChat.callsTitle"),
          subtitle: t("minigame.phoneChat.callsSubtitle"),
        }
      : room === "friends"
        ? {
            title: t("minigame.phoneChat.chat.room"),
            subtitle: t("minigame.phoneChat.chat.members"),
          }
        : room === "family"
          ? {
              title: t("minigame.phoneChat.family.room"),
              subtitle: t("minigame.phoneChat.family.members"),
            }
          : {
              title: t("minigame.phoneChat.list.title"),
              subtitle: t("minigame.phoneChat.list.subtitle", { value: CHAT_ROOMS.length }),
            };

  return (
    <div className="flex animate-fade-rise flex-col items-center gap-4">
      <PhoneShell
        tab={tab}
        onTab={openTab}
        title={header.title}
        subtitle={header.subtitle}
        clock="20:47"
        onBack={tab === "chat" && room !== null ? () => openRoom(null) : undefined}
        backCue={backCue}
        backLabel={t("minigame.phoneChat.list.back")}
        tabs={[
          { id: "chat", label: t("minigame.phoneChat.tab.chat"), Icon: ChatCircleDotsIcon },
          {
            id: "calls",
            label: t("minigame.phoneChat.tab.calls"),
            Icon: PhoneDisconnectIcon,
            badge: seenCalls ? 0 : callTotal,
          },
        ]}
      >
        {tab === "chat" && room === null ? (
          <ul className="size-full overflow-y-auto bg-scene-navy px-2 py-2">
            {CHAT_ROOMS.map((id) => {
              const meta = ROOM_META[id];
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => openRoom(id)}
                    className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-2.5 py-3 text-left transition-colors hover:bg-scene-dusk/60"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-scene-dusk text-bone/70">
                      <UsersThreeIcon size={20} weight="fill" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.875rem] font-bold text-paper">
                        {t(meta.nameKey)}
                      </span>
                      <span className="block truncate text-[0.75rem] text-bone/45">
                        {t(meta.last.textKey)}
                      </span>
                    </span>
                    <span className="shrink-0 self-start pt-0.5 text-[0.6875rem] tabular-nums text-bone/40">
                      {t(meta.dateKey)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : readingFriends ? (
          // 한 줄씩 붙는 대화창이라 role="log"가 맞는다. 새 줄이 스크린리더에 읽힌다.
          // 클릭은 다음 줄 넘기기. 키보드는 창 전역 핸들러가, 스크롤은 이 대화창에 건 리스너가 맡는다.
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
            className="size-full overflow-y-auto bg-scene-navy px-3 py-3.5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-memory"
          >
            {/* 날짜가 대화의 머리에 선다. 첫 줄부터 읽어 내려가는 화면이라 처음부터 보인다 */}
            <p className="pb-3 text-center text-[0.6875rem] tracking-wider text-bone/35">
              {t("minigame.phoneChat.chat.date")}
            </p>
            <ul className="flex flex-col gap-2.5">
              {visibleMessages(revealed).map((message, index, shown) => (
                <Bubble
                  key={message.id}
                  message={message}
                  text={t(message.textKey)}
                  label={message.fromKey ? t(message.fromKey) : ""}
                  first={startsRun(shown, index)}
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
        ) : tab === "chat" ? (
          <div className="size-full overflow-y-auto bg-scene-navy px-3 py-3">
            <p className="pb-3 text-center text-[0.6875rem] tracking-wider text-bone/35">
              {t("minigame.phoneChat.family.date")}
            </p>
            <ul className="flex flex-col gap-2.5">
              {FAMILY_CHAT.map((message, index) => (
                <Bubble
                  key={message.id}
                  message={message}
                  text={t(message.textKey)}
                  label={message.fromKey ? t(message.fromKey) : ""}
                  first={startsRun(FAMILY_CHAT, index)}
                />
              ))}
            </ul>
          </div>
        ) : (
          <div className="size-full overflow-y-auto bg-scene-navy px-3 py-2">
            <ul className="flex flex-col">
              {OUTGOING_CALLS.map((call) => {
                // 걸려 온 스팸은 회색으로 물러선다: 초록(친구) → 빨강(부모님)의 흐름에 끼지 않는다
                const tone = call.incoming
                  ? "text-bone/45"
                  : call.urgent
                    ? "text-ember"
                    : "text-scene-leaf";
                return (
                  <li
                    key={call.id}
                    className="flex animate-fade-rise items-center gap-3 border-b border-bone/8 px-1.5 py-3 last:border-b-0"
                  >
                    <PhoneDisconnectIcon size={18} weight="fill" className={`shrink-0 ${tone}`} />
                    <span className={`min-w-0 flex-1 truncate text-[0.9375rem] font-bold ${tone}`}>
                      {t(call.toKey)}
                      {call.count > 1 ? (
                        <span className="ml-1 font-normal opacity-65">({call.count})</span>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-[0.75rem] tabular-nums text-bone/40">
                      {call.time}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </PhoneShell>

      {/* 다 읽었을 때만 닫는 버튼이 뜬다. 그 전에 닫으면(바깥 클릭·Esc) 아무 일도
          없었던 것처럼 다시 열 수 있다. 방탈출 탐색이라 되돌아올 수 있어야 한다. */}
      <div className="flex min-h-9 items-center gap-3">
        {done ? (
          <button
            type="button"
            onClick={() => complete({ cleared: true })}
            className="flex cursor-pointer items-center gap-1.5 rounded-full bg-paper px-6 py-2 text-sm font-bold tracking-widest text-ink transition-all hover:-translate-y-0.5 active:translate-y-0"
          >
            <CheckIcon size={16} weight="bold" />
            {t("minigame.phoneChat.close")}
          </button>
        ) : (
          helpKey && (
            <p className="break-ko text-pretty px-4 text-center text-sm tracking-widest text-bone/50">
              <KeyHint text={hint(helpKey)} />
            </p>
          )
        )}
      </div>
    </div>
  );
}
