/**
 * 스마트폰 미니게임의 데이터. 순수 값만 두어 브라우저 없이 검증한다.
 *
 * 대사 본문은 여기 넣지 않는다. 시나리오 규칙(.claude/rules/narrative-content.md)대로
 * i18n 키만 담고 ko/en/ja는 common.json이 갖는다.
 *
 * 친구 단톡방은 그 전날 밤까지 평범하게 떠들다가 거기서 멈춘다. 무슨 일이 있었는지는
 * 아무도 입에 올리지 않는다. 통화 기록은 도해가 건 전화를 줄줄이 보여준다 (맨 위 한 줄만
 * 낮에 걸려 온 스팸 부재중이다).
 */

import type { CommonTextKey } from "@/types/minigame";

type ChatSide = "them" | "me";

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
  /** 그 시점 이후의 전화: 초록 대신 빨강으로 선다. */
  urgent?: boolean;
  /** 걸려 온 부재중 전화: 도해가 건 것이 아니다. 회색으로 서고, 건 횟수(탭 배지)에는 안 낀다. */
  incoming?: boolean;
}

/** 친구 둘. 이름은 i18n이 갖고, 코드는 이 키로만 가리킨다 (docs/story/story.md 친구 설정). */
export const FRIEND = {
  /** 나윤호: 야구부 포수. 유소년 때부터 도해와 같이 야구를 해 온 친구. */
  yunho: "minigame.phoneChat.contact.yunho",
  /** 서주완: 같은 반, 야구부 아님. 격투 게임 매점 내기에서 늘 지던, 단톡에서 제일 시끄러운 친구. */
  juwan: "minigame.phoneChat.contact.juwan",
} as const satisfies Record<string, CommonTextKey>;

/** 프사 그림의 종류. 그림은 UI(index.tsx)가 아이콘으로 그리고, 여기는 누가 무엇인지만 갖는다. */
export type AvatarKind = "baseball" | "gamepad" | "flower" | "mountains";

/**
 * 대화 상대마다의 프사. 그 사람이 평소 자기를 어떻게 보여 주던 사람인지 말없이 알려 준다.
 * 평범할수록 좋다: 1페이즈 폰은 "그 전날 밤까지 평범했다"를 보여 주는 화면이다.
 *
 * 윤호는 공을 받던 포수라 야구공, 주완은 매점 내기 격투 게임이라 게임패드, 엄마는 꽃,
 * 아빠는 아빠들 프사의 단골인 산 풍경이다 (docs/story/story.md 인물 설정).
 */
export const PROFILE_AVATARS: Readonly<Partial<Record<CommonTextKey, AvatarKind>>> = {
  [FRIEND.yunho]: "baseball",
  [FRIEND.juwan]: "gamepad",
  "minigame.phoneChat.contact.mom": "flower",
  "minigame.phoneChat.contact.dad": "mountains",
};

/**
 * 이 줄이 한 사람이 연달아 보낸 말풍선 묶음의 첫 줄인가. 메신저처럼 프사와 이름은 묶음의
 * 첫 줄에만 붙고, 이어지는 줄은 프사 자리만큼 들여 쓴다.
 */
export function startsRun(messages: readonly ChatMessage[], index: number): boolean {
  const previous = messages[index - 1];
  const message = messages[index];
  return !previous || previous.side !== message.side || previous.fromKey !== message.fromKey;
}

/**
 * 친구들 단톡방: 셋이 쓰는 방(윤호·주완·나). 방 이름은 "대학 포기한 고삼들의 모임".
 *
 * 수능 한 달 전 밤의 평범한 수다다. 주완이 내일 놀자고 조르고, 윤호가 핀잔을 주다
 * 끼워 달라고 하고, 마지막 줄은 주완의 "ㅋ"다. 그 뒤로는 아무 말도 없다.
 * 무슨 일이 있었는지, 둘이 어디 있는지는 한 줄도 적지 않는다.
 *
 * 재난을 입에 올리는 줄은 한 줄도 넣지 않는다. 세계관을 여는 반전은
 * 라디오 한 곳이 갖는다 (docs/story/content-design.md 6-1).
 */
