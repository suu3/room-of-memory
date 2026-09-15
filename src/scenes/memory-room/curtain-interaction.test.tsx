import ReactThreeTestRenderer from "@react-three/test-renderer";
import type { ReactNode } from "react";
import { Ray, Raycaster, Vector3 } from "three";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMemoryRoomStore } from "@/store/memory-room";
import { resolveRoomPalette } from "./palette";
import { Curtain } from "./RoomFurniture";

vi.mock("./use-near-player", () => ({ useNearPlayer: () => true }));
vi.mock("./MemoryOutlineGlow", () => ({
  MemoryGlowSelection: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("./CurtainCloth", () => ({ CurtainCloth: () => null, CurtainRod: () => null }));
vi.mock("@/lib/audio", () => ({ playSound: vi.fn() }));

describe("curtain pointer ownership", () => {
  beforeEach(() => {
    useMemoryRoomStore.getState().reset();
    // 인트로(불 꺼진 1인칭)를 지난 뒤의 방이다. 머릿속에서는 커튼을 잡지 않는다
    useMemoryRoomStore.setState({ started: true, introDone: true });
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
  });

  for (const side of ["left", "right"] as const) {
    it(`${side}: queues a full drag until the hand arrives, then releases that same value`, async () => {
      const pull = vi.fn();
      const release = vi.fn();
      const renderer = await ReactThreeTestRenderer.create(
        <Curtain
          side={side}
          progress={0}
          palette={resolveRoomPalette()}
          onPull={pull}
          onRelease={release}
        />,
      );
      const curtain = renderer.scene.findByProps({ name: `curtain-${side}` });
      const pointer = (x: number) => ({
        ray: new Ray(new Vector3(x, 2, 0), new Vector3(0, 0, -1)),
        pointerId: 1,
        stopPropagation: vi.fn(),
        nativeEvent: { stopPropagation: vi.fn() },
      });
      await renderer.fireEvent(curtain, "pointerDown", pointer(1));
      await renderer.fireEvent(curtain, "pointerMove", pointer(side === "left" ? -1 : 3));
      await renderer.fireEvent(curtain, "pointerUp", pointer(side === "left" ? -1 : 3));
      const floor = document.createElement("div");
      document.body.append(floor);
      const walk = vi.fn();
      floor.addEventListener("click", walk);
      floor.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      expect(walk).not.toHaveBeenCalled();
      // A new real press must not be swallowed if the browser omitted the previous click.
      floor.dispatchEvent(new Event("pointerdown", { bubbles: true }));
      floor.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      expect(walk).toHaveBeenCalledOnce();
      floor.remove();
      expect(pull).not.toHaveBeenCalled();
      useMemoryRoomStore.getState().arriveAtCurtain();
      await renderer.advanceFrames(1, 1 / 60);
      expect(pull).toHaveBeenCalledWith(side, 1);
      expect(release).toHaveBeenCalledWith(side, 1, false, expect.any(Number));
      await renderer.unmount();
    });

    it(`${side}: a new press discards a previous tap queued before arrival`, async () => {
      const release = vi.fn();
      const renderer = await ReactThreeTestRenderer.create(
        <Curtain
          side={side}
          progress={0}
          palette={resolveRoomPalette()}
          onPull={vi.fn()}
          onRelease={release}
        />,
      );
      const curtain = renderer.scene.findByProps({ name: `curtain-${side}` });
      const pointer = {
        ray: new Ray(new Vector3(1, 2, 0), new Vector3(0, 0, -1)),
        pointerId: 1,
        stopPropagation: vi.fn(),
        nativeEvent: { stopPropagation: vi.fn() },
      };
      await renderer.fireEvent(curtain, "pointerDown", pointer);
      await renderer.fireEvent(curtain, "pointerUp", pointer);
      await renderer.fireEvent(curtain, "pointerDown", pointer);
      useMemoryRoomStore.getState().arriveAtCurtain();
      await renderer.advanceFrames(1, 1 / 60);
      expect(release).not.toHaveBeenCalled();
      expect(useMemoryRoomStore.getState().curtainGrab?.held).toBe(true);
      await renderer.unmount();
    });

    it(`${side}: a closing tap cannot leak to floor walking and cancel the gesture`, async () => {
      const release = vi.fn();
      const renderer = await ReactThreeTestRenderer.create(
        <Curtain
          side={side}
          progress={1}
          palette={resolveRoomPalette()}
          onPull={vi.fn()}
          onRelease={release}
        />,
      );
      const curtain = renderer.scene.findByProps({ name: `curtain-${side}` });
      const ray = new Ray(new Vector3(side === "left" ? -0.55 : 2.85, 2, 0), new Vector3(0, 0, -1));
      const stopCamera = vi.fn();
      await renderer.fireEvent(curtain, "pointerDown", {
        ray,
        pointerId: 1,
        stopPropagation: vi.fn(),
        nativeEvent: { stopPropagation: stopCamera },
      });
      expect(stopCamera).toHaveBeenCalledOnce();
      await renderer.fireEvent(curtain, "pointerUp", { pointerId: 1, stopPropagation: vi.fn() });
      const stop = vi.fn();
      await renderer.fireEvent(curtain, "click", { stopPropagation: stop });
      // Simulate the parent floor handler if R3F propagation wasn't consumed.
      if (!stop.mock.calls.length) useMemoryRoomStore.getState().walkTo(0, 0);
      expect(useMemoryRoomStore.getState().curtainGrab?.side).toBe(side);
      useMemoryRoomStore.getState().arriveAtCurtain();
      await renderer.advanceFrames(1, 1 / 60);
      expect(release).toHaveBeenCalledWith(side, 1, true, expect.any(Number));
      const hit = renderer.scene.findByProps({ name: `curtain-hit-${side}` }).instance;
      hit.updateWorldMatrix(true, false);
      const x = (side === "left" ? -0.55 : 2.85) + 0.34;
      expect(
        new Raycaster(new Vector3(x, 2, 0), new Vector3(0, 0, -1)).intersectObject(hit).length,
      ).toBeGreaterThan(0);
      await renderer.unmount();
    });
  }
});
