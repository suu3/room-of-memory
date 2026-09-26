/**
 * 스마트폰 미니게임의 데이터. 순수 값만 두어 브라우저 없이 검증한다.
 *
 * 대사 본문은 여기 넣지 않는다. 시나리오 규칙(.claude/rules/visual-novel.md)대로
 * i18n 키만 담고 ko/en/ja는 common.json이 갖는다.
 *
 * 친구 단톡방은 그날 점심까지 평범하게 떠들다가 거기서 멈춘다. 무슨 일이 있었는지는
 * 아무도 입에 올리지 않는다. 통화 기록은 도해가 건 전화만 줄줄이 보여준다.
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
  /** 연달아 건 횟수: 화면에 (N)으로 붙는다. */
  count: number;
}

/** 친구 둘. 이름은 i18n이 갖고, 코드는 이 키로만 가리킨다 (docs/story.md 친구 설정). */
export const FRIEND = {
  /** 나윤호: 야구부 포수. 도해 공을 늘 받아주던 친구. */
  yunho: "minigame.phoneChat.contact.yunho",
  /** 서주완: 같은 반, 야구부 아님. 격투 게임 매점 내기에서 늘 지던, 단톡에서 제일 시끄러운 친구. */
  juwan: "minigame.phoneChat.contact.juwan",
} as const satisfies Record<string, CommonTextKey>;

/**
 * 친구들 단톡방: 셋이 쓰는 방(윤호·주완·나).
 *
 * 그날 점심시간의 평범한 수다다. 주완이 제일 떠들고, 마지막 줄도 주완의 장난이다.
 * 그 뒤로는 아무 말도 없다. 무슨 일이 있었는지, 둘이 어디 있는지는 한 줄도 적지 않는다.
 *
 * 재난을 입에 올리는 줄은 한 줄도 넣지 않는다. 세계관을 여는 반전은
 * 라디오 한 곳이 갖는다 (docs/content-design.md 6-1).
 */
export const GROUP_CHAT: ChatMessage[] = [
  {
    id: "j1",
    side: "them",
    fromKey: FRIEND.juwan,
    textKey: "minigame.phoneChat.chat.j1",
    time: "12:31",
  },
  {
    id: "j2",
    side: "them",
    fromKey: FRIEND.juwan,
    textKey: "minigame.phoneChat.chat.j2",
    time: "12:31",
  },
  {
    id: "y1",
    side: "them",
    fromKey: FRIEND.yunho,
    textKey: "minigame.phoneChat.chat.y1",
    time: "12:33",
  },
  {
    id: "j3",
    side: "them",
    fromKey: FRIEND.juwan,
    textKey: "minigame.phoneChat.chat.j3",
    time: "12:33",
  },
  { id: "m1", side: "me", textKey: "minigame.phoneChat.chat.m1", time: "12:34" },
  {
    id: "j4",
    side: "them",
    fromKey: FRIEND.juwan,
    textKey: "minigame.phoneChat.chat.j4",
    time: "12:35",
  },
  {
    id: "y2",
    side: "them",
    fromKey: FRIEND.yunho,
    textKey: "minigame.phoneChat.chat.y2",
    time: "12:40",
  },
  { id: "m2", side: "me", textKey: "minigame.phoneChat.chat.m2", time: "12:40" },
  {
    id: "j5",
    side: "them",
    fromKey: FRIEND.juwan,
    textKey: "minigame.phoneChat.chat.j5",
    time: "12:52",
  },
];

/**
 * 도해가 건 전화. 아무도 받지 않았다. 윤호에게 건 것이 먼저, 그리고 또 한 번.
 * 뒤로 갈수록 다시 거는 횟수가 늘어난다.
 */
export const OUTGOING_CALLS: OutgoingCall[] = [
  { id: "c1", toKey: FRIEND.yunho, time: "16:41", count: 3 },
  { id: "c2", toKey: "minigame.phoneChat.contact.dad", time: "19:12", count: 4 },
  { id: "c3", toKey: FRIEND.yunho, time: "19:40", count: 5 },
  { id: "c4", toKey: "minigame.phoneChat.contact.mom", time: "20:31", count: 9 },
];

