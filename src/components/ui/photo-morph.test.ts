import { describe, expect, it } from "vitest";
import {
  bakeDisplacement,
  bufferSize,
  cameraRect,
  containRect,
  edgeFalloff,
  framedRect,
  lerpRect,
  MORPH_DELAY_MS,
  MORPH_DURATION_MS,
  morphDone,
  morphProgress,
  morphSeed,
  visibleBox,
  WHOLE_FRAME,
} from "./photo-morph";

describe("photo-morph", () => {
  it("지연 동안은 1막 사진 그대로다", () => {
    expect(morphProgress(0)).toBe(0);
    expect(morphProgress(MORPH_DELAY_MS - 1)).toBe(0);
    expect(morphProgress(MORPH_DELAY_MS)).toBe(0);
  });

  it("지연이 끝나면 2막 사진까지 간다", () => {
    expect(morphProgress(MORPH_DELAY_MS + MORPH_DURATION_MS)).toBe(1);
    expect(morphProgress(99999)).toBe(1);
  });

  it("양끝이 느리다 (smoothstep): 절반 시점이 정확히 절반이고 그 앞뒤가 완만하다", () => {
    const half = MORPH_DELAY_MS + MORPH_DURATION_MS / 2;
    expect(morphProgress(half)).toBeCloseTo(0.5, 5);
    expect(morphProgress(MORPH_DELAY_MS + MORPH_DURATION_MS * 0.1)).toBeLessThan(0.1);
    expect(morphProgress(MORPH_DELAY_MS + MORPH_DURATION_MS * 0.9)).toBeGreaterThan(0.9);
  });

  it("끝난 시점을 안다: 끝나면 원본 그림에 자리를 넘긴다", () => {
    expect(morphDone(MORPH_DELAY_MS + MORPH_DURATION_MS - 1)).toBe(false);
    expect(morphDone(MORPH_DELAY_MS + MORPH_DURATION_MS)).toBe(true);
  });

  /*
   * 두 사진은 비율이 다르다 (1막 560×511, 2막 620×496). 각자 제 비율로 앉아야
   * 마지막 프레임이 원본 <img>의 자리와 맞는다.
   */
  it("통째로 앉히기: 넘치는 쪽이 상자에 닿고 남는 쪽은 가운데로 모인다", () => {
    const wide = containRect(620, 496, 300, 300);
    expect(wide.width).toBe(300);
    expect(wide.height).toBeCloseTo(300 * (496 / 620), 5);
    expect(wide.x).toBe(0);
    expect(wide.y).toBeCloseTo((300 - wide.height) / 2, 5);

    const tall = containRect(496, 620, 300, 300);
    expect(tall.height).toBe(300);
    expect(tall.x).toBeCloseTo((300 - tall.width) / 2, 5);
  });

  it("두 사진의 비율이 다르면 앉는 자리도 다르다", () => {
    const phase1 = containRect(560, 511, 400, 400);
    const phase2 = containRect(620, 496, 400, 400);
    expect(phase1.height).not.toBeCloseTo(phase2.height, 1);
  });

  it("망가진 값에는 빈 자리를 준다", () => {
    expect(containRect(0, 10, 100, 100)).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    expect(bufferSize(0, 0)).toEqual({ width: 0, height: 0 });
  });

  it("버퍼는 긴 변만 줄이고 비율은 지킨다. 원래 작으면 키우지 않는다", () => {
    const big = bufferSize(1200, 900, 320);
    expect(Math.max(big.width, big.height)).toBe(320);
    expect(big.width / big.height).toBeCloseTo(1200 / 900, 2);
    expect(bufferSize(200, 150, 320)).toEqual({ width: 200, height: 150 });
  });

  it("변위는 -1~1 안에 있고, 시드가 같으면 같은 장이 나온다", () => {
    const a = bakeDisplacement(24, 18, 7);
    const b = bakeDisplacement(24, 18, 7);
    expect(a.x.length).toBe(24 * 18);
    expect(Array.from(a.x)).toEqual(Array.from(b.x));
    for (const value of a.x) expect(Math.abs(value)).toBeLessThanOrEqual(1);
    for (const value of a.y) expect(Math.abs(value)).toBeLessThanOrEqual(1);
  });

  it("가로 밀기와 세로 밀기는 서로 다른 장이다", () => {
    const field = bakeDisplacement(24, 18, 7);
    expect(Array.from(field.x)).not.toEqual(Array.from(field.y));
  });

  it("시드는 열쇠만 따른다: 같은 기억은 몇 번을 되짚어도 같은 모양이다", () => {
    expect(morphSeed("replay:frame:0")).toBe(morphSeed("replay:frame:0"));
    expect(morphSeed("replay:frame:0")).not.toBe(morphSeed("replay:ball:0"));
    expect(Number.isInteger(morphSeed(""))).toBe(true);
  });

  it("범위는 앞 그림이 담은 만큼에서 뒤 그림 전체까지 물러난다", () => {
    const within = { x: 0.12, y: 0.2125, width: 0.69, height: 0.7867 };
    expect(cameraRect(within, 0)).toEqual(within);
    expect(cameraRect(within, 1)).toEqual(WHOLE_FRAME);
    const half = cameraRect(within, 0.5);
    expect(half.width).toBeCloseTo((0.69 + 1) / 2, 5);
    expect(half.x).toBeCloseTo(0.12 / 2, 5);
  });

  /*
   * 겹쳐 세우기의 두 끝. 0에서는 앞 그림이 자리를 통째로 채우고, 1에서는 뒤 그림 안의
   * 제자리(within)로 물러난다. 그 사이 어디서든 둘이 같은 자리에 있어야 물체가 둘로
   * 보이지 않는다.
   */
  it("앞 그림은 0에서 자리를 통째로 채우고 1에서 제자리로 물러난다", () => {
    const within = { x: 0.2, y: 0.25, width: 0.6, height: 0.5 };
    const box = { x: 10, y: 20, width: 200, height: 100 };

    const start = framedRect(box, cameraRect(within, 0), within);
    expect(start.x).toBeCloseTo(box.x, 5);
    expect(start.width).toBeCloseTo(box.width, 5);
    expect(start.height).toBeCloseTo(box.height, 5);

    const end = framedRect(box, cameraRect(within, 1), within);
    expect(end.x).toBeCloseTo(box.x + 0.2 * box.width, 5);
    expect(end.width).toBeCloseTo(0.6 * box.width, 5);
  });

  it("범위 전체를 되물으면 자리 그대로다", () => {
    const box = { x: 5, y: 7, width: 80, height: 60 };
    const cam = { x: 0.1, y: 0.2, width: 0.5, height: 0.4 };
    const same = framedRect(box, cam, cam);
    expect(same.x).toBeCloseTo(box.x, 5);
    expect(same.y).toBeCloseTo(box.y, 5);
    expect(same.width).toBeCloseTo(box.width, 5);
    expect(same.height).toBeCloseTo(box.height, 5);
  });

  it("사각형 보간과 망가진 범위", () => {
    expect(
      lerpRect({ x: 0, y: 0, width: 2, height: 4 }, { x: 2, y: 4, width: 4, height: 8 }, 0.5),
    ).toEqual({ x: 1, y: 2, width: 3, height: 6 });
    const box = { x: 0, y: 0, width: 10, height: 10 };
    expect(framedRect(box, { x: 0, y: 0, width: 0, height: 0 }, WHOLE_FRAME)).toEqual(box);
  });

  it("가장자리에서 힘이 빠진다: 안쪽은 1, 테두리는 0, 밖은 0", () => {
    const rect = { x: 0, y: 0, width: 100, height: 100 };
    expect(edgeFalloff(50, 50, rect, 10)).toBe(1);
    expect(edgeFalloff(0, 50, rect, 10)).toBe(0);
    expect(edgeFalloff(5, 50, rect, 10)).toBeCloseTo(0.5, 5);
    expect(edgeFalloff(-20, 50, rect, 10)).toBe(0);
    expect(edgeFalloff(50, 50, rect, 0)).toBe(1);
    expect(edgeFalloff(120, 50, rect, 0)).toBe(0);
  });

  /*
   * 겹침이 풀리지 않는 조건. 자리를 범위에서 유도하면 두 그림 어느 쪽도 늘어나지
   * 않는다: 뒤 그림은 잘라낸 만큼 그대로, 앞 그림은 제 비율 그대로.
   */
  it("자리는 범위가 잘라낸 만큼의 비율을 그대로 갖는다", () => {
    const within = { x: 0.12, y: 0.2125, width: 0.69, height: 0.7867 };
    const [tailW, tailH] = [1402, 1122];
    const [headW, headH] = [1313, 1198];
    for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
      const camera = cameraRect(within, progress);
      const box = visibleBox(camera, tailW, tailH, 320, 240);
      // 뒤 그림: 잘라낸 조각의 비율과 자리의 비율이 같다 = 안 늘어난다
      expect(box.width / box.height).toBeCloseTo(
        (camera.width * tailW) / (camera.height * tailH),
        4,
      );
      // 앞 그림: 어디에 앉든 제 비율 그대로다
      const head = framedRect(box, camera, within);
      expect(head.width / head.height).toBeCloseTo(headW / headH, 2);
    }
  });

  it("범위가 전체면 자리는 그림이 통째로 앉는 자리다", () => {
    const box = visibleBox(WHOLE_FRAME, 1402, 1122, 320, 240);
    expect(box).toEqual(containRect(1402, 1122, 320, 240));
  });
});
