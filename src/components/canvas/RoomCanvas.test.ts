/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from "vitest";
import type { MemoryId } from "@/data/memory-room";
import { wallOpacity } from "@/scenes/memory-room/wall-culling";
import { useMemoryRoomStore } from "@/store/memory-room";
import {
  canInitializeWebGL,
  clampRoomOrbit,
  clampRoomZoomScale,
  dispatchMemoryInteraction,
  handleRoomInteractionKeyDown,
  handleRoomOrbitKeyDown,
  handleRoomZoomKeyDown,
  MAX_ROOM_ORBIT,
  MAX_ROOM_ZOOM_SCALE,
  MIN_ROOM_ZOOM_SCALE,
  roomOrbitFromDrag,
  roomOverviewZoomForViewport,
  roomZoomForViewport,
  roomZoomScaleFromPinch,
  roomZoomScaleFromWheel,
} from "./room-canvas-runtime";

/** 플레이어 키(월드 유닛). 화면에서 몇 px이 되는지가 곧 "쪼끄맣냐"의 척도다. */
const PLAYER_HEIGHT_UNITS = 1.1;

describe("roomZoomForViewport", () => {
  it("frames a fixed slice of the world instead of the whole room", () => {
    // 세로 6유닛을 담는다. 방 전체(12.3)를 담던 예전 구도의 2배
    expect(roomZoomForViewport(1440, 900)).toBe(150);
    expect(900 / roomZoomForViewport(1440, 900)).toBeCloseTo(6, 1);
  });

  it("makes the character big enough to read on a phone", () => {
    const phone = roomZoomForViewport(390, 844);
    // 예전 구도에서는 폭에 맞추느라 zoom 20 → 캐릭터가 22px이었다
    expect(phone * PLAYER_HEIGHT_UNITS).toBeGreaterThan(80);
    // 세로로 빈 배경이 남지 않게 세로 시야를 되잡는다
    expect(844 / phone).toBeLessThanOrEqual(11);
  });

  it("uses height as the limiting axis when width is comfortable", () => {
    expect(roomZoomForViewport(1440, 900)).toBe(900 / 6);
    expect(roomZoomForViewport(1024, 768)).toBe(768 / 6);
  });

  it("never shows less than the minimum width on a landscape phone", () => {
    // 가로가 짧은 화면에서는 가로 하한이 구도를 정한다 (세로는 넘칠 일이 없다)
    expect(844 / roomZoomForViewport(844, 390)).toBeGreaterThanOrEqual(6.5);
  });

  it("still lets the player pull back to an overview of the whole room", () => {
    // 축소 하한까지 당기면 방 전체(가로 17.4유닛)가 거의 다 들어온다
    const pulledBack = roomZoomForViewport(1440, 900) * MIN_ROOM_ZOOM_SCALE;
    expect(1440 / pulledBack).toBeGreaterThan(17.4);
  });
});

describe("roomOverviewZoomForViewport", () => {
  it("fits the whole diorama for the title screen", () => {
    // 방 셸의 화면 바운딩(약 17.4 x 11.0)이 통째로 들어간다
    for (const [width, height] of [
      [1440, 900],
      [1024, 768],
      [390, 844],
    ]) {
      const zoom = roomOverviewZoomForViewport(width, height);
      expect(width / zoom).toBeGreaterThanOrEqual(17.4);
      expect(height / zoom).toBeGreaterThanOrEqual(11.0);
    }
  });

  it("always pulls further back than the play framing", () => {
    // 시작 버튼을 누르면 카메라가 들어가야 한다. 반대로 가면 연출이 죽는다
    for (const [width, height] of [
      [1440, 900],
      [1024, 768],
      [390, 844],
    ]) {
      expect(roomOverviewZoomForViewport(width, height)).toBeLessThan(
        roomZoomForViewport(width, height),
      );
    }
  });
});

