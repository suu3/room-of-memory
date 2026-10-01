import { describe, expect, it } from "vitest";
import { FOCUS_ZOOM_SCALE } from "@/components/canvas/room-canvas-runtime";
import { CRANE_SHOT, craneZoomFor } from "./crane-shot";

describe("crane shot", () => {
  it("조사 확대보다 더 깊이 들어간다. 방 하나에서 열쇠 하나까지가 한 컷이다", () => {
    expect(craneZoomFor(96)).toBeGreaterThan(96 * FOCUS_ZOOM_SCALE);
  });

  it("프리셋 전환(7)보다 훨씬 느리게 민다. 컷이 아니라 크레인이다", () => {
    expect(CRANE_SHOT.lambda).toBeLessThan(2);
    expect(CRANE_SHOT.lambda).toBeGreaterThan(0);
  });

  it("머무는 시간은 혼잣말 한 줄(3.2초)보다 길다. 글이 사라진 뒤에도 열쇠에 잠깐 남는다", () => {
    expect(CRANE_SHOT.holdMs).toBeGreaterThan(3200);
  });

  it("이상한 배율은 그대로 돌려준다", () => {
    expect(craneZoomFor(Number.NaN)).toBeNaN();
  });
});
