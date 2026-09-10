import ReactThreeTestRenderer, { waitFor } from "@react-three/test-renderer";
import { Color, type Mesh, type Object3D, WebGLRenderer } from "three";
import { describe, expect, it } from "vitest";
import { InteractiveMemory } from "./MemoryObjects";
import {
  createMemoryOutlineSettings,
  MemoryGlowLayers,
  MemoryGlowRoot,
  MemoryGlowSelection,
  type MemoryGlowTier,
} from "./MemoryOutlineGlow";
import type { RoomPalette } from "./palette";

type MemoryId = "bat" | "ball";

type OutlineEffectInstance = Object3D & {
  selection: Set<Object3D> & { layer: number };
};

const TEST_PALETTE = {
  memory: "#d5ae78",
  ember: "#b8655a",
  wall: "#34465e",
  wallFaded: "#3d5069",
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

function createTestWebGlRenderer(defaultProps: ConstructorParameters<typeof WebGLRenderer>[0]) {
  const renderer = new WebGLRenderer(defaultProps);
  renderer.getContext().getContextAttributes = () => ({ alpha: false }) as WebGLContextAttributes;
  return renderer;
}

function MultiSelectionScene({
  active,
  tier = "memory",
}: {
  active: readonly MemoryId[];
  tier?: MemoryGlowTier;
}) {
  return (
    <MemoryGlowRoot color="#b89a5e">
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
});