describe("room zoom scale", () => {
  it("clamps the user zoom to the framing budget", () => {
    expect(clampRoomZoomScale(1)).toBe(1);
    expect(clampRoomZoomScale(0.1)).toBe(MIN_ROOM_ZOOM_SCALE);
    expect(clampRoomZoomScale(9)).toBe(MAX_ROOM_ZOOM_SCALE);
    expect(clampRoomZoomScale(Number.NaN)).toBe(1);
    // 사면벽이 되면서 축소해도 방이 뚫려 보이지 않는다. 전체 조망까지 당길 수 있어야 한다
    expect(MIN_ROOM_ZOOM_SCALE).toBeLessThan(0.6);
  });

  it("zooms in on a wheel-up and back out on a wheel-down", () => {
    const zoomedIn = roomZoomScaleFromWheel(1, -100);
    const zoomedOut = roomZoomScaleFromWheel(1, 100);

    expect(zoomedIn).toBeGreaterThan(1);
    expect(zoomedOut).toBeLessThan(1);
    // 지수 스텝이라 반대 방향 한 칸이 정확히 되돌린다
    expect(roomZoomScaleFromWheel(zoomedIn, 100)).toBeCloseTo(1, 6);
    expect(roomZoomScaleFromWheel(1, Number.NaN)).toBe(1);
  });

  it("never leaves the clamp through repeated wheel or pinch input", () => {
    let scale = 1;
    for (let step = 0; step < 60; step += 1) scale = roomZoomScaleFromWheel(scale, -120);
    expect(scale).toBe(MAX_ROOM_ZOOM_SCALE);
    for (let step = 0; step < 60; step += 1) scale = roomZoomScaleFromWheel(scale, 120);
    expect(scale).toBe(MIN_ROOM_ZOOM_SCALE);

    expect(roomZoomScaleFromPinch(1, 100, 200)).toBe(MAX_ROOM_ZOOM_SCALE);
    // 손가락을 절반으로 좁히는 정도(0.5배)는 이제 하한 안쪽이라 그대로 통과한다
    expect(roomZoomScaleFromPinch(1, 100, 50)).toBeCloseTo(0.5);
    expect(roomZoomScaleFromPinch(1, 100, 20)).toBe(MIN_ROOM_ZOOM_SCALE);
    expect(roomZoomScaleFromPinch(1, 0, 50)).toBe(1);
  });
});

describe("room zoom keyboard", () => {
  function zoomKey(key: string) {
    return new KeyboardEvent("keydown", { key, cancelable: true });
  }

  it("steps the zoom with +/- and resets with 0", () => {
    const applied: number[] = [];
    const apply = (next: number) => applied.push(next);

    expect(handleRoomZoomKeyDown(zoomKey("+"), { locked: false, scale: 1, apply })).toBe(true);
    expect(handleRoomZoomKeyDown(zoomKey("-"), { locked: false, scale: 1, apply })).toBe(true);
    expect(handleRoomZoomKeyDown(zoomKey("0"), { locked: false, scale: 1.5, apply })).toBe(true);

    expect(applied[0]).toBeGreaterThan(1);
    expect(applied[1]).toBeLessThan(1);
    expect(applied[2]).toBe(1);
  });

  it("ignores zoom keys while the scene input is locked", () => {
    const applied: number[] = [];
    const event = zoomKey("+");

    expect(
      handleRoomZoomKeyDown(event, { locked: true, scale: 1, apply: (n) => applied.push(n) }),
    ).toBe(false);
    expect(event.defaultPrevented).toBe(false);
    expect(applied).toEqual([]);
  });

  it("leaves unrelated keys alone", () => {
    const event = zoomKey("a");
    expect(handleRoomZoomKeyDown(event, { locked: false, scale: 1, apply: () => undefined })).toBe(
      false,
    );
    expect(event.defaultPrevented).toBe(false);
  });
});

