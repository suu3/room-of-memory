import { Float32BufferAttribute, PlaneGeometry } from "three";
import type { CurtainSide } from "./curtain-motion";

const WIDTH = 1.9;
const GATHERED_WIDTH = 0.36;
const HEIGHT = 2.9;

/** Static folds with a gathered morph target: two meshes, no simulation or frame allocations. */
export function createCurtainCloth(side: CurtainSide): PlaneGeometry {
  const geometry = new PlaneGeometry(WIDTH, HEIGHT, 64, 32);
  const gathered = geometry.clone();
  const uv = geometry.getAttribute("uv");
  const direction = side === "left" ? 1 : -1;
  const colors = new Float32Array(uv.count * 3);

  for (const [surface, progress] of [
    [geometry, 0],
    [gathered, 1],
  ] as const) {
    const positions = surface.getAttribute("position");
    for (let i = 0; i < uv.count; i++) {
      const u = uv.getX(i);
      const v = 1 - uv.getY(i);
      // Seven pleats; smaller diagonal wrinkles grow toward the loose lower edge.
      const phase = u * Math.PI * 14 + direction * 0.2 * Math.sin(v * 6 + u * 4) * v;
      const amplitude = 0.072 + v * 0.023 + progress * 0.036;
      const wrinkle = Math.sin(u * 73 + v * 16 * direction) * Math.sin(v * Math.PI) * 0.012;
      const hem = Math.sin(u * Math.PI * 7) ** 2;
      const y = HEIGHT / 2 - v * HEIGHT - hem * (0.015 + v * v * 0.037);
      // The parent's existing travel keeps the outer hanging edge anchored.
      const x = (u - 0.5) * (WIDTH + (GATHERED_WIDTH - WIDTH) * progress);
      const z = 0.075 + amplitude * Math.cos(phase) + wrinkle + 0.021 * v * v * Math.sin(u * 11);
      positions.setXYZ(i, x, y, z);
      // Stitched header and weighted hem, tinted only by the fabric palette token.
      const shade = v < 0.07 || v > 0.95 ? 0.87 : 1;
      colors.set([shade, shade, shade], i * 3);
    }
    surface.computeVertexNormals();
  }

  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.morphAttributes.position = [gathered.getAttribute("position").clone()];
  geometry.morphAttributes.normal = [gathered.getAttribute("normal").clone()];
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  gathered.dispose();
  return geometry;
}
