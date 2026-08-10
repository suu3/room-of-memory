/**
 * 스마트폰 미니게임의 데이터. 순수 값만 두어 브라우저 없이 검증한다.
 *
 * 대사 본문은 여기 넣지 않는다 — 시나리오 규칙(.claude/rules/visual-novel.md)대로
 * i18n 키만 담고 ko/en/ja는 common.json이 갖는다.
 *
 * 단톡방은 그날 오후까지 평범하게 살아 있다가, 어느 순간부터 도해 혼자다.
 * 무슨 일이 있었는지는 아무도 입에 올리지 않는다 — 내 메시지 옆에 안읽음 2가
 * 끝까지 남아 있는 것이 이 화면의 전부다. 통화 기록은 로어(memory-room의
 * lore.phone)가 말하는 "부재중 전화는 전부 내가 건 쪽이다"를 그대로 보여준다.
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
  /** 말풍선 옆에 남는 안 읽은 사람 수. 그날 이후 한 번도 줄지 않았다. */
  unread?: number;
}

export interface OutgoingCall {
  id: string;
  /** 건 상대. */
  toKey: CommonTextKey;
  time: string;
  /** 연달아 건 횟수 — 화면에 (N)으로 붙는다. */
  count: number;
}

/**
 * 친구들 단톡방 — 셋이 쓰는 방(우진·태오·나)이라 안읽음 최대치가 2다.
 *
 * 위쪽(과거)은 피시방 내기로 떠드는 평범한 방과 후다. 16시 이후로는 도해의
 * 목소리만 남고, 그 줄들에는 안읽음 2가 그대로 붙어 있다 — 둘 다 한 번도
 * 읽지 않았다는 것만이 그날의 증거다.
 *
 * 재난을 입에 올리는 줄은 한 줄도 넣지 않는다 — 세계관을 여는 반전은
 * 강도 4의 라디오 한 곳이 갖는다 (docs/content-design.md 6-1).
 */
export const GROUP_CHAT: ChatMessage[] = [
  {
    id: "w1",
    side: "them",
    fromKey: "minigame.phoneChat.contact.woojin",
    textKey: "minigame.phoneChat.chat.w1",
    time: "15:42",
  },
  {
    id: "t1",
    side: "them",
    fromKey: "minigame.phoneChat.contact.taeo",
    textKey: "minigame.phoneChat.chat.t1",
    time: "15:43",
  },
  { id: "m1", side: "me", textKey: "minigame.phoneChat.chat.m1", time: "15:44" },
  { id: "m2", side: "me", textKey: "minigame.phoneChat.chat.m2", time: "15:45" },
  {
    id: "w2",
    side: "them",
    fromKey: "minigame.phoneChat.contact.woojin",
    textKey: "minigame.phoneChat.chat.w2",
    time: "15:46",
  },
  { id: "m3", side: "me", textKey: "minigame.phoneChat.chat.m3", time: "16:40", unread: 2 },
  { id: "m4", side: "me", textKey: "minigame.phoneChat.chat.m4", time: "18:41", unread: 2 },
  { id: "m5", side: "me", textKey: "minigame.phoneChat.chat.m5", time: "19:03", unread: 2 },
];

/** 도해가 건 전화. 아무도 받지 않았고, 뒤로 갈수록 다시 거는 횟수가 늘어난다. */
export const OUTGOING_CALLS: OutgoingCall[] = [
  { id: "c1", toKey: "minigame.phoneChat.contact.woojin", time: "18:22", count: 2 },
  { id: "c2", toKey: "minigame.phoneChat.contact.taeo", time: "18:35", count: 2 },
  { id: "c3", toKey: "minigame.phoneChat.contact.dad", time: "19:12", count: 4 },
  { id: "c4", toKey: "minigame.phoneChat.contact.mom", time: "20:31", count: 9 },
];

export type PhoneTab = "chat" | "calls";
export const PHONE_TABS: PhoneTab[] = ["chat", "calls"];

/** 건 전화 총 횟수 — 탭 배지에 쓴다. */
export function totalOutgoingCalls(calls: readonly OutgoingCall[] = OUTGOING_CALLS): number {
  return calls.reduce((sum, call) => sum + call.count, 0);
}

/**
 * 다 읽었는지. 단톡방을 맨 아래까지 읽어 내려가고 통화 기록까지 열어야 클리어다 —
 * 둘 중 하나만 보면 그날의 절반만 본 셈이라.
 */
export function isThreadComplete(revealed: number, seenCalls: boolean): boolean {
  return revealed >= GROUP_CHAT.length && seenCalls;
}

/**
 * 아래로 한 줄 더 읽어 내려간다. 마지막 줄에 닿으면 그대로 멈춘다.
 *
 * 대화의 첫머리에서 시작해 시간순으로 내려간다 — 평범한 방과 후에서 출발해
 * 한 줄씩 내려갈수록 도해 혼자 남는 침묵으로 가라앉는 동작이다.
 */
export function revealNext(revealed: number): number {
  return Math.min(GROUP_CHAT.length, revealed + 1);
}

/**
 * 화면에 보이는 메시지 — 앞에서부터 revealed개. 시간순은 그대로 유지된다.
 * 읽어 내려갈수록 뒤쪽(최신) 메시지가 목록 끝에 붙는다.
 */
export function visibleMessages(revealed: number): ChatMessage[] {
  const count = Math.min(GROUP_CHAT.length, Math.max(0, revealed));
  return GROUP_CHAT.slice(0, count);
}

/** 아래에 아직 더 있는지 — "아래로 내려보세요" 안내를 언제 접을지 정한다. */
export function hasLater(revealed: number): boolean {
  return revealed < GROUP_CHAT.length;
}
