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
  revealNext,
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

  it("is the two friends' room: Juwan talks most and has the last word, then silence", () => {
    const senders = new Set(GROUP_CHAT.map((message) => message.fromKey).filter(Boolean));
    expect(senders).toEqual(new Set([FRIEND.yunho, FRIEND.juwan]));
    const count = (key: string) => GROUP_CHAT.filter((message) => message.fromKey === key).length;
    expect(count(FRIEND.juwan)).toBeGreaterThan(count(FRIEND.yunho));
    expect(GROUP_CHAT.at(-1)?.fromKey).toBe(FRIEND.juwan);
    // 도해가 그 뒤로 보낸 줄은 없다: 방은 주완의 장난에서 멈춘다
    expect(GROUP_CHAT.at(-1)?.side).toBe("them");
  });

  it("logs several unanswered calls the player placed to Yunho", () => {
    const toYunho = OUTGOING_CALLS.filter((call) => call.toKey === FRIEND.yunho);
    expect(toYunho.reduce((sum, call) => sum + call.count, 0)).toBeGreaterThan(1);
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
