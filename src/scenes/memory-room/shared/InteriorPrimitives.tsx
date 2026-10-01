"use client";

import { RoundedBox } from "@react-three/drei";
import { useLayoutEffect, useRef } from "react";
import { Color, type InstancedMesh, Matrix4 } from "three";
import type { EulerTuple, Vec3Tuple } from "../world/types";

/** Small bevels catch the room light without changing furniture footprints. */
export function InteriorBox({
  size,
  position,
  color,
  radius = 0.025,
  roughness = 0.8,
  metalness = 0,
  rotation,
}: {
  size: Vec3Tuple;
  position: Vec3Tuple;
  color: string;
  radius?: number;
  roughness?: number;
  metalness?: number;
  rotation?: EulerTuple;
}) {
  return (
    <RoundedBox
      args={[...size]}
      position={position}
      rotation={rotation}
      radius={Math.min(radius, Math.min(...size) * 0.45)}
      smoothness={2}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial color={color} roughness={roughness} metalness={metalness} />
    </RoundedBox>
  );
}

export function InteriorCylinder({
  position,
  radius,
  height,
  color,
  topRadius = radius,
  rotation,
  metalness = 0,
}: {
  position: Vec3Tuple;
  radius: number;
  topRadius?: number;
  height: number;
  color: string;
  rotation?: EulerTuple;
  metalness?: number;
}) {
  return (
    <mesh position={position} rotation={rotation} castShadow receiveShadow>
      <cylinderGeometry args={[topRadius, radius, height, 16]} />
      <meshStandardMaterial
        color={color}
        metalness={metalness}
        roughness={metalness ? 0.28 : 0.8}
      />
    </mesh>
  );
}

/** Local XY surface, facing +Z. One draw call for all tiles/planks on a surface. */
export function InteriorSurface({
  size,
  cell,
  position,
  rotation,
  color,
  shade,
  gap = 0.012,
  roughness = 0.6,
}: {
  size: readonly [number, number];
  cell: readonly [number, number];
  position: Vec3Tuple;
  rotation?: EulerTuple;
  color: string;
  shade: string;
  gap?: number;
  roughness?: number;
}) {
  const ref = useRef<InstancedMesh>(null);
  const columns = Math.ceil(size[0] / cell[0]);
  const rows = Math.ceil(size[1] / cell[1]);
  const width = size[0] / columns;
  const height = size[1] / rows;

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const matrix = new Matrix4();
    const base = new Color(color);
    const secondary = new Color(shade);
    const tint = new Color();
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const index = row * columns + column;
        matrix.makeTranslation(
          (column - (columns - 1) / 2) * width,
          (row - (rows - 1) / 2) * height,
          0,
        );
        mesh.setMatrixAt(index, matrix);
        // Deterministic, quiet variation: no random changes on remount.
        mesh.setColorAt(
          index,
          tint.copy(base).lerp(secondary, ((row * 7 + column * 3) % 5) * 0.025),
        );
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [columns, rows, width, height, color, shade]);

  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, columns * rows]}
      position={position}
      rotation={rotation}
      receiveShadow
    >
      <boxGeometry args={[width - gap, height - gap, 0.018]} />
      <meshStandardMaterial roughness={roughness} />
    </instancedMesh>
  );
}
