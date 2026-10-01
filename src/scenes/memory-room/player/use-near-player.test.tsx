/** @vitest-environment jsdom */
import ReactThreeTestRenderer, { waitFor } from "@react-three/test-renderer";
import type { Object3D } from "three";
import { Vector3, WebGLRenderer } from "three";
import { beforeAll, describe, expect, it } from "vitest";
import { MemoryGlowRoot } from "../effects/MemoryOutlineGlow";
import { RoomShell } from "../rooms/room/RoomShell";
import { LIGHT_SWITCH_PLACEMENT } from "../world/layout";
import type { RoomPalette } from "../world/palette";
import { isWithin, PlayerPositionProvider } from "./use-near-player";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

const [SWITCH_X, , SWITCH_Z] = LIGHT_SWITCH_PLACEMENT.position;
const { interactionRadius } = LIGHT_SWITCH_PLACEMENT;

function createTestWebGlRenderer(defaultProps: ConstructorParameters<typeof WebGLRenderer>[0]) {
  const renderer = new WebGLRenderer(defaultProps);
  renderer.getContext().getContextAttributes = () => ({ alpha: false }) as WebGLContextAttributes;
  return renderer;
}

/*
 * RoomShell 안의 창밖 풍경(WindowView)이 2D 캔버스로 하늘 그라디언트를 굽는다.
 * jsdom에는 2D 컨텍스트가 없어서 그대로 두면 테스트가 통과하면서도 스택 트레이스를
 * 계속 뱉는다. 여기서 재는 건 글로우 선택이지 하늘색이 아니라, 최소한만 흉내 낸다.
 */
beforeAll(() => {
  const original = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function patched(
    this: HTMLCanvasElement,
    id: string,
    ...rest: unknown[]
  ) {
    if (id !== "2d") return original.call(this, id as "webgl2", ...rest);
    return {
      createLinearGradient: () => ({ addColorStop: () => {} }),
      // 하늘판에는 지는 해도 같이 구워진다 (WindowView의 useSkyTexture)
      createRadialGradient: () => ({ addColorStop: () => {} }),
      fillRect: () => {},
      beginPath: () => {},
      arc: () => {},
      fill: () => {},
      set fillStyle(_value: unknown) {},
      set globalAlpha(_value: unknown) {},
    } as unknown as CanvasRenderingContext2D;
  } as typeof HTMLCanvasElement.prototype.getContext;
});

type OutlineEffectInstance = Object3D & { selection: Set<Object3D> };

function outlineSelectionSize(renderer: Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>) {
  const effects = renderer.scene
    .findAll((node) => (node.instance as OutlineEffectInstance).selection instanceof Set)
    .map((node) => node.instance as OutlineEffectInstance);
  return effects.length === 0 ? 0 : Math.max(...effects.map((effect) => effect.selection.size));
}

/**
 * 실제 씬처럼 RoomShell을 글로우 루트 **안에** 둔다.
 *
 * 전등 스위치는 벽에 붙은 물건이라 RoomShell 안에 있는데, 예전에는 RoomShell이
 * 루트 밖이라 MemoryGlowSelection이 컨텍스트를 못 찾고 조용히 아무것도 안 했다.
 * 이 배치가 다시 깨지면 아래 "가까이 가면 빛난다"가 먼저 무너진다.
 */
function ShellScene({ player }: { player: Vector3 }) {
  return (
    <PlayerPositionProvider value={{ current: player }}>
      <MemoryGlowRoot color={TEST_PALETTE.memory}>
        <RoomShell palette={TEST_PALETTE} doorOpen={false} outsideDecay={0} />
      </MemoryGlowRoot>
    </PlayerPositionProvider>
  );
}

describe("isWithin", () => {
  it("counts the boundary as inside so the glow does not flicker on the edge", () => {
    expect(isWithin({ x: 3, z: 0 }, 0, 0, 3)).toBe(true);
    expect(isWithin({ x: 3.001, z: 0 }, 0, 0, 3)).toBe(false);
  });

  it("measures on the floor plane only: 높이는 보지 않는다", () => {
    // 스위치는 y=1.72에 붙어 있고 플레이어는 바닥을 걷는다. y까지 재면 영원히 멀다.
    expect(isWithin({ x: SWITCH_X, z: SWITCH_Z }, SWITCH_X, SWITCH_Z, interactionRadius)).toBe(
      true,
    );
  });
});

describe("light switch proximity glow", () => {
  it("stays dark while the player is across the room", async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <ShellScene player={new Vector3(SWITCH_X + interactionRadius + 1, 0, SWITCH_Z)} />,
      { gl: createTestWebGlRenderer },
    );

    expect(outlineSelectionSize(renderer)).toBe(0);
    await renderer.unmount();
  });

  it("lights up once the player walks within reach", async () => {
    // 표식이 없는 물건이라 이 빛이 "여기 눌릴 게 있다"는 유일한 신호다
    const renderer = await ReactThreeTestRenderer.create(
      <ShellScene player={new Vector3(SWITCH_X + interactionRadius - 0.2, 0, SWITCH_Z)} />,
      { gl: createTestWebGlRenderer },
    );

    await waitFor(() => outlineSelectionSize(renderer) > 0);
    expect(outlineSelectionSize(renderer)).toBeGreaterThan(0);
    await renderer.unmount();
  });
});
