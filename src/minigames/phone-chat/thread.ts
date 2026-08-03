/**
 * 스마트폰 미니게임의 데이터. 순수 값만 두어 브라우저 없이 검증한다.
 *
 * 대사 본문은 여기 넣지 않는다 — 시나리오 규칙(.claude/rules/visual-novel.md)대로
 * i18n 키만 담고 ko/en/ja는 common.json이 갖는다.
 */

import type { CommonTextKey } from "@/types/minigame";

export type ChatSide = "them" | "me";

export interface ChatMessage {
  id: string;
  side: ChatSide;
  /** 보낸 사람 키 (me면 없음). */
  fromKey?: CommonTextKey;
  textKey: CommonTextKey;
  /** 화면에 찍히는 시각. 실제 시간 계산은 하지 않는다. */
  time: string;
}

export interface MissedCall {
  id: string;
  fromKey: CommonTextKey;
  time: string;
  /** 부재중이 이어진 횟수 — 화면에 (N)으로 붙는다. */
  count: number;
}

/**
 * 친구들 단톡방. 앞부분은 평범한 잡담이고 뒤로 갈수록 "왜 안 와" 쪽으로 기운다 —
 * 읽어 내려가는 것 자체가 그날을 되짚는 동작이 되도록.
 */
export const GROUP_CHAT: ChatMessage[] = [
  {
    id: "m1",
    side: "them",
    fromKey: "minigame.phoneChat.chat.jinho",
    textKey: "minigame.phoneChat.chat.m1",
    time: "16:02",
  },
  {
    id: "m2",
    side: "them",
    fromKey: "minigame.phoneChat.chat.sena",
    textKey: "minigame.phoneChat.chat.m2",
    time: "16:03",
  },
  { id: "m3", side: "me", textKey: "minigame.phoneChat.chat.m3", time: "16:05" },
  {
    id: "m4",
    side: "them",
    fromKey: "minigame.phoneChat.chat.jinho",
    textKey: "minigame.phoneChat.chat.m4",
    time: "16:06",
  },
  {
    id: "m5",
    side: "them",
    fromKey: "minigame.phoneChat.chat.sena",
    textKey: "minigame.phoneChat.chat.m5",
    time: "16:20",
  },
  {
    id: "m6",
    side: "them",
    fromKey: "minigame.phoneChat.chat.jinho",
    textKey: "minigame.phoneChat.chat.m6",
    time: "17:41",
  },
  {
    id: "m7",
    side: "them",
    fromKey: "minigame.phoneChat.chat.sena",
    textKey: "minigame.phoneChat.chat.m7",
    time: "18:15",
  },
  {
    id: "m8",
    side: "them",
    fromKey: "minigame.phoneChat.chat.jinho",
    textKey: "minigame.phoneChat.chat.m8",
    time: "20:02",
  },
];

/** 부모님 부재중 전화. 시간이 뒤로 갈수록 간격이 좁아진다. */
export const MISSED_CALLS: MissedCall[] = [
  { id: "c1", fromKey: "minigame.phoneChat.caller.mom", time: "18:40", count: 1 },
  { id: "c2", fromKey: "minigame.phoneChat.caller.dad", time: "19:12", count: 1 },
  { id: "c3", fromKey: "minigame.phoneChat.caller.mom", time: "19:55", count: 3 },
  { id: "c4", fromKey: "minigame.phoneChat.caller.mom", time: "20:31", count: 7 },
];

export type PhoneTab = "chat" | "calls";
export const PHONE_TABS: PhoneTab[] = ["chat", "calls"];

/** 부재중 전화 총 횟수 — 탭 배지에 쓴다. */
export function totalMissedCalls(calls: readonly MissedCall[] = MISSED_CALLS): number {
  return calls.reduce((sum, call) => sum + call.count, 0);
}

/**
 * 다 읽었는지. 단톡방을 맨 위까지 거슬러 올라가고 부재중 목록까지 열어야 클리어다 —
 * 둘 중 하나만 보면 그날의 절반만 본 셈이라.
 */
export function isThreadComplete(revealed: number, seenCalls: boolean): boolean {
  return revealed >= GROUP_CHAT.length && seenCalls;
}

/**
 * 위로 한 줄 더 거슬러 올라간다. 맨 위에 닿으면 그대로 멈춘다.
 *
 * 아래로 드러내는 대신 위로 올린다 — 폰을 집어 든 시점에 대화는 이미 끝나 있다.
 * 최신 메시지에서 시작해 거슬러 올라가는 게 "이미 벌어진 일을 되짚는" 동작이다.
 */
export function revealEarlier(revealed: number): number {
  return Math.min(GROUP_CHAT.length, revealed + 1);
}

/**
 * 화면에 보이는 메시지 — 뒤에서부터 revealed개. 시간순은 그대로 유지된다.
 * 위로 올릴수록 앞쪽(오래된) 메시지가 목록 앞에 붙는다.
 */
export function visibleMessages(revealed: number): ChatMessage[] {
  const count = Math.min(GROUP_CHAT.length, Math.max(0, revealed));
  return GROUP_CHAT.slice(GROUP_CHAT.length - count);
}

/** 위에 아직 더 있는지 — "위로 올려보세요" 안내를 언제 접을지 정한다. */
export function hasEarlier(revealed: number): boolean {
  return revealed < GROUP_CHAT.length;
}