describe("room orbit", () => {
  // 기준 방위각 46.7°에서 벗어나도 카메라는 +X/+Z 사분면(0~90°) 안에 있어야 한다.
  const BASE_AZIMUTH = Math.atan2(14.2 - 0.8, 15.4 - 1.2);

  it("keeps the camera inside the quadrant where the back and left walls stand", () => {
    expect(BASE_AZIMUTH - MAX_ROOM_ORBIT).toBeGreaterThan(0);
    expect(BASE_AZIMUTH + MAX_ROOM_ORBIT).toBeLessThan(Math.PI / 2);

    // 이 범위 안에서는 뒷벽·왼쪽 벽이 절대 걷히지 않아야 한다. 거기 붙은
    // 포스터·달력·창밖 풍경은 CulledWall 밖에 있어서, 벽이 사라지면 허공에 뜬다.
    for (let step = 0; step <= 20; step += 1) {
      const azimuth = BASE_AZIMUTH - MAX_ROOM_ORBIT + (step / 20) * MAX_ROOM_ORBIT * 2;
      const dirX = Math.cos(azimuth);
      const dirZ = Math.sin(azimuth);
      expect(wallOpacity("back", dirX, dirZ)).toBe(1);
      expect(wallOpacity("left", dirX, dirZ)).toBe(1);
    }
  });

  it("turns far enough to reveal the two walls that face the camera", () => {
    // 돌려도 앞·오른쪽 벽이 안 드러나면 사면벽을 세운 보람이 없다
    const turnedRight = BASE_AZIMUTH - MAX_ROOM_ORBIT;
    const turnedLeft = BASE_AZIMUTH + MAX_ROOM_ORBIT;
    expect(wallOpacity("front", Math.cos(turnedRight), Math.sin(turnedRight))).toBeGreaterThan(0.8);
    expect(wallOpacity("right", Math.cos(turnedLeft), Math.sin(turnedLeft))).toBeGreaterThan(0.8);
  });

  it("does not leave a wall lingering half-transparent across the turn", () => {
    // 반쯤 비치는 벽은 서 있는 것도 걷힌 것도 아니라 고장으로 읽힌다.
    // 전환 자체는 연속이라 어딘가는 지나가지만, 그 구간이 회전 범위의 한 뼘이어야 한다.
    const SAMPLES = 200;
    for (const side of ["front", "right"] as const) {
      let inBetween = 0;
      for (let step = 0; step <= SAMPLES; step += 1) {
        const azimuth = BASE_AZIMUTH - MAX_ROOM_ORBIT + (step / SAMPLES) * MAX_ROOM_ORBIT * 2;
        const opacity = wallOpacity(side, Math.cos(azimuth), Math.sin(azimuth));
        if (opacity >= 0.12 && opacity <= 0.88) inBetween += 1;
      }
      expect(inBetween / SAMPLES).toBeLessThan(0.15);
    }
  });

  it("clamps the orbit and follows the drag direction", () => {
    expect(clampRoomOrbit(0)).toBe(0);
    expect(clampRoomOrbit(5)).toBe(MAX_ROOM_ORBIT);
    expect(clampRoomOrbit(-5)).toBe(-MAX_ROOM_ORBIT);
    expect(clampRoomOrbit(Number.NaN)).toBe(0);

    expect(roomOrbitFromDrag(0, 50)).toBeLessThan(0);
    expect(roomOrbitFromDrag(0, -50)).toBeGreaterThan(0);
    expect(roomOrbitFromDrag(0, 100000)).toBe(-MAX_ROOM_ORBIT);
    expect(roomOrbitFromDrag(0, Number.NaN)).toBe(0);
  });

  it("steps with , and . and resets with 0", () => {
    const applied: number[] = [];
    const apply = (next: number) => applied.push(next);
    const orbitKey = (key: string) => new KeyboardEvent("keydown", { key, cancelable: true });

    expect(handleRoomOrbitKeyDown(orbitKey(","), { locked: false, angle: 0, apply })).toBe(true);
    expect(handleRoomOrbitKeyDown(orbitKey("."), { locked: false, angle: 0, apply })).toBe(true);
    expect(handleRoomOrbitKeyDown(orbitKey("0"), { locked: false, angle: 0.3, apply })).toBe(true);

    expect(applied[0]).toBeGreaterThan(0);
    expect(applied[1]).toBeLessThan(0);
    expect(applied[2]).toBe(0);

    // 이동(WASD·화살표)과 상호작용(E) 키를 건드리지 않는다
    for (const key of ["w", "a", "s", "d", "e", "ArrowLeft", "ArrowRight"]) {
      expect(
        handleRoomOrbitKeyDown(orbitKey(key), { locked: false, angle: 0, apply: () => undefined }),
      ).toBe(false);
    }
  });

  it("ignores orbit keys while the scene input is locked", () => {
    const event = new KeyboardEvent("keydown", { key: ",", cancelable: true });
    expect(handleRoomOrbitKeyDown(event, { locked: true, angle: 0, apply: () => undefined })).toBe(
      false,
    );
    expect(event.defaultPrevented).toBe(false);
  });
});

