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
  leaf: "#6aa36b",
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

async function renderDuffel() {
  return ReactThreeTestRenderer.create(
    <InteractiveMemory
      id="duffel"
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

  it("지금 조사할 수 있는 기억은 클릭 판정용 히트 구를 세운다", async () => {
    // 게임기는 성적표 뒤에 열린다 (content/memories.yaml unlockAfter)
    useMemoryRoomStore.setState({ collected: ["report-card"] });
    const renderer = await renderConsole();

    const hit = renderer.scene.findAll((node) => node.props.name === "memory-hit-console");
    expect(hit).toHaveLength(1);
    await renderer.unmount();
  });

  it("아직 안 본 채 잠긴 기억을 누르면 '지금은 아니다' 한 줄이 선다", async () => {
    // 성적표 전의 게임기: 잠겨 있고 전용 줄도 없다. 아무 반응도 없으면 고장으로 읽힌다
    const renderer = await renderConsole();
    const group = renderer.scene.find((node) => node.props.name === "memory-console");
    await renderer.fireEvent(group, "click", { stopPropagation: () => undefined });
    expect(useMemoryRoomStore.getState().remark?.id).toBe("locked");
    await renderer.unmount();
  });

  it("수집을 마친 기억은 히트 구를 내려 옆 물건의 클릭을 삼키지 않는다", async () => {
    useMemoryRoomStore.setState({ collected: ["report-card", "console"] });
    const renderer = await renderConsole();

    const hit = renderer.scene.findAll((node) => node.props.name === "memory-hit-console");
    expect(hit).toHaveLength(0);
    await renderer.unmount();
  });

  it("끝난 뒤에도 다시 펼치는 기억(달력)은 히트 구를 남긴다", async () => {
    useMemoryRoomStore.setState({ collected: ["calendar"] });
    const renderer = await ReactThreeTestRenderer.create(
      <InteractiveMemory
        id="calendar"
        palette={TEST_PALETTE}
        nearbyMemoryId={null}
        onInteract={() => undefined}
      />,
    );

    const hit = renderer.scene.findAll((node) => node.props.name === "memory-hit-calendar");
    expect(hit).toHaveLength(1);
    await renderer.unmount();
  });

  it("더플백 기억을 각진 본체와 앞주머니, 두 어깨끈이 있는 책가방으로 그린다", async () => {
    const renderer = await renderDuffel();

    expect(renderer.scene.findAll((node) => node.props.name === "backpack-body")).toHaveLength(1);
    expect(
      renderer.scene.findAll((node) => node.props.name === "backpack-front-pocket"),
    ).toHaveLength(1);
    expect(
      renderer.scene.findAll((node) => node.props.name === "backpack-shoulder-strap"),
    ).toHaveLength(2);
    await renderer.unmount();
  });
});
