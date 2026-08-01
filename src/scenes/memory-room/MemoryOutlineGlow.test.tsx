import ReactThreeTestRenderer, { waitFor } from "@react-three/test-renderer";
import { type Mesh, type Object3D, WebGLRenderer } from "three";
import { describe, expect, it } from "vitest";
import { createMemoryOutlineSettings, MemoryGlowLayers, MemoryGlowRoot } from "./MemoryOutlineGlow";

type MemoryId = "bat" | "ball";

type OutlineEffectInstance = Object3D & {
  selection: Set<Object3D>;
};

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function createTestWebGlRenderer(defaultProps: ConstructorParameters<typeof WebGLRenderer>[0]) {
  const renderer = new WebGLRenderer(defaultProps);
  renderer.getContext().getContextAttributes = () => ({ alpha: false }) as WebGLContextAttributes;
  return renderer;
}

function MemorySelectionScene({ active }: { active: MemoryId }) {
  return (
    <MemoryGlowRoot color="#b89a5e">
      {(["bat", "ball"] as const).map((id) => (
        <MemoryGlowLayers
          key={id}
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

function hasLegacyBorderMaterial(mesh: Mesh) {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  return materials.some((material) => material.type === "ShaderMaterial");
}

describe("memory outline glow", () => {
  it("derives an occluded crisp-inner and soft-outer glow from the memory color", () => {
    const settings = createMemoryOutlineSettings("#b89a5e");

    expect(settings.edgeColor).toBe(0xb89a5e);
    expect(settings.inner).toMatchObject({ blur: false, resolutionScale: 1, xRay: false });
    expect(settings.outer).toMatchObject({ blur: true, resolutionScale: 0.5, xRay: false });
    expect(settings.outer.edgeStrength).toBeGreaterThan(settings.inner.edgeStrength);
    expect(settings).toHaveProperty("composer.autoClear", false);
    expect(settings).toHaveProperty("composer.multisampling", 2);
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
    expect(
      renderedMeshes.some(
        (mesh) => mesh.geometry.type === "BoxGeometry" || hasLegacyBorderMaterial(mesh),
      ),
    ).toBe(false);

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
});