/**
 * 가족 단톡 (v4 3-2): 떠나던 날의 부모님 메시지 폭탄과 도해의 "응." 한 마디.
 *
 * 부모님은 쾌활하고 따뜻하게(물결, 이모티콘), 도해는 무뚝뚝하고 짧게 (가족 톤 가이드).
 * 여행이라고 말하고 떠난 날이라, 말투가 밝을수록 나중에 되짚을 때 아프다.
 * 한 번에 다 보인다. 읽어 내려가는 연출은 친구 단톡방 하나로 충분하다.
 */
export const FAMILY_CHAT: ChatMessage[] = [
  {
    id: "f1",
    side: "them",
    fromKey: "minigame.phoneChat.contact.mom",
    textKey: "minigame.phoneChat.family.f1",
    time: "08:02",
  },
  {
    id: "f2",
    side: "them",
    fromKey: "minigame.phoneChat.contact.dad",
    textKey: "minigame.phoneChat.family.f2",
    time: "08:03",
  },
  {
    id: "f3",
    side: "them",
    fromKey: "minigame.phoneChat.contact.mom",
    textKey: "minigame.phoneChat.family.f3",
    time: "08:03",
  },
  {
    id: "f4",
    side: "them",
    fromKey: "minigame.phoneChat.contact.dad",
    textKey: "minigame.phoneChat.family.f4",
    time: "08:05",
  },
  {
    id: "f5",
    side: "them",
    fromKey: "minigame.phoneChat.contact.mom",
    textKey: "minigame.phoneChat.family.f5",
    time: "08:11",
  },
  { id: "f6", side: "me", textKey: "minigame.phoneChat.family.f6", time: "08:40" },
];

/** 하단 탭: 채팅(대화방 목록) · 통화. */
export type PhoneTab = "chat" | "calls";
export const PHONE_TABS: PhoneTab[] = ["chat", "calls"];

/**
 * 채팅 탭의 대화방 목록. 1페이즈의 폰에는 이 둘뿐이다.
 * 엄마와의 1:1 방(그날 아침 문자)은 여기 없다: 폰 2차(mom-chat)가 처음 연다.
 */
export type ChatRoomId = "friends" | "family";
export const CHAT_ROOMS: ChatRoomId[] = ["friends", "family"];

/** 건 전화 총 횟수: 탭 배지에 쓴다. */
export function totalOutgoingCalls(calls: readonly OutgoingCall[] = OUTGOING_CALLS): number {
  return calls.reduce((sum, call) => sum + call.count, 0);
}

/**
 * 다 읽었는지. 친구 단톡방을 맨 아래까지 읽어 내려가고, 가족 단톡방과 통화 기록까지
 * 열어야 클리어다. 하나라도 빠지면 그날의 일부만 본 셈이라.
 */
export function isThreadComplete(revealed: number, seenCalls: boolean, seenFamily = true): boolean {
  return revealed >= GROUP_CHAT.length && seenCalls && seenFamily;
}

/**
 * 아래로 한 줄 더 읽어 내려간다. 마지막 줄에 닿으면 그대로 멈춘다.
 *
 * 대화의 첫머리에서 시작해 시간순으로 내려간다. 평범한 방과 후에서 출발해
 * 한 줄씩 내려갈수록 도해 혼자 남는 침묵으로 가라앉는 동작이다.
 */
export function revealNext(revealed: number): number {
  return Math.min(GROUP_CHAT.length, revealed + 1);
}

/**
 * 화면에 보이는 메시지: 앞에서부터 revealed개. 시간순은 그대로 유지된다.
 * 읽어 내려갈수록 뒤쪽(최신) 메시지가 목록 끝에 붙는다.
 */
export function visibleMessages(revealed: number): ChatMessage[] {
  const count = Math.min(GROUP_CHAT.length, Math.max(0, revealed));
  return GROUP_CHAT.slice(0, count);
}

/** 아래에 아직 더 있는지: "아래로 내려보세요" 안내를 언제 접을지 정한다. */
export function hasLater(revealed: number): boolean {
  return revealed < GROUP_CHAT.length;
}
