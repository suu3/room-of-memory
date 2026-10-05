import { describe, expect, it } from "vitest";
import { roomZoomForViewport } from "@/components/canvas/room-canvas-runtime";
import { BAT_PLACEMENT } from "../world/layout";
import { followLimits } from "../world/spaces";
import { FOLLOW_INSET, followInsetFor } from "./follow-inset";

const viewWidth = (width: number, height: number) => width / roomZoomForViewport(width, height);

describe("follow inset", () => {
  it("넓은 화면은 예전 여유 그대로다", () => {
    expect(followInsetFor(viewWidth(1440, 900))).toBe(FOLLOW_INSET.wide);
    expect(followInsetFor(viewWidth(1280, 720))).toBe(FOLLOW_INSET.wide);
  });

  it("폰 세로 화면은 좁은 여유를 쓴다", () => {
    expect(followInsetFor(viewWidth(390, 844))).toBe(FOLLOW_INSET.narrow);
  });

  it("폭이 넓어질수록 여유도 끊김 없이 는다", () => {
    const steps = [5, 5.6, 6.5, 7.5, 9, 12].map(followInsetFor);
    for (let i = 1; i < steps.length; i += 1) expect(steps[i]).toBeGreaterThanOrEqual(steps[i - 1]);
  });

  it("이상한 폭은 넓은 화면으로 본다", () => {
    expect(followInsetFor(Number.NaN)).toBe(FOLLOW_INSET.wide);
  });

  it("폰에서 현관 구석의 배트가 화면 반폭의 3분의 2 안에 든다", () => {
    const width = viewWidth(390, 844);
    // 방문이 열려 거실(과 그 홈인 현관)에 닿은 뒤다
    const limits = followLimits(["room-living"], followInsetFor(width));
    const [batX, , batZ] = BAT_PLACEMENT.position;
    // 목표점이 배트 쪽으로 갈 수 있는 데까지 간 자리
    const targetX = Math.min(limits.maxX, Math.max(limits.minX, batX));
    const targetZ = Math.min(limits.maxZ, Math.max(limits.minZ, batZ));
    // 카메라는 +x·+z에서 45°로 본다: 화면 가로는 (x − z) / √2
    const screenRight = (batX - targetX - (batZ - targetZ)) / Math.SQRT2;
    expect(Math.abs(screenRight)).toBeLessThan((width / 2) * (2 / 3));
  });
});
