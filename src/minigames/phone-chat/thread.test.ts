import { describe, expect, it } from "vitest";
import {
  CHAT_ROOMS,
  FAMILY_CHAT,
  FRIEND,
  GROUP_CHAT,
  hasLater,
  isThreadComplete,
  OUTGOING_CALLS,
  PHONE_TABS,
  PROFILE_AVATARS,
  revealNext,
  startsRun,
  totalOutgoingCalls,
  visibleMessages,
} from "./thread";

describe("phone-chat thread", () => {
  it("walks forward one line at a time and stops at the newest", () => {
    let revealed = 0;
    for (let step = 0; step < GROUP_CHAT.length; step += 1) {
      revealed = revealNext(revealed);
      expect(revealed).toBe(step + 1);
    }
    expect(revealNext(revealed)).toBe(GROUP_CHAT.length);
    expect(revealNext(GROUP_CHAT.length + 5)).toBe(GROUP_CHAT.length);
  });

  it("shows the oldest messages first and keeps them in time order", () => {
    // 처음엔 첫 줄만 보인다. 대화의 첫머리에서 출발한다
    expect(visibleMessages(1)).toEqual([GROUP_CHAT[0]]);
    // 내려갈수록 뒤쪽(최신) 메시지가 아래에 붙는다
    const three = visibleMessages(3);
    expect(three).toHaveLength(3);
    expect(three[0]).toEqual(GROUP_CHAT[0]);
    expect(three.at(-1)).toEqual(GROUP_CHAT[2]);
    // 순서가 뒤집히지 않는다
    expect(visibleMessages(GROUP_CHAT.length)).toEqual(GROUP_CHAT);
  });

  it("survives nonsense counts", () => {
    expect(visibleMessages(0)).toEqual([]);
    expect(visibleMessages(-4)).toEqual([]);
    expect(visibleMessages(GROUP_CHAT.length + 9)).toEqual(GROUP_CHAT);
  });

  it("knows when there is nothing newer left", () => {
    expect(hasLater(0)).toBe(true);
    expect(hasLater(GROUP_CHAT.length - 1)).toBe(true);
    expect(hasLater(GROUP_CHAT.length)).toBe(false);
  });

  it("needs both the chat and the missed calls before it counts as read", () => {
    expect(isThreadComplete(GROUP_CHAT.length, false)).toBe(false);
    expect(isThreadComplete(GROUP_CHAT.length - 1, true)).toBe(false);
    expect(isThreadComplete(GROUP_CHAT.length, true)).toBe(true);
  });

  it("keeps the thread readable: unique ids, and labels only on friends' lines", () => {
    const ids = GROUP_CHAT.map((message) => message.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const message of GROUP_CHAT) {
      // 친구 줄에는 보낸 사람 라벨이, 내 줄에는 라벨이 없어야 말풍선이 맞게 선다
      if (message.side === "them") expect(message.fromKey).toBeDefined();
      else expect(message.fromKey).toBeUndefined();
    }
  });

  it("is the two friends' room: Juwan has the last word, then silence", () => {
    const senders = new Set(GROUP_CHAT.map((message) => message.fromKey).filter(Boolean));
    expect(senders).toEqual(new Set([FRIEND.yunho, FRIEND.juwan]));
    expect(GROUP_CHAT.at(-1)?.fromKey).toBe(FRIEND.juwan);
    // 도해가 그 뒤로 보낸 줄은 없다: 방은 주완의 "ㄱㄱ"에서 멈춘다
    expect(GROUP_CHAT.at(-1)?.side).toBe("them");
  });

  it("starts with calls to friends, then turns urgent with calls to the parents", () => {
    // 초록(평범한 발신)이 먼저, 빨강(그 시점 이후)이 뒤: 섞이지 않는다
    const firstUrgent = OUTGOING_CALLS.findIndex((call) => call.urgent);
    expect(firstUrgent).toBeGreaterThan(0);
    expect(OUTGOING_CALLS.slice(firstUrgent).every((call) => call.urgent)).toBe(true);
    const friends = new Set<string>(Object.values(FRIEND));
    expect(OUTGOING_CALLS.slice(0, firstUrgent).every((call) => friends.has(call.toKey))).toBe(
      true,
    );
    expect(OUTGOING_CALLS.slice(firstUrgent).some((call) => friends.has(call.toKey))).toBe(false);
  });

  it("counts every call the player placed for the tab badge", () => {
    expect(totalOutgoingCalls()).toBe(OUTGOING_CALLS.reduce((sum, call) => sum + call.count, 0));
    expect(totalOutgoingCalls([])).toBe(0);
    // 다시 건 횟수가 쌓여 있어야 "몇 번이나 걸었다"가 화면에서 읽힌다
    expect(totalOutgoingCalls()).toBeGreaterThan(OUTGOING_CALLS.length);
  });

  it("has two tabs (chats, calls) and lists only the friends' and family rooms", () => {
    expect(PHONE_TABS).toEqual(["chat", "calls"]);
    // 엄마 1:1 방(그날 아침 문자)은 1페이즈 폰에 없다
    expect(CHAT_ROOMS).toEqual(["friends", "family"]);
  });

  it("needs the family chat opened too before the phone can be put down", () => {
    expect(isThreadComplete(GROUP_CHAT.length, true, false)).toBe(false);
    expect(isThreadComplete(GROUP_CHAT.length, true, true)).toBe(true);
  });

  it("keeps the family chat light: parents chatter, the son answers once", () => {
    const mine = FAMILY_CHAT.filter((message) => message.side === "me");
    expect(mine).toHaveLength(1);
    expect(FAMILY_CHAT.length).toBeGreaterThan(3);
  });
});

describe("phone-chat profiles", () => {
  it("단톡방에서 말하는 상대는 모두 프사가 있다", () => {
    for (const message of [...GROUP_CHAT, ...FAMILY_CHAT]) {
      if (message.side === "me") continue;
      expect(message.fromKey && PROFILE_AVATARS[message.fromKey], message.id).toBeTruthy();
    }
  });

  it("프사와 이름은 한 사람이 연달아 보낸 묶음의 첫 줄에만 붙는다", () => {
    const firsts = GROUP_CHAT.filter((_, index) => startsRun(GROUP_CHAT, index)).map(
      (message) => message.id,
    );
    // 주완 j1·j2, 윤호 y1, 주완 j3, 윤호 y2, 나 m1·m2, 윤호 y3·y4, 주완 j4
    expect(firsts).toEqual(["j1", "y1", "j3", "y2", "m1", "y3", "j4"]);
    // 가족방은 엄마·아빠가 번갈아 말해서 매 줄이 새 묶음이다
    expect(FAMILY_CHAT.every((_, index) => startsRun(FAMILY_CHAT, index))).toBe(true);
  });
});
