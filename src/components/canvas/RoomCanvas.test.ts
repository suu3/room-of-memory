/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from "vitest";
import type { MemoryId } from "@/data/memory-room";
import { useMemoryRoomStore } from "@/store/memory-room";
import {
  canInitializeWebGL,
  clampRoomZoomScale,
  dispatchMemoryInteraction,
  handleRoomInteractionKeyDown,
  handleRoomZoomKeyDown,
  MAX_ROOM_ZOOM_SCALE,
  MIN_ROOM_ZOOM_SCALE,
  roomZoomForViewport,
  roomZoomScaleFromPinch,
  roomZoomScaleFromWheel,
} from "./room-canvas-runtime";

describe("roomZoomForViewport", () => {
  it("keeps the desktop framing and zooms out on narrow screens", () => {
    // 방 셸의 화면 바운딩(약 17.4 x 11.0)을 여백 10% 안쪽으로 채운다
    expect(roomZoomForViewport(1440, 900)).toBeCloseTo(73.17, 1);
    expect(900 / roomZoomForViewport(1440, 900)).toBeLessThan(12.4);
    expect(900 / roomZoomForViewport(1440, 900)).toBeGreaterThan(11.0);
    expect(roomZoomForViewport(390, 844)).toBeLessThan(30);
    expect(roomZoomForViewport(390, 844)).toBeLessThan(roomZoomForViewport(1024, 768));
  });

  it("uses height as the limiting axis after a landscape resize", () => {
    expect(roomZoomForViewport(844, 390)).toBeCloseTo(31.71, 1);
  });
});

describe("room zoom scale", () => {
  it("clamps the user zoom to the framing budget", () => {
    expect(clampRoomZoomScale(1)).toBe(1);
    expect(clampRoomZoomScale(0.1)).toBe(MIN_ROOM_ZOOM_SCALE);
    expect(clampRoomZoomScale(9)).toBe(MAX_ROOM_ZOOM_SCALE);
    expect(clampRoomZoomScale(Number.NaN)).toBe(1);
    // 축소 하한에서도 벽 없는 열린 면이 화면을 지배하지 않아야 한다
    expect(MIN_ROOM_ZOOM_SCALE).toBeGreaterThanOrEqual(0.8);
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

    expect(roomZoomScaleFromPinch(1, 100, 200)).toBeCloseTo(1.7);
    expect(roomZoomScaleFromPinch(1, 100, 50)).toBe(MIN_ROOM_ZOOM_SCALE);
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
      nearbyMemoryId: "bat",
      inputLocked: false,
      interact: (id) =>
        dispatchMemoryInteraction(useMemoryRoomStore.getState(), id, (dispatchedId) => {
          dispatched.push(dispatchedId);
        }),
    });

    expect(handled).toBe(true);
    expect(event.defaultPrevented).toBe(true);
    expect(dispatched).toEqual(["bat"]);
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