export const GROUP_CHAT: ChatMessage[] = [
  {
    id: "j1",
    side: "them",
    fromKey: FRIEND.juwan,
    textKey: "minigame.phoneChat.chat.j1",
    time: "21:12",
  },
  {
    id: "j2",
    side: "them",
    fromKey: FRIEND.juwan,
    textKey: "minigame.phoneChat.chat.j2",
    time: "21:12",
  },
  {
    id: "y1",
    side: "them",
    fromKey: FRIEND.yunho,
    textKey: "minigame.phoneChat.chat.y1",
    time: "21:14",
  },
  {
    id: "j3",
    side: "them",
    fromKey: FRIEND.juwan,
    textKey: "minigame.phoneChat.chat.j3",
    time: "21:15",
  },
  {
    id: "y2",
    side: "them",
    fromKey: FRIEND.yunho,
    textKey: "minigame.phoneChat.chat.y2",
    time: "21:15",
  },
  { id: "m1", side: "me", textKey: "minigame.phoneChat.chat.m1", time: "21:20" },
  { id: "m2", side: "me", textKey: "minigame.phoneChat.chat.m2", time: "21:20" },
  {
    id: "y3",
    side: "them",
    fromKey: FRIEND.yunho,
    textKey: "minigame.phoneChat.chat.y3",
    time: "21:21",
  },
  {
    id: "j4",
    side: "them",
    fromKey: FRIEND.juwan,
    textKey: "minigame.phoneChat.chat.j4",
    time: "21:22",
  },
];

/**
 * 도해가 건 전화. 아무도 받지 않았다.
 * 처음엔 친구들에게 건 평범한 발신(초록)이다가, 어느 시점부터는 부모님께 거푸 건
 * 전화(빨강)로 바뀐다. 뒤로 갈수록 다시 거는 횟수가 늘어난다.
 *
 * 맨 위의 한 줄만 걸려 온 전화다: 수업 중에 온 스팸 번호의 부재중 두 통. 그날 낮까지는
 * 폰이 평범했다는 표시다.
 */
export const OUTGOING_CALLS: OutgoingCall[] = [
  { id: "c0", toKey: "minigame.phoneChat.contact.spam", time: "11:08", count: 2, incoming: true },
  { id: "c1", toKey: FRIEND.yunho, time: "16:41", count: 1 },
  { id: "c2", toKey: FRIEND.juwan, time: "16:58", count: 2 },
  { id: "c3", toKey: "minigame.phoneChat.contact.dad", time: "19:12", count: 4, urgent: true },
  { id: "c4", toKey: "minigame.phoneChat.contact.mom", time: "20:31", count: 6, urgent: true },
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
  return calls.reduce((sum, call) => sum + (call.incoming ? 0 : call.count), 0);
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

/** 스크롤로 넘기는 줄 사이의 최소 간격(ms). 트랙패드는 한 번만 쓸어도 휠 이벤트가 수십 개 온다. */
const SCROLL_READ_GAP_MS = 180;

/** 손가락이 이만큼 위로 움직이면 한 줄 (px). */
const SWIPE_READ_STEP = 44;

/**
 * 이 휠 이벤트가 다음 줄을 여는가. 아래로 굴릴 때만, 그리고 앞 줄을 연 지 조금 지났을 때만.
 * 간격을 두지 않으면 트랙패드의 관성 스크롤이 대화를 한 번에 끝까지 쏟는다.
 */
export function scrollReads(deltaY: number, now: number, lastReadAt: number): boolean {
  return deltaY > 0 && now - lastReadAt >= SCROLL_READ_GAP_MS;
}

/** 터치로 쓸어 올린 거리가 한 줄만큼 되는가. fromY는 앞 줄을 연 자리, toY는 지금 손가락 자리. */
export function swipeReads(fromY: number, toY: number): boolean {
  return fromY - toY >= SWIPE_READ_STEP;
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
