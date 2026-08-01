import ReactThreeTestRenderer from "@react-three/test-renderer";
import type { Mesh } from "three";
import { describe, expect, it } from "vitest";
import { MemoryStatusEffect } from "./MemoryStatusEffect";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("memory status effect", () => {
  it("does not illuminate the room for a nearby available memory", async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <MemoryStatusEffect status="available" memoryColor="#b89a5e" interactionRadius={1.35} />,
    );

    expect(renderer.scene.findAllByType("PointLight")).toHaveLength(0);
    await renderer.unmount();
  });

  it("keeps the completed-memory ring", async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <MemoryStatusEffect status="done" memoryColor="#b89a5e" interactionRadius={1.35} />,
    );

    expect(renderer.scene.findAllByType("Mesh")).toHaveLength(1);
    const completedRing = renderer.scene.findAllByType("Mesh")[0]?.instance as Mesh | undefined;
    expect(completedRing?.geometry.type).toBe("TorusGeometry");
    await renderer.unmount();
  });
});
