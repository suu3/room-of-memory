"use client";

import { Vector2 } from "three";
import { InteriorBox as Box, InteriorCylinder as Cylinder } from "./InteriorPrimitives";
import { BATHROOM_COLLIDERS, BATHROOM_SHELL_BOUNDS } from "./layout";
import type { RoomPalette } from "./palette";

const [toilet, sink, tub] = BATHROOM_COLLIDERS;
const sinkX = (sink.minX + sink.maxX) / 2;
// Outer ceramic wall turns over the rim and descends into the bowl.
const BOWL_PROFILE = [
  [0.13, 0.12],
  [0.17, 0.2],
  [0.24, 0.3],
  [0.285, 0.4],
  [0.28, 0.445],
  [0.235, 0.455],
  [0.205, 0.405],
  [0.16, 0.32],
  [0.09, 0.27],
  [0, 0.27],
].map(([radius, height]) => new Vector2(radius, height));

function Faucet({ palette }: { palette: RoomPalette }) {
  return (
    <group name="basin-faucet">
      <Cylinder
        position={[0, 0.1, 0]}
        radius={0.033}
        height={0.2}
        color={palette.trim}
        metalness={0.8}
      />
      <Box
        position={[0, 0.2, -0.065]}
        size={[0.075, 0.05, 0.18]}
        color={palette.trim}
        metalness={0.8}
        roughness={0.23}
      />
      <Box
        position={[0.075, 0.13, 0]}
        size={[0.13, 0.027, 0.045]}
        color={palette.trim}
        metalness={0.8}
      />
    </group>
  );
}

function Toilet({ palette }: { palette: RoomPalette }) {
  return (
    <group
      name="ceramic-toilet"
      position={[(toilet.minX + toilet.maxX) / 2 + 0.025, 0, toilet.minZ + 0.35]}
    >
      <Box
        position={[0, 0.08, 0.04]}
        size={[0.4, 0.16, 0.52]}
        color={palette.linen}
        radius={0.07}
        roughness={0.25}
      />
      <mesh position={[0, 0, -0.03]} scale={[0.85, 1, 1.08]} castShadow receiveShadow>
        <latheGeometry args={[BOWL_PROFILE, 32]} />
        <meshStandardMaterial color={palette.linen} roughness={0.23} />
      </mesh>
      <mesh position={[0, 0.285, -0.03]} rotation={[-Math.PI / 2, 0, 0]} scale={[0.085, 0.105, 1]}>
        <circleGeometry args={[1, 32]} />
        <meshStandardMaterial color={palette.deep} roughness={0.4} />
      </mesh>
      <mesh
        position={[0, 0.47, -0.03]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[0.85, 1.08, 1]}
        castShadow
      >
        <torusGeometry args={[0.255, 0.042, 8, 32]} />
        <meshStandardMaterial color={palette.linen} roughness={0.2} />
      </mesh>
      <Box
        position={[0, 0.63, 0.3]}
        size={[0.57, 0.58, 0.19]}
        color={palette.linen}
        radius={0.065}
        roughness={0.24}
      />
      <Box
        position={[0, 0.938, 0.3]}
        size={[0.59, 0.05, 0.21]}
        color={palette.linen}
        roughness={0.2}
      />
      <Cylinder
        position={[0.12, 0.967, 0.3]}
        radius={0.045}
        height={0.015}
        color={palette.trim}
        metalness={0.75}
      />
    </group>
  );
}

function Sink({ palette }: { palette: RoomPalette }) {
  return (
    <group name="pedestal-basin" position={[sinkX, 0, sink.maxZ - 0.33]}>
      <Cylinder
        position={[0, 0.08, 0.09]}
        radius={0.19}
        topRadius={0.15}
        height={0.14}
        color={palette.linen}
      />
      <Cylinder
        position={[0, 0.39, 0.09]}
        radius={0.12}
        topRadius={0.17}
        height={0.64}
        color={palette.linen}
      />
      {/* A recessed basin with four rounded rims; the key rests on the right rim at y=.87. */}
      <Box
        position={[0, 0.7, 0]}
        size={[0.8, 0.12, 0.46]}
        color={palette.linen}
        radius={0.05}
        roughness={0.22}
      />
      <Box
        position={[0, 0.765, 0]}
        size={[0.45, 0.018, 0.29]}
        color={palette.trim}
        radius={0.007}
        roughness={0.3}
      />
      {[-0.31, 0.31].map((x) => (
        <Box
          key={x}
          position={[x, 0.8, 0]}
          size={[0.24, 0.1, 0.52]}
          color={palette.linen}
          radius={0.045}
          roughness={0.2}
        />
      ))}
      {[-0.22, 0.22].map((z) => (
        <Box
          key={z}
          position={[0, 0.8, z]}
          size={[0.44, 0.1, 0.08]}
          color={palette.linen}
          roughness={0.2}
        />
      ))}
      <Cylinder
        position={[0, 0.78, 0]}
        radius={0.035}
        height={0.01}
        color={palette.frame}
        metalness={0.8}
      />
      <group position={[0, 0.85, 0.2]}>
        <Faucet palette={palette} />
      </group>
      <Box
        position={[-0.3, 0.873, 0.04]}
        size={[0.14, 0.035, 0.19]}
        color={palette.sage}
        roughness={0.35}
      />
      <Box
        position={[-0.3, 0.904, 0.04]}
        size={[0.105, 0.035, 0.13]}
        color={palette.linen}
        radius={0.014}
      />
    </group>
  );
}

