import { describe, expect, it } from "vitest";
import {
  CURTAIN_CLOSED,
  CURTAIN_SNAP_THRESHOLD,
  CURTAIN_X,
  curtainTargetX,
  curtainTravel,
  curtainX,
  isCurtainOpen,
  pullProgress,
  releaseProgress,
  settleProgress,
  toggleProgress,
} from "./curtain-motion";

describe("curtain motion", () => {
  it("starts with two panels meeting at the center of the window", () => {
    expect(curtainTargetX("left", false)).toBe(CURTAIN_X.left.closed);
    expect(curtainTargetX("right", false)).toBe(CURTAIN_X.right.closed);
    expect((CURTAIN_X.left.closed + CURTAIN_X.right.closed) / 2).toBeCloseTo(1.15);
  });

  it("moves each panel away from the window center when opened", () => {
    expect(curtainTargetX("left", true)).toBeLessThan(CURTAIN_X.left.closed);
    expect(curtainTargetX("right", true)).toBeGreaterThan(CURTAIN_X.right.closed);
  });
});

describe("pulling the curtains open", () => {
  it("needs both panels before the window counts as open", () => {
    expect(isCurtainOpen({ left: 1, right: 0 })).toBe(false);
    expect(isCurtainOpen({ left: 0, right: 1 })).toBe(false);
    expect(isCurtainOpen({ left: 1, right: 1 })).toBe(true);
    expect(isCurtainOpen(CURTAIN_CLOSED)).toBe(false);
  });

  it("turns a drag into progress in the direction that panel opens", () => {
    // 왼쪽은 -x로 당겨야 열린다
    expect(pullProgress("left", -curtainTravel("left"), 0)).toBe(1);
    expect(pullProgress("left", curtainTravel("left"), 0)).toBe(0);
    // 오른쪽은 반대
    expect(pullProgress("right", curtainTravel("right"), 0)).toBe(1);
    expect(pullProgress("right", -curtainTravel("right"), 0)).toBe(0);
    // 이어서 당기면 누적된다
    expect(pullProgress("left", -curtainTravel("left") / 2, 0.25)).toBeCloseTo(0.75);
  });

  it("never runs past either end no matter how far you drag", () => {
    expect(pullProgress("left", -999, 0)).toBe(1);
    expect(pullProgress("right", -999, 0.5)).toBe(0);
    expect(curtainX("left", 5)).toBe(CURTAIN_X.left.open);
    expect(curtainX("right", -5)).toBe(CURTAIN_X.right.closed);
  });

  it("snaps the rest of the way once it is mostly pulled", () => {
    expect(settleProgress(CURTAIN_SNAP_THRESHOLD)).toBe(1);
    expect(settleProgress(CURTAIN_SNAP_THRESHOLD - 0.01)).toBe(0);
    expect(settleProgress(1)).toBe(1);
    expect(settleProgress(0)).toBe(0);
  });

  it("closes a panel that is dragged back the way it came", () => {
    // 다 젖힌 커튼도 반대로 끌면 도로 닫힌다 — 창밖을 한 번 봤다고 굳지 않는다
    expect(pullProgress("left", curtainTravel("left"), 1)).toBe(0);
    expect(pullProgress("right", -curtainTravel("right"), 1)).toBe(0);
    // 조금만 되돌리면 스냅 기준을 못 넘겨 다시 열린 자리로 붙는다
    expect(settleProgress(pullProgress("left", curtainTravel("left") * 0.2, 1))).toBe(1);
  });

  it("flips the panel when it is tapped instead of dragged", () => {
    expect(toggleProgress(0)).toBe(1);
    expect(toggleProgress(1)).toBe(0);
    expect(releaseProgress(0, true)).toBe(1);
    expect(releaseProgress(1, true)).toBe(0);
    // 끌었을 때는 그대로 가까운 끝으로 붙는다
    expect(releaseProgress(0.2, false)).toBe(0);
    expect(releaseProgress(CURTAIN_SNAP_THRESHOLD, false)).toBe(1);
  });

  it("places the panels between closed and open as it is pulled", () => {
    expect(curtainX("left", 0)).toBe(CURTAIN_X.left.closed);
    expect(curtainX("left", 1)).toBe(CURTAIN_X.left.open);
    expect(curtainX("left", 0.5)).toBeCloseTo((CURTAIN_X.left.closed + CURTAIN_X.left.open) / 2);
  });
});
