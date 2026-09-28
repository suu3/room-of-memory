import { describe, expect, it } from "vitest";
import {
  clampPage,
  hologramVisibility,
  pitchFromDrag,
  swipeStep,
  unfoldFromDrag,
} from "./inspect-math";

describe("pitchFromDrag", () => {
  it("위로 끌면(음수 px) 윗변이 뒤로 눕는다 (음수 각)", () => {
    expect(pitchFromDrag(-50)).toBeLessThan(0);
    expect(pitchFromDrag(50)).toBeGreaterThan(0);
    expect(pitchFromDrag(0)).toBe(0);
  });
  it("아무리 끌어도 한계 각을 넘지 않는다", () => {
    expect(pitchFromDrag(-10_000)).toBe(-pitchFromDrag(10_000));
    expect(Math.abs(pitchFromDrag(10_000))).toBeLessThan(Math.PI / 2);
  });
});

describe("unfoldFromDrag", () => {
  it("위로 끌수록 0에서 1로 펼쳐지고 그 밖은 잘린다", () => {
    expect(unfoldFromDrag(0)).toBe(0);
    expect(unfoldFromDrag(40)).toBe(0);
    expect(unfoldFromDrag(-10_000)).toBe(1);
    const half = unfoldFromDrag(-80);
    expect(half).toBeGreaterThan(0);
    expect(half).toBeLessThan(1);
  });
});

describe("hologramVisibility", () => {
  const spot = { pitch: -0.45, yaw: 0.35 };
  it("정확히 그 각도에서 1, 정면·뒷면에서는 거의 0", () => {
    expect(hologramVisibility(spot.pitch, spot.yaw, spot)).toBeCloseTo(1, 5);
    expect(hologramVisibility(0, 0, spot)).toBeLessThan(0.05);
    expect(hologramVisibility(0, Math.PI, spot)).toBeLessThan(0.001);
  });
  it("회전각은 한 바퀴를 돌아도 같은 각이다", () => {
    expect(hologramVisibility(spot.pitch, spot.yaw + Math.PI * 2, spot)).toBeCloseTo(1, 5);
    expect(hologramVisibility(spot.pitch, spot.yaw - Math.PI * 4, spot)).toBeCloseTo(1, 5);
  });
  it("손가락이 조금 어긋나도 읽힌다: 기울기 ±0.18rad(세로 30px), 회전 ±0.4rad", async () => {
    const { HOLOGRAM_READ } = await import("./inspect-math");
    for (const pitch of [spot.pitch - 0.18, spot.pitch + 0.18]) {
      expect(hologramVisibility(pitch, spot.yaw, spot)).toBeGreaterThan(HOLOGRAM_READ);
    }
    for (const yaw of [spot.yaw - 0.4, spot.yaw + 0.4]) {
      expect(hologramVisibility(spot.pitch, yaw, spot)).toBeGreaterThan(HOLOGRAM_READ);
    }
  });
  it("각도에서 멀어질수록 단조롭게 어두워진다", () => {
    const near = hologramVisibility(spot.pitch + 0.1, spot.yaw, spot);
    const far = hologramVisibility(spot.pitch + 0.3, spot.yaw, spot);
    expect(near).toBeGreaterThan(far);
  });
});

describe("pageShowing", () => {
  it("짝수 쪽은 그 낱장이 오른쪽에 있을 때, 홀수 쪽은 넘긴 뒤 왼쪽에 있을 때 보인다", async () => {
    const { pageShowing } = await import("./inspect-math");
    expect(pageShowing(0)).toBe(0);
    expect(pageShowing(6)).toBe(3);
    expect(pageShowing(7)).toBe(4);
  });
});

describe("swipeStep / clampPage", () => {
  it("왼쪽으로 충분히 끌면 다음 장, 오른쪽이면 이전 장, 짧으면 그대로", () => {
    expect(swipeStep(-80)).toBe(1);
    expect(swipeStep(80)).toBe(-1);
    expect(swipeStep(-10)).toBe(0);
  });
  it("장 번호는 0과 장 수 사이에 머문다", () => {
    expect(clampPage(-1, 5)).toBe(0);
    expect(clampPage(9, 5)).toBe(5);
    expect(clampPage(3, 5)).toBe(3);
  });
});

describe("drag clamps", () => {
  it("한계를 넘긴 드래그는 한계값으로 되돌아온다", async () => {
    const { clampPitchDrag, clampUnfoldDrag, pitchFromDrag, unfoldFromDrag } = await import(
      "./inspect-math"
    );
    expect(pitchFromDrag(clampPitchDrag(-9999))).toBe(pitchFromDrag(-9999));
    expect(clampPitchDrag(10)).toBe(10);
    expect(clampUnfoldDrag(50)).toBe(0);
    expect(unfoldFromDrag(clampUnfoldDrag(-9999))).toBe(1);
    expect(clampUnfoldDrag(-30)).toBe(-30);
  });
});

describe("ReadTimer", () => {
  it("조건이 READ_SECONDS 동안 이어져야 한 번만 울리고, 끊기면 처음부터 센다", async () => {
    const { READ_SECONDS, ReadTimer } = await import("./inspect-math");
    const timer = new ReadTimer();
    expect(timer.tick(true, READ_SECONDS * 0.6)).toBe(false);
    expect(timer.tick(false, 0.01)).toBe(false);
    expect(timer.tick(true, READ_SECONDS * 0.6)).toBe(false);
    expect(timer.tick(true, READ_SECONDS * 0.6)).toBe(true);
    expect(timer.tick(true, 10)).toBe(false);
  });
});