function Bathtub({ palette }: { palette: RoomPalette }) {
  const width = tub.maxX - tub.minX - 0.12;
  const depth = tub.maxZ - tub.minZ - 0.18;
  return (
    <group
      name="recessed-bathtub"
      position={[(tub.minX + tub.maxX) / 2 - 0.025, 0, (tub.minZ + tub.maxZ) / 2]}
    >
      <Box
        position={[0, 0.12, 0]}
        size={[width, 0.22, depth]}
        color={palette.linen}
        radius={0.08}
        roughness={0.28}
      />
      <Box
        position={[0, 0.239, 0]}
        size={[width - 0.15, 0.018, depth - 0.21]}
        color={palette.trim}
        roughness={0.32}
      />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Box
            position={[side * (width / 2 - 0.05), 0.37, 0]}
            size={[0.1, 0.51, depth]}
            color={palette.linen}
            radius={0.04}
            roughness={0.24}
          />
          <Box
            position={[0, 0.37, side * (depth / 2 - 0.065)]}
            size={[width - 0.08, 0.51, 0.13]}
            color={palette.linen}
            radius={0.055}
            roughness={0.24}
          />
        </group>
      ))}
      <Cylinder
        position={[0, 0.256, -depth / 2 + 0.3]}
        radius={0.045}
        height={0.014}
        color={palette.frame}
        metalness={0.7}
      />
      {/* The hanging cloth clears the ceramic face but stays inside the collider margin. */}
      <Box
        position={[-width / 2 + 0.085, 0.645, 0.15]}
        size={[0.18, 0.05, 0.44]}
        color={palette.fabric}
        radius={0.02}
      />
      <Box
        position={[-width / 2 - 0.014, 0.47, 0.15]}
        size={[0.025, 0.34, 0.44]}
        color={palette.fabric}
        radius={0.01}
      />
    </group>
  );
}

/** Wall-mounted fittings belong to the wall's culling group. */
export function BathroomMirror({ palette }: { palette: RoomPalette }) {
  return (
    <group
      name="bathroom-mirror-cabinet"
      position={[sinkX, 1.72, BATHROOM_SHELL_BOUNDS.maxZ - 0.15]}
    >
      <Box size={[1.02, 0.99, 0.1]} position={[0, 0, 0]} color={palette.frame} radius={0.04} />
      <Box
        size={[0.91, 0.88, 0.018]}
        position={[0, 0, -0.06]}
        color={palette.storm}
        roughness={0.14}
        metalness={0.8}
      />
      <Box
        size={[0.035, 0.76, 0.008]}
        position={[-0.37, 0.01, -0.074]}
        color={palette.trim}
        roughness={0.22}
      />
      <Box size={[1.04, 0.055, 0.25]} position={[0, -0.54, -0.045]} color={palette.trim} />
      <Cylinder position={[-0.34, -0.4, -0.07]} radius={0.065} height={0.23} color={palette.sage} />
      <Cylinder
        position={[-0.34, -0.26, -0.07]}
        radius={0.028}
        height={0.05}
        color={palette.frame}
      />
      <Cylinder
        position={[0.33, -0.415, -0.07]}
        radius={0.055}
        height={0.2}
        color={palette.linen}
      />
    </group>
  );
}

export function BathroomShower({ palette }: { palette: RoomPalette }) {
  return (
    <group
      name="shower-fittings"
      position={[BATHROOM_SHELL_BOUNDS.maxX - 0.15, 0, tub.minZ + 0.48]}
    >
      <Cylinder
        position={[-0.02, 1.75, 0]}
        radius={0.022}
        height={1.55}
        color={palette.trim}
        metalness={0.8}
      />
      <Cylinder
        position={[-0.14, 2.49, 0]}
        radius={0.022}
        height={0.27}
        rotation={[0, 0, Math.PI / 2]}
        color={palette.trim}
        metalness={0.8}
      />
      <Cylinder
        position={[-0.25, 2.44, 0]}
        radius={0.14}
        height={0.045}
        color={palette.trim}
        metalness={0.75}
      />
      <Cylinder position={[-0.25, 2.411, 0]} radius={0.115} height={0.008} color={palette.frame} />
      <Box
        position={[-0.04, 0.99, 0]}
        size={[0.12, 0.09, 0.32]}
        color={palette.trim}
        metalness={0.7}
        roughness={0.25}
      />
      <Box
        position={[-0.07, 1.38, 0.64]}
        size={[0.17, 0.045, 0.36]}
        color={palette.trim}
        metalness={0.65}
      />
      <Cylinder position={[-0.08, 1.53, 0.59]} radius={0.05} height={0.25} color={palette.sage} />
      <Cylinder
        position={[-0.08, 1.675, 0.59]}
        radius={0.028}
        height={0.04}
        color={palette.frame}
      />
    </group>
  );
}

export function BathroomFixtures({ palette }: { palette: RoomPalette }) {
  return (
    <group name="bathroom-fixtures">
      <Toilet palette={palette} />
      <Sink palette={palette} />
      <Bathtub palette={palette} />
    </group>
  );
}
