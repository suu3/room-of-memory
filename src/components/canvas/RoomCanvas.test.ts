/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from "vitest";
import type { MemoryId } from "@/data/memory-room";
import { useMemoryRoomStore } from "@/store/memory-room";
import {
  canInitializeWebGL,
  dispatchMemoryInteraction,
  handleRoomInteractionKeyDown,
  roomZoomForViewport,
} from "./room-canvas-runtime";

describe("roomZoomForViewport", () => {
  it("keeps the desktop framing and zooms out on narrow screens", () => {
    expect(roomZoomForViewport(1440, 900)).toBeCloseTo(64);
    expect(roomZoomForViewport(390, 844)).toBeLessThan(30);
    expect(roomZoomForViewport(390, 844)).toBeLessThan(roomZoomForViewport(1024, 768));
  });

  it("uses height as the limiting axis after a landscape resize", () => {
    expect(roomZoomForViewport(844, 390)).toBeCloseTo(27.73, 1);
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
