import { describe, expect, it } from "vitest";
import { CAMERA_PRESETS, MEMORY_SPACE, ROOM_SHELL_BOUNDS, ROOM_SHELL_CENTER } from "./layout";
import { cameraBeyondWall, WALL_SIDES, wallOpacity, wallOpacityAt } from "./wall-culling";

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

describe("wallOpacityAt (CulledWall이 쓰는 판정)", () => {
  it("방 안으로 들어온 클로즈업은 마주 보는 벽을 걷지 않는다", () => {
    // 야구공 클로즈업: 방 중심에서 재면 왼벽이 거의 다 걷혔다. 거기 기댄 거울도 같이 사라졌다
    const { position } = CAMERA_PRESETS.ball;
    expect(
      wallOpacityAt("left", position[0], position[2], ROOM_SHELL_CENTER, ROOM_SHELL_BOUNDS),
    ).toBe(1);
  });

  it("방에서 조사하는 모든 구도에서 왼벽·뒷벽이 남는다", () => {
    for (const [id, preset] of Object.entries(CAMERA_PRESETS)) {
      if (id !== "room" && MEMORY_SPACE[id as keyof typeof MEMORY_SPACE] !== "room") continue;
      const [x, , z] = preset.position;
      for (const side of ["left", "back"] as const) {
        expect(
          wallOpacityAt(side, x, z, ROOM_SHELL_CENTER, ROOM_SHELL_BOUNDS),
          `${id} ${side}`,
        ).toBe(1);
      }
    }
  });

  it("밖에서 내려다보는 기본 구도는 예전 판정 그대로다", () => {
    const [x, , z] = CAMERA_PRESETS.room.position;
    for (const side of WALL_SIDES) {
      expect(wallOpacityAt(side, x, z, ROOM_SHELL_CENTER, ROOM_SHELL_BOUNDS)).toBe(
        wallOpacity(side, x - ROOM_SHELL_CENTER[0], z - ROOM_SHELL_CENTER[1]),
      );
    }
  });

  it("벽 바깥에 있을 때만 걷을 자격이 있다", () => {
    expect(cameraBeyondWall("left", ROOM_SHELL_BOUNDS, -6.5, 0)).toBe(true);
    expect(cameraBeyondWall("left", ROOM_SHELL_BOUNDS, -5, 0)).toBe(false);
    expect(cameraBeyondWall("front", ROOM_SHELL_BOUNDS, 0, 7)).toBe(true);
    expect(cameraBeyondWall("front", ROOM_SHELL_BOUNDS, 0, 6)).toBe(false);
  });
});
