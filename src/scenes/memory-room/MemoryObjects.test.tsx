import ReactThreeTestRenderer from "@react-three/test-renderer";
import type { Mesh } from "three";
import { beforeEach, describe, expect, it } from "vitest";
import { useMemoryRoomStore } from "@/store/memory-room";
import { InteractiveMemory } from "./MemoryObjects";
import type { RoomPalette } from "./palette";

const TEST_PALETTE = {
  ink: "#171717",
  paper: "#e8e1d1",
  bone: "#c8bda5",
  memory: "#b89a5e",
  ember: "#8a4935",
  slate: "#30343b",
  mist: "#a8afb4",
  deep: "#11141a",
  dusk: "#3f3a43",
  navy: "#27313d",
  olive: "#55533d",
  storm: "#2a3d48",
  abyss: "#121c24",
  coal: "#17202a",
  void: "#060a10",
} satisfies RoomPalette;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function renderBat() {
  return ReactThreeTestRenderer.create(
    <InteractiveMemory
      id="bat"
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
    useMemoryRoomStore.setState({ collected: ["bat"] });
    const renderer = await renderBat();

    const geometries = renderer.scene
      .findAllByType("Mesh")
      .map((node) => (node.instance as Mesh).geometry.type);
    expect(geometries).not.toContain("TorusGeometry");
    await renderer.unmount();
  });

  it("가까이 간 기억이 방을 밝히지 않는다", async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <InteractiveMemory
        id="bat"
        palette={TEST_PALETTE}
        nearbyMemoryId="bat"
        onInteract={() => undefined}
      />,
    );

    expect(renderer.scene.findAllByType("PointLight")).toHaveLength(0);
    await renderer.unmount();
  });

  it("클릭 판정용 히트 구는 그대로 남는다", async () => {
    const renderer = await renderBat();

    const hit = renderer.scene.findAll((node) => node.props.name === "memory-hit-bat");
    expect(hit).toHaveLength(1);
    await renderer.unmount();
  });
});
