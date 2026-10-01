import { describe, expect, it } from "vitest";
import { sunShadowAutoUpdate } from "./sun-shadow";

describe("sunShadowAutoUpdate", () => {
  it("그림자맵이 아직 없으면 볕이 꺼져 있어도 그린다. 새 게임은 볕 0으로 시작하는데, 맵이 없으면 그림자 받는 메쉬가 전부 안 그려진다", () => {
    expect(sunShadowAutoUpdate(0, false)).toBe(true);
    expect(sunShadowAutoUpdate(0.005, false)).toBe(true);
  });

  it("맵이 생긴 뒤에는 볕이 꺼지면 다시 그리지 않는다 (거실처럼 창 없는 공간의 성능)", () => {
    expect(sunShadowAutoUpdate(0, true)).toBe(false);
    expect(sunShadowAutoUpdate(0.01, true)).toBe(false);
  });

  it("볕이 켜져 있으면 맵 유무와 상관없이 그린다", () => {
    expect(sunShadowAutoUpdate(0.02, true)).toBe(true);
    expect(sunShadowAutoUpdate(3, false)).toBe(true);
  });
});