describe("canInitializeWebGL", () => {
  it("accepts a canvas when either WebGL context can be created", () => {
    const requestedContexts: string[] = [];
    const supportedContext = { getExtension: () => null };

    const supported = canInitializeWebGL(() => ({
      getContext: (contextId) => {
        requestedContexts.push(contextId);
        return contextId === "webgl" ? supportedContext : null;
      },
    }));

    expect(supported).toBe(true);
    expect(requestedContexts).toEqual(["webgl2", "webgl"]);
  });

  it("rejects missing and failed WebGL context creation", () => {
    expect(canInitializeWebGL(() => ({ getContext: () => null }))).toBe(false);
    expect(
      canInitializeWebGL(() => {
        throw new Error("context creation failed");
      }),
    ).toBe(false);
  });
});

describe("room interaction keyboard dispatch", () => {
  afterEach(() => useMemoryRoomStore.getState().reset());

  it("does not prevent the default or dispatch when a nearby ref points to a completed memory", () => {
    useMemoryRoomStore.getState().beginInteraction("window");
    const dispatched: MemoryId[] = [];
    const event = new KeyboardEvent("keydown", {
      code: "KeyE",
      key: "e",
      cancelable: true,
    });

    const handled = handleRoomInteractionKeyDown(event, {
      nearbyMemoryId: "window",
      inputLocked: false,
      interact: (id) =>
        dispatchMemoryInteraction(useMemoryRoomStore.getState(), id, (dispatchedId) => {
          dispatched.push(dispatchedId);
        }),
    });

    expect(handled).toBe(false);
    expect(event.defaultPrevented).toBe(false);
    expect(dispatched).toEqual([]);
  });

  it("prevents the default only after an available memory dispatches", () => {
    const dispatched: MemoryId[] = [];
    const event = new KeyboardEvent("keydown", {
      code: "KeyE",
      key: "e",
      cancelable: true,
    });

    const handled = handleRoomInteractionKeyDown(event, {
      nearbyMemoryId: "console",
      inputLocked: false,
      interact: (id) =>
        dispatchMemoryInteraction(useMemoryRoomStore.getState(), id, (dispatchedId) => {
          dispatched.push(dispatchedId);
        }),
    });

    expect(handled).toBe(true);
    expect(event.defaultPrevented).toBe(true);
    expect(dispatched).toEqual(["console"]);
  });

  it("opens closed curtains before dispatching the window memory", () => {
    let opened = false;
    const dispatched: MemoryId[] = [];

    const firstHandled = dispatchMemoryInteraction(
      useMemoryRoomStore.getState(),
      "window",
      (id) => dispatched.push(id),
      {
        curtainsOpen: false,
        openCurtains: () => {
          opened = true;
        },
      },
    );

    expect(firstHandled).toBe(true);
    expect(opened).toBe(true);
    expect(dispatched).toEqual([]);

    const secondHandled = dispatchMemoryInteraction(
      useMemoryRoomStore.getState(),
      "window",
      (id) => dispatched.push(id),
      { curtainsOpen: true, openCurtains: () => undefined },
    );

    expect(secondHandled).toBe(true);
    expect(dispatched).toEqual(["window"]);
  });
});
