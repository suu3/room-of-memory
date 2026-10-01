import { useThree } from "@react-three/fiber";
import ReactThreeTestRenderer, { waitFor } from "@react-three/test-renderer";
import { useLayoutEffect } from "react";
import { Color, Mesh, type Object3D, PerspectiveCamera, WebGLRenderer } from "three";
import { describe, expect, it } from "vitest";
import { useMemoryRoomStore } from "@/store/memory-room";
import { InteractiveMemory } from "../memory/MemoryObjects";
import type { RoomPalette } from "../world/palette";
import { setEndingLightMesh } from "./ending-light";
import {
  createMemoryOutlineSettings,
  MemoryGlowLayers,
  MemoryGlowRoot,
  MemoryGlowSelection,
  type MemoryGlowTier,
} from "./MemoryOutlineGlow";

type MemoryId = "bat" | "ball";

type OutlineEffectInstance = Object3D & {
  selection: Set<Object3D> & { layer: number };
};

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

function createTestWebGlRenderer(defaultProps: ConstructorParameters<typeof WebGLRenderer>[0]) {
  const renderer = new WebGLRenderer(defaultProps);
  renderer.getContext().getContextAttributes = () => ({ alpha: false }) as WebGLContextAttributes;
  return renderer;
}

/** 1인칭 리그(FirstPersonRig)처럼 기본 카메라를 바꿔 끼운다. */
function SwapCamera({ camera }: { camera: PerspectiveCamera }) {
  const set = useThree((state) => state.set);
  useLayoutEffect(() => {
    set({ camera });
  }, [camera, set]);
  return null;
}

function MultiSelectionScene({
  active,
  tier = "memory",
  camera,
}: {
  active: readonly MemoryId[];
  tier?: MemoryGlowTier;
  /** 주면 이 카메라로 바꿔 끼운다 (1인칭 진입의 카메라 교체). */
  camera?: PerspectiveCamera;
}) {
  return (
    <MemoryGlowRoot color="#b89a5e">
      {camera && <SwapCamera camera={camera} />}
      {(["bat", "ball"] as const).map((id) => (
        <MemoryGlowSelection key={id} selectionKey={id} tier={tier} enabled={active.includes(id)}>
          <mesh name={`${id}-visual`}>
            <sphereGeometry args={[0.5, 8, 6]} />
            <meshStandardMaterial />
          </mesh>
        </MemoryGlowSelection>
      ))}
    </MemoryGlowRoot>
  );
}

/** 기억 하나와 곁가지 하나가 동시에 켜진 방: 등급이 실제로 갈리는지 보는 자리. */
function MixedTierScene() {
  return (
    <MemoryGlowRoot color="#b89a5e">
      <MemoryGlowSelection selectionKey="bat" tier="memory" enabled>
        <mesh name="bat-visual">
          <sphereGeometry args={[0.5, 8, 6]} />
          <meshStandardMaterial />
        </mesh>
      </MemoryGlowSelection>
      <MemoryGlowSelection selectionKey="drawer" tier="prop" enabled>
        <mesh name="drawer-visual">
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial />
        </mesh>
      </MemoryGlowSelection>
    </MemoryGlowRoot>
  );
}

function MemorySelectionScene({ active }: { active: MemoryId }) {
  return (
    <MemoryGlowRoot color="#b89a5e">
      {(["bat", "ball"] as const).map((id) => (
        <MemoryGlowLayers
          key={id}
          selectionKey={id}
          enabled={active === id}
          selectionVersion={-1}
          visual={
            <mesh name={`${id}-visual`}>
              <sphereGeometry args={[0.5, 8, 6]} />
              <meshStandardMaterial />
            </mesh>
          }
          helpers={
            <>
              <mesh name={`${id}-helper`}>
                <sphereGeometry args={[0.2, 8, 6]} />
                <meshBasicMaterial />
              </mesh>
              <mesh name={`memory-hit-${id}`}>
                <sphereGeometry args={[1, 8, 6]} />
                <meshBasicMaterial transparent opacity={0} />
              </mesh>
            </>
          }
        />
      ))}
    </MemoryGlowRoot>
  );
}

function outlineEffects(renderer: Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>) {
  return renderer.scene
    .findAll((node) => node.instance.name === "OutlineEffect")
    .map((node) => node.instance as OutlineEffectInstance);
}

function selectedNames(effects: OutlineEffectInstance[]) {
  return effects.map((effect) => [...effect.selection].map((object) => object.name));
}

/**
 * 패스 순서는 MemoryGlowRoot가 정한 그대로다: [윤곽선, 헤일로].
 * 윤곽선은 만질 수 있는 것 전부가, 헤일로는 기억만 받는다.
 */
