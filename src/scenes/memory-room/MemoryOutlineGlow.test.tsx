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
  selection: Set<Object3D>;
};

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
    // 근접 활성화가 화면에서 읽히려면 outer가 inner보다 세고, 둘 다 기본값(1)보다 세야 한다.
    expect(settings.inner.edgeStrength).toBeGreaterThan(1);
    expect(settings.outer.edgeStrength).toBeGreaterThan(settings.inner.edgeStrength);
    expect(settings.outer.kernelSize).toBeGreaterThan(settings.inner.kernelSize);
    expect(settings.outer.pulseSpeed).toBeGreaterThan(0);
    expect(settings).toHaveProperty("composer.autoClear", false);
    expect(settings).toHaveProperty("composer.multisampling", 2);
  });

  it("keeps the outline to exactly two passes so the composer cannot ghost", async () => {
    // autoClear가 꺼진 컴포저에서 Outline 패스가 셋이 되면 프레임이 쌓여 화면에
    // 금빛 잔상이 눌어붙는다. 등급은 패스를 더 다는 게 아니라 선택을 갈라서 낸다.
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
    // 윤곽선은 받는다 — 만질 수 있다는 신호는 곁가지에도 있어야 한다
    expect([...contourPass(effects).selection].map(({ name }) => name).sort()).toEqual([
      "ball-visual",
      "bat-visual",
    ]);
    // 헤일로는 못 받는다 — 곁가지가 기억처럼 숨쉬면 이야기인 척하는 게 된다
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
