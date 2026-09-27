import { describe, expect, it } from "vitest";
import {
  NEIGHBOR_LIGHT,
  NEIGHBOR_PARALLAX_X,
  neighborLightOffset,
  neighborLightOpacity,
  neighborLightVisible,
} from "./neighbor-light";

describe("neighborLightOffset", () => {
  const opening = { width: 2.84, height: 2.4 };

  it("보이는 자리(시차 보정 뒤)가 창 개구부 안쪽 지평선 띠에 있고, 닫힌 커튼의 가운데 틈은 피한다", () => {
    const [x, y] = neighborLightOffset(opening);
    const seenX = x + NEIGHBOR_PARALLAX_X;
    const haloHalf = (NEIGHBOR_LIGHT.size[0] * NEIGHBOR_LIGHT.halo) / 2;
    // 후광까지 개구부 안에
    expect(seenX - haloHalf).toBeGreaterThan(-opening.width / 2);
    // 후광의 오른쪽 끝이 가운데 틈(대략 ±0.3)에 닿지 않는다: 닿으면 타이틀에서 커튼 사이로 노란 조각이 선다
    expect(seenX + haloHalf).toBeLessThan(-0.3);
    expect(Math.abs(y)).toBeLessThan(opening.height / 2 - NEIGHBOR_LIGHT.size[1]);
    expect(y).toBeLessThan(0);
  });
});

describe("neighborLightVisible", () => {
  it("생존자 방송을 들은 뒤에만 켜진다. 되돌아가지 않는 값이다", () => {
    expect(neighborLightVisible({ revisited: [] })).toBe(false);
    expect(neighborLightVisible({ revisited: ["radio"] })).toBe(true);
  });
});

describe("neighborLightOpacity", () => {
  it("켜지면 몇 초에 걸쳐 차오른다. 번쩍이지 않는다", () => {
    let opacity = 0;
    opacity = neighborLightOpacity(opacity, true, 1 / 60);
    // 한 프레임에 1%도 안 오른다: 초당 3회 밝기 변화 규칙(DESIGN.md)과는 아예 다른 시간 축이다
    expect(opacity).toBeGreaterThan(0);
    expect(opacity).toBeLessThan(0.02);
    for (let frame = 0; frame < 60 * 12; frame += 1) {
      opacity = neighborLightOpacity(opacity, true, 1 / 60);
    }
    expect(opacity).toBeGreaterThan(0.95);
    expect(opacity).toBeLessThanOrEqual(1);
  });

  it("꺼져 있으면 0에 머문다", () => {
    expect(neighborLightOpacity(0, false, 1)).toBe(0);
  });

  it("모션을 끈 사람에게는 바로 켜진다", () => {
    expect(neighborLightOpacity(0, true, 1 / 60, true)).toBe(1);
  });

  it("delta가 이상해도 0~1을 벗어나지 않는다", () => {
    expect(neighborLightOpacity(0.5, true, Number.NaN)).toBe(0.5);
    expect(neighborLightOpacity(0.5, true, 1e9)).toBeLessThanOrEqual(1);
  });
});