const contourPass = (effects: OutlineEffectInstance[]) => effects[0];
const haloPass = (effects: OutlineEffectInstance[]) => effects[1];

function hasLegacyBorderMaterial(mesh: Mesh) {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  return materials.some((material) => material.type === "ShaderMaterial");
}

describe("memory outline glow", () => {
  it("derives an occluded crisp-inner and soft-outer glow from the memory color", () => {
    const settings = createMemoryOutlineSettings("#b89a5e");
    const sourceLightness = new Color("#b89a5e").getHSL({ h: 0, s: 0, l: 0 }).l;
    const edgeLightness = new Color(settings.edgeColor).getHSL({ h: 0, s: 0, l: 0 }).l;
    const hiddenLightness = new Color(settings.hiddenEdgeColor).getHSL({ h: 0, s: 0, l: 0 }).l;

    expect(edgeLightness).toBeGreaterThan(sourceLightness);
    expect(hiddenLightness).toBeLessThan(edgeLightness);
    expect(settings.inner).toMatchObject({
      blur: false,
      pulseSpeed: 0,
      resolutionScale: 1,
      xRay: false,
    });
    expect(settings.outer).toMatchObject({ blur: true, resolutionScale: 0.5, xRay: true });
    /*
     * 두 패스의 selection 레이어는 절대 같으면 안 된다. OutlineEffect는 마스크를
     * camera.layers 하나로만 고르므로, 같은 레이어를 쓰면 곁가지가 헤일로 패스에
     * 딸려 들어가고 그 패스는 xRay라 방을 뚫고 나온다. <Outline>의 기본값 10을
     * 그대로 두면 정확히 이 상태가 된다. 그래서 둘 다 명시한다.
     */
    expect(settings.inner.selectionLayer).not.toBe(settings.outer.selectionLayer);
    expect(settings.inner.selectionLayer).not.toBe(10);
    expect(settings.outer.selectionLayer).not.toBe(10);
    // 근접 활성화가 화면에서 읽히려면 outer가 inner보다 세고, 둘 다 기본값(1)보다 세야 한다.
    expect(settings.inner.edgeStrength).toBeGreaterThan(1);
    expect(settings.outer.edgeStrength).toBeGreaterThan(settings.inner.edgeStrength);
    expect(settings.outer.kernelSize).toBeGreaterThan(settings.inner.kernelSize);
    expect(settings.outer.pulseSpeed).toBeGreaterThan(0);
    expect(settings).toHaveProperty("composer.autoClear", false);
    expect(settings).toHaveProperty("composer.multisampling", 2);
    // MSAA + 깊이 텍스처는 스텐실이 있어야 깊이 블릿 포맷이 맞는다 (아래 createMemoryOutlineSettings 주석)
    expect(settings).toHaveProperty("composer.stencilBuffer", true);
  });

  it("drops MSAA on touch devices, where the outline flickered frame to frame", () => {
    // 아이폰 Safari에서 MSAA 깊이 경로를 거친 윤곽선이 프레임마다 깜빡였다 (createMemoryOutlineSettings 주석)
    const touch = createMemoryOutlineSettings("#b89a5e", { touch: true });
    expect(touch).toHaveProperty("composer.multisampling", 0);
    expect(touch.inner).toEqual(createMemoryOutlineSettings("#b89a5e").inner);
  });

  it("keeps prop meshes off the halo layer so xRay edges cannot cut across the room", async () => {
    const renderer = await ReactThreeTestRenderer.create(<MixedTierScene />, {
      gl: createTestWebGlRenderer,
    });
    const effects = outlineEffects(renderer);
    const contour = contourPass(effects);
    const halo = haloPass(effects);

    expect(contour.selection.layer).not.toBe(halo.selection.layer);

    const drawer = [...contour.selection].find((object) => object.name === "drawer-visual");
    expect(drawer).toBeDefined();
    /*
     * 마스크는 레이어 하나로만 고른다. 곁가지에 헤일로 레이어까지 켜져 있으면
     * 서랍·커튼 윤곽이 xRay 패스에 실려 벽과 가구를 뚫고 나온다. 창문을 열었을 때
     * 방을 가로지르던 금빛 줄이 이것이었다.
     */
    expect(drawer?.layers.isEnabled(contour.selection.layer)).toBe(true);
    expect(drawer?.layers.isEnabled(halo.selection.layer)).toBe(false);

    await renderer.unmount();
  });

  it("clears a dropped glow's layer bits even when the camera is swapped in the same commit", async () => {
    /*
     * 방문을 여는 순간: 문짝의 금빛이 꺼지는 것과 문 넘기 1인칭(카메라 교체)이 한 커밋에 온다.
     * <Outline>은 카메라마다 이펙트를 새로 만들고, 옛 이펙트의 Selection은 아무도 비우지 않아
     * 문짝 메쉬에 선택 레이어 비트가 남았다. 마스크 패스는 비트만 보니 문짝 윤곽이 벽 너머로
     * 영원히 그려졌다 (거실에서 문짝 모양 금빛 줄, 1인칭에서 화면을 가로지르는 세로줄).
     */
    const renderer = await ReactThreeTestRenderer.create(
      <MultiSelectionScene active={["bat", "ball"]} />,
      { gl: createTestWebGlRenderer },
    );
    const [contour, halo] = outlineEffects(renderer);
    const bat = renderer.scene.find((node) => node.instance.name === "bat-visual").instance as Mesh;
    expect(bat.layers.isEnabled(contour.selection.layer)).toBe(true);
    expect(bat.layers.isEnabled(halo.selection.layer)).toBe(true);

    await renderer.update(
      <MultiSelectionScene active={["ball"]} camera={new PerspectiveCamera(68, 1, 0.05, 60)} />,
    );

    const swapped = outlineEffects(renderer);
    // 카메라가 바뀌었으니 이펙트도 새것이다
    expect(swapped[0]).not.toBe(contour);
    expect(bat.layers.isEnabled(swapped[0].selection.layer)).toBe(false);
    expect(bat.layers.isEnabled(swapped[1].selection.layer)).toBe(false);
    // 살아 있는 선택은 새 이펙트에 실려 있다
    expect(selectedNames(swapped)).toEqual([["ball-visual"], ["ball-visual"]]);

    await renderer.unmount();
  });

  it("keeps the outline to exactly two passes, one per glow tier", async () => {
    // 등급은 패스를 더 다는 게 아니라 선택을 갈라서 낸다. 패스가 늘면 레이어도
    // 같이 늘려야 하는데(위 selectionLayer 참고), 그걸 빠뜨리면 등급 구분이 조용히
    // 무너진다. 그래서 개수 자체를 고정해 둔다.
    const renderer = await ReactThreeTestRenderer.create(
      <MultiSelectionScene active={["bat", "ball"]} />,
      { gl: createTestWebGlRenderer },
    );

    expect(outlineEffects(renderer)).toHaveLength(2);

    await renderer.unmount();
  });

  it("feeds both live outlines only the active visual and hands bat directly to ball", async () => {
    const renderer = await ReactThreeTestRenderer.create(<MemorySelectionScene active="bat" />, {
      gl: createTestWebGlRenderer,
    });

    const batEffects = outlineEffects(renderer);
    expect(batEffects.map((effect) => effect.selection.size)).toEqual([1, 1]);
    expect(selectedNames(batEffects)).toEqual([["bat-visual"], ["bat-visual"]]);
    const handoffSelections = [selectedNames(batEffects)];

    const renderedMeshes = renderer.scene
      .findAllByType("Mesh")
      .map((node) => node.instance as Mesh);
    expect(renderedMeshes.map((mesh) => mesh.name).sort()).toEqual([
      "ball-helper",
      "ball-visual",
      "bat-helper",
      "bat-visual",
      "memory-hit-ball",
      "memory-hit-bat",
    ]);

    await renderer.update(<MemorySelectionScene active="ball" />);
    await waitFor(() =>
      outlineEffects(renderer).every(
        (effect) => effect.selection.size === 1 && [...effect.selection][0]?.name === "ball-visual",
      ),
    );

    const ballEffects = outlineEffects(renderer);
    expect(selectedNames(ballEffects)).toEqual([["ball-visual"], ["ball-visual"]]);
    handoffSelections.push(selectedNames(ballEffects));
    expect(handoffSelections).toEqual([
      [["bat-visual"], ["bat-visual"]],
      [["ball-visual"], ["ball-visual"]],
    ]);
    expect(
      handoffSelections.some((passes) => passes.some((selection) => selection.length === 0)),
    ).toBe(false);
    expect(
      ballEffects.every(
        (effect) => ![...effect.selection].some(({ name }) => name === "bat-visual"),
      ),
    ).toBe(true);

    await renderer.unmount();
  });

  it("glows every registered object at once and releases them independently", async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <MultiSelectionScene active={["bat", "ball"]} />,
      { gl: createTestWebGlRenderer },
    );

    // 근접한 기억과 마우스를 올린 커튼이 동시에 빛날 수 있어야 한다
    await waitFor(() => outlineEffects(renderer).every((effect) => effect.selection.size === 2));
    expect(selectedNames(outlineEffects(renderer)).map((names) => [...names].sort())).toEqual([
      ["ball-visual", "bat-visual"],
      ["ball-visual", "bat-visual"],
    ]);

    await renderer.update(<MultiSelectionScene active={["ball"]} />);
    await waitFor(() => outlineEffects(renderer).every((effect) => effect.selection.size === 1));
    expect(selectedNames(outlineEffects(renderer))).toEqual([["ball-visual"], ["ball-visual"]]);

    await renderer.update(<MultiSelectionScene active={[]} />);
    await waitFor(() => outlineEffects(renderer).every((effect) => effect.selection.size === 0));

    await renderer.unmount();
  });

  it("gives side props the outline but never the breathing halo", async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <MultiSelectionScene active={["bat", "ball"]} tier="prop" />,
      { gl: createTestWebGlRenderer },
    );

    await waitFor(() => contourPass(outlineEffects(renderer)).selection.size === 2);

    const effects = outlineEffects(renderer);
    // 윤곽선은 받는다. 만질 수 있다는 신호는 곁가지에도 있어야 한다
    expect([...contourPass(effects).selection].map(({ name }) => name).sort()).toEqual([
      "ball-visual",
      "bat-visual",
    ]);
    // 헤일로는 못 받는다. 곁가지가 기억처럼 숨쉬면 이야기인 척하는 게 된다
    expect(haloPass(effects).selection.size).toBe(0);

    await renderer.update(<MultiSelectionScene active={[]} tier="prop" />);
    await waitFor(() => contourPass(outlineEffects(renderer)).selection.size === 0);

    await renderer.unmount();
  });

  it("keeps the selected production memory free of the legacy box border", async () => {
    // 창문은 강도 3이라 강도 2(액자·폰)까지 본 방에서 빛난다
    useMemoryRoomStore.getState().reset();
    useMemoryRoomStore.setState({ collected: ["console", "ball", "frame", "phone"] });
    const renderer = await ReactThreeTestRenderer.create(
      <MemoryGlowRoot color={TEST_PALETTE.memory}>
        <InteractiveMemory
          id="window"
          palette={TEST_PALETTE}
          nearbyMemoryId="window"
          onInteract={() => undefined}
        />
      </MemoryGlowRoot>,
      { gl: createTestWebGlRenderer },
    );

    const effects = outlineEffects(renderer);
    const selectedMeshes = effects.map((effect) => [...effect.selection] as Mesh[]);
    expect(selectedMeshes.map((selection) => selection.map((mesh) => mesh.geometry.type))).toEqual([
      ["PlaneGeometry"],
      ["PlaneGeometry"],
    ]);
    expect(
      selectedMeshes.some((selection) =>
        selection.some(
          (mesh) => mesh.geometry.type === "BoxGeometry" || hasLegacyBorderMaterial(mesh),
        ),
      ),
    ).toBe(false);

    const renderedMeshes = renderer.scene
      .findAllByType("Mesh")
      .map((node) => node.instance as Mesh);
    expect(
      renderedMeshes.some(
        (mesh) => mesh.geometry.type === "BoxGeometry" || hasLegacyBorderMaterial(mesh),
      ),
    ).toBe(false);
    expect(renderedMeshes.find((mesh) => mesh.name === "memory-hit-window")).toBeDefined();

    await renderer.unmount();
  });

  it("gives the ending god rays a pass of their own so the tilt blur includes them", async () => {
    // 빛기둥과 틸트 시프트는 둘 다 합쳐도 되는 이펙트라 컴포저가 한 EffectPass로 묶는다.
    // 한 패스 안에서 틸트 시프트의 블러는 빛기둥이 얹히기 전의 화면을 읽으므로, 흐려지는
    // 위아래에는 빛기둥이 없고 또렷한 가운데 띠에만 남는다 (엔딩 문턱 화면을 가로지르던 밝은 띠).
    setEndingLightMesh(new Mesh());
    useMemoryRoomStore.setState({ endingStarted: true });

    const renderer = await ReactThreeTestRenderer.create(<MemoryGlowRoot color="#b89a5e" />, {
      gl: createTestWebGlRenderer,
    });

    try {
      await waitFor(() =>
        expect(
          renderer.scene.findAll((node) => node.instance.name === "GodRaysEffect"),
        ).toHaveLength(1),
      );
      const ownPasses = renderer.scene
        .findAll((node) => node.instance.name === "EffectPass")
        .map((node) => (node.instance as unknown as { effects: { name: string }[] }).effects)
        .map((effects) => effects.map((effect) => effect.name));
      expect(ownPasses).toContainEqual(["GodRaysEffect"]);
    } finally {
      await renderer.unmount();
      setEndingLightMesh(null);
      useMemoryRoomStore.setState({ endingStarted: false });
    }
  });
});
