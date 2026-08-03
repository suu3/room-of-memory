import { describe, expect, it } from "vitest";
import {
  GROUP_CHAT,
  hasEarlier,
  isThreadComplete,
  OUTGOING_CALLS,
  PHONE_TABS,
  revealEarlier,
  totalOutgoingCalls,
  visibleMessages,
} from "./thread";

describe("phone-chat thread", () => {
  it("walks backwards one line at a time and stops at the oldest", () => {
    let revealed = 0;
    for (let step = 0; step < GROUP_CHAT.length; step += 1) {
      revealed = revealEarlier(revealed);
      expect(revealed).toBe(step + 1);
    }
    expect(revealEarlier(revealed)).toBe(GROUP_CHAT.length);
    expect(revealEarlier(GROUP_CHAT.length + 5)).toBe(GROUP_CHAT.length);
  });

  it("shows the newest messages first and keeps them in time order", () => {
    // 처음엔 마지막 줄만 보인다 — 폰을 집었을 때 화면에 남아 있던 그 화면
    expect(visibleMessages(1)).toEqual([GROUP_CHAT.at(-1)]);
    // 올릴수록 앞쪽(오래된) 메시지가 위에 붙는다
    const three = visibleMessages(3);
    expect(three).toHaveLength(3);
    expect(three.at(-1)).toEqual(GROUP_CHAT.at(-1));
    expect(three[0]).toEqual(GROUP_CHAT.at(-3));
    // 순서가 뒤집히지 않는다
    expect(visibleMessages(GROUP_CHAT.length)).toEqual(GROUP_CHAT);
  });

  it("survives nonsense counts", () => {
    expect(visibleMessages(0)).toEqual([]);
    expect(visibleMessages(-4)).toEqual([]);
    expect(visibleMessages(GROUP_CHAT.length + 9)).toEqual(GROUP_CHAT);
  });

  it("knows when there is nothing older left", () => {
    expect(hasEarlier(0)).toBe(true);
    expect(hasEarlier(GROUP_CHAT.length - 1)).toBe(true);
    expect(hasEarlier(GROUP_CHAT.length)).toBe(false);
  });

  it("needs both the chat and the missed calls before it counts as read", () => {
    expect(isThreadComplete(GROUP_CHAT.length, false)).toBe(false);
    expect(isThreadComplete(GROUP_CHAT.length - 1, true)).toBe(false);
    expect(isThreadComplete(GROUP_CHAT.length, true)).toBe(true);
  });

  it("keeps the thread readable: unique ids, and every line is the player's", () => {
    // 이 화면은 도해가 보낸 기록만 담는다 — 답이 한 줄이라도 섞이면 연출이 뒤집힌다
    const ids = GROUP_CHAT.map((message) => message.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const message of GROUP_CHAT) {
      expect(message.side).toBe("me");
      expect(message.fromKey).toBeUndefined();
    }
  });

  it("counts every call the player placed for the tab badge", () => {
    expect(totalOutgoingCalls()).toBe(OUTGOING_CALLS.reduce((sum, call) => sum + call.count, 0));
    expect(totalOutgoingCalls([])).toBe(0);
    // 다시 건 횟수가 쌓여 있어야 "몇 번이나 걸었다"가 화면에서 읽힌다
    expect(totalOutgoingCalls()).toBeGreaterThan(OUTGOING_CALLS.length);
  });

  it("exposes exactly the two tabs the screen renders", () => {
    expect(PHONE_TABS).toEqual(["chat", "calls"]);
  });
});
