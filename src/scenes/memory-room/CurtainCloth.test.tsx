import ReactThreeTestRenderer from "@react-three/test-renderer";
import { createRef, StrictMode } from "react";
import { type Mesh, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { CurtainCloth } from "./CurtainCloth";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("curtain cloth mesh", () => {
  it("initialises morph weights before the first render, including StrictMode", async () => {
    const ref = createRef<Mesh>();
    const renderer = await ReactThreeTestRenderer.create(
      <StrictMode>
        <CurtainCloth side="left" palette={{ fabric: "white" }} meshRef={ref} />
      </StrictMode>,
    );
    const mesh = ref.current;
    if (!mesh?.morphTargetInfluences) throw new Error("Cloth morph weights were not initialised");
    expect(mesh.morphTargetInfluences).toEqual([0]);
    const closed = mesh.getVertexPosition(0, new Vector3());
    mesh.morphTargetInfluences[0] = 1;
    const gathered = mesh.getVertexPosition(0, new Vector3());
    expect(Math.abs(gathered.x)).toBeLessThan(Math.abs(closed.x) / 3);
    await renderer.unmount();
  });
});
