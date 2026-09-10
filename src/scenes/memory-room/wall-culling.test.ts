import { describe, expect, it } from "vitest";
import { CAMERA_PRESETS } from "./layout";
import { WALL_SIDES, wallOpacity } from "./wall-culling";

/** 기본 구도에서 카메라가 방 중심 기준 어느 쪽에 있는지 (XZ). */
const BASE_DIR_X = CAMERA_PRESETS.room.position[0] - CAMERA_PRESETS.room.target[0];
const BASE_DIR_Z = CAMERA_PRESETS.room.position[2] - CAMERA_PRESETS.room.target[2];

describe("wallOpacity", () => {
  it("keeps the far walls and clears the near ones at the default framing", () => {
    // 기본 카메라는 +X/+Z 사분면에 있다. 앞·오른쪽 벽이 방을 가린다
    expect(wallOpacity("front", BASE_DIR_X, BASE_DIR_Z)).toBe(0);
    expect(wallOpacity("right", BASE_DIR_X, BASE_DIR_Z)).toBe(0);
    expect(wallOpacity("back", BASE_DIR_X, BASE_DIR_Z)).toBe(1);
    expect(wallOpacity("left", BASE_DIR_X, BASE_DIR_Z)).toBe(1);
  });

  it("keeps every focus preset in the same quadrant as the default framing", () => {
    // 프리셋마다 가려지는 벽이 달라지면 오브젝트를 조사할 때 방이 열렸다 닫혔다 한다.
    // calendar 프리셋은 앞벽과 이루는 각이 얕아 완전히 0까지는 안 떨어진다.
    // 눈에 안 보이는 수준(<0.1)이면 충분하다.
    for (const preset of Object.values(CAMERA_PRESETS)) {
      const dirX = preset.position[0] - preset.target[0];
      const dirZ = preset.position[2] - preset.target[2];
      expect(wallOpacity("front", dirX, dirZ)).toBeLessThan(0.1);
      expect(wallOpacity("right", dirX, dirZ)).toBeLessThan(0.1);
      expect(wallOpacity("back", dirX, dirZ)).toBe(1);
      expect(wallOpacity("left", dirX, dirZ)).toBe(1);
    }
  });

  it("keeps walls that are edge-on to the camera", () => {
    // 카메라가 +X 정면에 있으면 오른쪽 벽만 가린다. 앞·뒷벽은 화면 옆구리라
    // 아무것도 안 가리므로 남아야 한다. 여기서 지우면 방 옆면이 뚫린다.
    expect(wallOpacity("right", 1, 0)).toBe(0);
    expect(wallOpacity("left", 1, 0)).toBe(1);
    expect(wallOpacity("front", 1, 0)).toBe(1);
    expect(wallOpacity("back", 1, 0)).toBe(1);
  });

  it("never leaves the room fully open or fully boxed in", () => {
    // 어느 각도에서든 적어도 두 면은 남고, 적어도 한 면은 걷힌다
    for (let step = 0; step < 32; step += 1) {
      const angle = (step / 32) * Math.PI * 2;
      const opacities = WALL_SIDES.map((side) =>
        wallOpacity(side, Math.cos(angle), Math.sin(angle)),
      );
      expect(opacities.filter((value) => value > 0.5).length).toBeGreaterThanOrEqual(2);
      expect(Math.min(...opacities)).toBeLessThan(0.5);
    }
  });

  it("falls back to solid walls for a degenerate direction", () => {
    expect(wallOpacity("front", 0, 0)).toBe(1);
    expect(wallOpacity("front", Number.NaN, 0)).toBe(1);
  });
});
