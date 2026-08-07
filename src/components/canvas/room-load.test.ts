import { describe, expect, it } from "vitest";
import { roomLoadFraction } from "./room-load";

describe("roomLoadFraction", () => {
  it("아무것도 안 받았으면 0", () => {
    expect(roomLoadFraction({ loaded: 0, total: 0, active: false })).toBe(0);
  });

  it("받는 중에는 받은 비율", () => {
    expect(roomLoadFraction({ loaded: 3, total: 12, active: true })).toBe(0.25);
  });

  it("큐가 비면 완료로 못을 박는다 — 반올림 때문에 0.99에 멈추지 않게", () => {
    expect(roomLoadFraction({ loaded: 11, total: 12, active: false })).toBe(1);
  });

  it("비율이 1을 넘거나 음수로 새지 않는다", () => {
    expect(roomLoadFraction({ loaded: 14, total: 12, active: true })).toBe(1);
    expect(roomLoadFraction({ loaded: -1, total: 12, active: true })).toBe(0);
  });
});
