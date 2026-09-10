import ReactThreeTestRenderer from "@react-three/test-renderer";
import type { Mesh } from "three";
import { beforeEach, describe, expect, it } from "vitest";
import { useMemoryRoomStore } from "@/store/memory-room";
import { InteractiveMemory } from "./MemoryObjects";
import type { RoomPalette } from "./palette";

const TEST_PALETTE = {
  memory: "#d5ae78",
  ember: "#b8655a",
  wall: "#34465e",
  floor: "#626c7d",
  wood: "#998572",
  frame: "#354052",
  fabric: "#6c809e",
  linen: "#bab4a7",
  trim: "#a4a6a1",
  amber: "#bc9363",
  clay: "#a57565",
  sage: "#809289",
  storm: "#2a3d48",
  abyss: "#121c24",
  coal: "#17202a",
  deep: "#0f181e",
  void: "#060a10",
  daylight: "#c4d0de",
  sun: "#f3c98e",
} satisfies RoomPalette;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function renderConsole() {
  return ReactThreeTestRenderer.create(
    <InteractiveMemory
      id="console"
      palette={TEST_PALETTE}
      nearbyMemoryId={null}
      onInteract={() => undefined}
    />,
  );
}

describe("interactive memory helpers", () => {
  beforeEach(() => {
    useMemoryRoomStore.getState().reset();
  });

  it("수집을 마친 기억에도 방 안에 링을 그리지 않는다", async () => {
    useMemoryRoomStore.setState({ collected: ["console"] });
    const renderer = await renderConsole();

    const geometries = renderer.scene
      .findAllByType("Mesh")
      .map((node) => (node.instance as Mesh).geometry.type);
    expect(geometries).not.toContain("TorusGeometry");
    await renderer.unmount();
  });

  it("가까이 간 기억이 방을 밝히지 않는다", async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <InteractiveMemory
        id="console"
        palette={TEST_PALETTE}
        nearbyMemoryId="console"
        onInteract={() => undefined}
      />,
    );

    expect(renderer.scene.findAllByType("PointLight")).toHaveLength(0);
    await renderer.unmount();
  });

  it("클릭 판정용 히트 구는 그대로 남는다", async () => {
    const renderer = await renderConsole();

    const hit = renderer.scene.findAll((node) => node.props.name === "memory-hit-console");
    expect(hit).toHaveLength(1);
    await renderer.unmount();
  });
});
