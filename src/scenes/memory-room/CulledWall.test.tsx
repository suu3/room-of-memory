import ReactThreeTestRenderer from "@react-three/test-renderer";
import type { Mesh, MeshStandardMaterial } from "three";
import { describe, expect, it } from "vitest";
import { useMemoryRoomStore } from "@/store/memory-room";
import { CulledWall } from "./CulledWall";
import { ROOM_SHELL_CENTER } from "./layout";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const [SHELL_CENTER_X, SHELL_CENTER_Z] = ROOM_SHELL_CENTER;
/** 앞벽을 정면으로 마주 보는 자리: 이 벽은 여기서 스러져야 한다. */
const IN_FRONT_OF_FRONT_WALL: [number, number, number] = [SHELL_CENTER_X, 6, SHELL_CENTER_Z + 12];

function WallBox({ name }: { name: string }) {
  return (
    <mesh name={name}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial />
    </mesh>
  );
}

function materialOf(
  scene: {
    findAll: (fn: (node: { props: { name?: string } }) => boolean) => { instance: unknown }[];
  },
  name: string,
) {
  const [node] = scene.findAll((child) => child.props.name === name);
  return (node.instance as Mesh).material as MeshStandardMaterial;
}

describe("CulledWall", () => {
  it("fades a mesh that mounts after the wall already started fading", async () => {
    // Suspense로 들어오는 glb가 이 경우다. 예전에는 마운트 시점 재질만 붙들고 있어서
    // 늦게 온 소품이 벽 없는 자리에 그대로 떠 있었다.
    const renderer = await ReactThreeTestRenderer.create(
      <CulledWall side="front">
        <WallBox name="early" />
      </CulledWall>,
      { camera: { position: IN_FRONT_OF_FRONT_WALL } },
    );

    await ReactThreeTestRenderer.act(async () => {
      await renderer.advanceFrames(1, 0.05);
    });
    const early = materialOf(renderer.scene, "early");
    expect(early.opacity).toBeLessThan(1);

    await renderer.update(
      <CulledWall side="front">
        <WallBox name="early" />
        <WallBox name="late" />
      </CulledWall>,
    );
    await ReactThreeTestRenderer.act(async () => {
      await renderer.advanceFrames(1, 0.05);
    });

    const late = materialOf(renderer.scene, "late");
    expect(late.transparent).toBe(true);
    expect(late.opacity).toBeCloseTo(early.opacity, 5);
    expect(late.opacity).toBeLessThan(1);

    await renderer.unmount();
  });

  it("leaves a wall that faces away from the camera alone", async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <CulledWall side="back">
        <WallBox name="standing" />
      </CulledWall>,
      { camera: { position: IN_FRONT_OF_FRONT_WALL } },
    );

    await ReactThreeTestRenderer.act(async () => {
      await renderer.advanceFrames(10, 0.05);
    });

    expect(materialOf(renderer.scene, "standing").opacity).toBe(1);
    await renderer.unmount();
  });
});

describe("CulledWall in first person", () => {
  it("keeps the wall standing while the camera is inside the head", async () => {
    // 인트로(등 뒤 시점)에서는 정면으로 마주 본 벽도 걷히지 않는다. 안에서 보면 걷힌 벽은 뚫린 방이다
    useMemoryRoomStore.setState({ started: true, introDone: false });
    try {
      const renderer = await ReactThreeTestRenderer.create(
        <CulledWall side="front">
          <WallBox name="wall" />
        </CulledWall>,
        { camera: { position: IN_FRONT_OF_FRONT_WALL } },
      );
      await ReactThreeTestRenderer.act(async () => {
        await renderer.advanceFrames(3, 0.05);
      });
      expect(materialOf(renderer.scene, "wall").opacity).toBe(1);
    } finally {
      useMemoryRoomStore.getState().reset();
    }
  });
});
