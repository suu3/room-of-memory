import { Edges } from "@react-three/drei";
import type {} from "@react-three/fiber";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import { type Group, MathUtils } from "three";

import { type CurtainSide, curtainTargetX } from "./curtain-motion";
import { CHAIR_POSITION, CHAIR_ROTATION, DESK_POSITION, DESK_ROTATION } from "./layout";
import type { RoomPalette } from "./palette";
import type { Vec3Tuple } from "./types";

interface BoxPart {
  size: Vec3Tuple;
  position: Vec3Tuple;
  color: keyof RoomPalette;
}

interface FurnitureProps {
  palette: RoomPalette;
}

function FurnitureBox({ part, palette }: { part: BoxPart; palette: RoomPalette }) {
  return (
    <mesh position={part.position} castShadow receiveShadow>
      <boxGeometry args={part.size} />
      <meshStandardMaterial color={palette[part.color]} roughness={0.78} />
    </mesh>
  );
}

const BED_PARTS = [
  { size: [3.15, 0.35, 5.25], position: [4.65, 0.28, 2.9], color: "ink" },
  { size: [3.02, 0.42, 5.05], position: [4.65, 0.6, 2.86], color: "slate" },
  { size: [3.22, 1.4, 0.22], position: [4.65, 0.95, 0.32], color: "ink" },
  { size: [2.35, 0.24, 1.25], position: [4.65, 0.9, 1.5], color: "paper" },
] as const satisfies readonly BoxPart[];

const DESK_PARTS = [
  { size: [3.5, 0.18, 1.35], position: [0, 1.01, 0], color: "dusk" },
  { size: [0.2, 0.92, 0.2], position: [-1.57, 0.46, -0.49], color: "ink" },
  { size: [0.2, 0.92, 0.2], position: [1.57, 0.46, -0.49], color: "ink" },
  { size: [0.2, 0.92, 0.2], position: [-1.57, 0.46, 0.49], color: "ink" },
  { size: [0.2, 0.92, 0.2], position: [1.57, 0.46, 0.49], color: "ink" },
  { size: [1.18, 0.42, 1.18], position: [-0.88, 0.72, 0], color: "slate" },
] as const satisfies readonly BoxPart[];

const CHAIR_PARTS = [
  { size: [1.05, 0.16, 1.05], position: [0, 0.67, 0], color: "ink" },
  { size: [0.14, 0.585, 0.14], position: [-0.41, 0.2975, -0.41], color: "slate" },
  { size: [0.14, 0.585, 0.14], position: [0.41, 0.2975, -0.41], color: "slate" },
  { size: [0.14, 0.585, 0.14], position: [-0.41, 0.2975, 0.41], color: "slate" },
  { size: [0.14, 0.585, 0.14], position: [0.41, 0.2975, 0.41], color: "slate" },
  { size: [1.05, 0.705, 0.16], position: [0, 1.1025, 0.445], color: "dusk" },
] as const satisfies readonly BoxPart[];

const CABINET_PARTS = [
  { size: [4.4, 1.15, 0.72], position: [2.35, 0.58, -2.89], color: "dusk" },
  { size: [2.08, 0.92, 0.08], position: [1.23, 0.58, -2.49], color: "slate" },
  { size: [2.08, 0.92, 0.08], position: [3.47, 0.58, -2.49], color: "slate" },
  { size: [0.12, 0.12, 0.08], position: [2.14, 0.58, -2.49], color: "bone" },
  { size: [0.12, 0.12, 0.08], position: [2.56, 0.58, -2.49], color: "bone" },
] as const satisfies readonly BoxPart[];

const NIGHTSTAND_PARTS = [
  { size: [0.9, 0.95, 0.82], position: [6.8, 0.48, 0.75], color: "dusk" },
  { size: [0.72, 0.28, 0.08], position: [6.8, 0.72, 1.2], color: "slate" },
  { size: [0.16, 0.08, 0.06], position: [6.8, 0.72, 1.21], color: "bone" },
] as const satisfies readonly BoxPart[];

const SHELF_PARTS = [
  { size: [0.5, 0.12, 2.1], position: [-5.65, 2.95, -1.4], color: "dusk" },
  { size: [2.1, 0.12, 0.5], position: [4.35, 2.8, -3.65], color: "dusk" },
] as const satisfies readonly BoxPart[];

const CURTAIN_FOLD_PARTS = [
  { size: [0.82, 2.9, 0.16], position: [-0.52, 0, -0.02], color: "navy" },
  { size: [0.82, 2.9, 0.18], position: [0, 0, 0.03], color: "navy" },
  { size: [0.82, 2.9, 0.16], position: [0.52, 0, -0.02], color: "navy" },
] as const satisfies readonly BoxPart[];

function BoxParts({ parts, palette }: { parts: readonly BoxPart[]; palette: RoomPalette }) {
  return parts.map((part) => (
    <FurnitureBox key={part.position.join(":")} part={part} palette={palette} />
  ));
}

function Bed({ palette }: FurnitureProps) {
  return (
    <group name="bed">
      <BoxParts parts={BED_PARTS} palette={palette} />
    </group>
  );
}

function Desk({ palette }: FurnitureProps) {
  return (
    <group name="desk" position={DESK_POSITION} rotation={DESK_ROTATION}>
      <BoxParts parts={DESK_PARTS} palette={palette} />
      <DeskAccessories palette={palette} />
    </group>
  );
}

function Chair({ palette }: FurnitureProps) {
  return (
    <group name="chair" position={CHAIR_POSITION} rotation={CHAIR_ROTATION}>
      <BoxParts parts={CHAIR_PARTS} palette={palette} />
    </group>
  );
}

function Cabinet({ palette }: FurnitureProps) {
  return (
    <group name="cabinet">
      <BoxParts parts={CABINET_PARTS} palette={palette} />
    </group>
  );
}

function Nightstand({ palette }: FurnitureProps) {
  return (
    <group name="nightstand">
      <BoxParts parts={NIGHTSTAND_PARTS} palette={palette} />
    </group>
  );
}

function Shelves({ palette }: FurnitureProps) {
  return (
    <group name="shelves">
      <BoxParts parts={SHELF_PARTS} palette={palette} />
    </group>
  );
}

function DeskAccessories({ palette }: FurnitureProps) {
  return (
    <group name="desk-accessories">
      <FurnitureBox
        part={{ size: [1.45, 0.9, 0.14], position: [-0.3, 1.62, -0.41], color: "ink" }}
        palette={palette}
      />
      <FurnitureBox
        part={{ size: [1.2, 0.68, 0.04], position: [-0.3, 1.62, -0.32], color: "navy" }}
        palette={palette}
      />
      <FurnitureBox
        part={{ size: [0.12, 0.42, 0.12], position: [-0.3, 1.12, -0.39], color: "ink" }}
        palette={palette}
      />
      <FurnitureBox
        part={{ size: [0.72, 0.08, 0.34], position: [-0.3, 1.13, -0.23], color: "ink" }}
        palette={palette}
      />
      <FurnitureBox
        part={{ size: [1.35, 0.07, 0.42], position: [0.15, 1.14, 0.5], color: "navy" }}
        palette={palette}
      />
      <mesh position={[1.3, 1.16, -0.25]} castShadow>
        <cylinderGeometry args={[0.22, 0.26, 0.1, 16]} />
        <meshStandardMaterial color={palette.ink} roughness={0.7} />
      </mesh>
      <mesh position={[1.3, 1.58, -0.25]} castShadow>
        <cylinderGeometry args={[0.035, 0.035, 0.78, 12]} />
        <meshStandardMaterial color={palette.slate} roughness={0.7} />
      </mesh>
      <mesh position={[1.3, 1.98, -0.25]} rotation={[0, 0, -0.28]} castShadow>
        <coneGeometry args={[0.24, 0.42, 16]} />
        <meshStandardMaterial color={palette.navy} roughness={0.65} />
      </mesh>
    </group>
  );
}

function CabinetAccessories({ palette }: FurnitureProps) {
  return (
    <group name="cabinet-accessories">
      <mesh position={[0.65, 1.23, -2.86]} castShadow>
        <cylinderGeometry args={[0.18, 0.23, 0.34, 16]} />
        <meshStandardMaterial color={palette.dusk} roughness={0.8} />
      </mesh>
      {[-0.16, 0, 0.16].map((offset, index) => (
        <mesh
          key={offset}
          position={[0.65 + offset, 1.55 + Math.abs(offset), -2.86]}
          rotation={[0, 0, (index - 1) * 0.45]}
          castShadow
        >
          <coneGeometry args={[0.13, 0.55, 10]} />
          <meshStandardMaterial color={palette.olive} roughness={0.72} />
        </mesh>
      ))}
      <FurnitureBox
        part={{ size: [0.72, 0.34, 0.45], position: [2.25, 1.32, -2.82], color: "navy" }}
        palette={palette}
      />
      <FurnitureBox
        part={{ size: [0.22, 0.22, 0.04], position: [2.25, 1.56, -2.79], color: "paper" }}
        palette={palette}
      />
      <mesh position={[3.92, 1.43, -2.48]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.28, 0.28, 0.1, 24]} />
        <meshStandardMaterial color={palette.bone} roughness={0.72} />
      </mesh>
      <mesh position={[3.92, 1.43, -2.42]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.2, 24]} />
        <meshStandardMaterial color={palette.paper} roughness={0.8} />
      </mesh>
    </group>
  );
}

function FloorAccessories({ palette }: FurnitureProps) {
  return (
    <group name="floor-accessories">
      <FurnitureBox
        part={{ size: [3.2, 0.05, 2.15], position: [0.2, 0.025, 3.65], color: "slate" }}
        palette={palette}
      />
      <FurnitureBox
        part={{ size: [0.62, 0.13, 1.02], position: [-0.12, 0.12, 3.52], color: "bone" }}
        palette={palette}
      />
      <FurnitureBox
        part={{ size: [0.62, 0.13, 1.02], position: [0.6, 0.12, 3.52], color: "bone" }}
        palette={palette}
      />
    </group>
  );
}

function Curtain({
  side,
  open,
  palette,
  onOpen,
}: FurnitureProps & {
  side: CurtainSide;
  open: boolean;
  onOpen: () => void;
}) {
  const groupRef = useRef<Group>(null);
  const [hovered, setHovered] = useState(false);
  const reducedMotion = useMemo(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );
  const initialX = useRef(curtainTargetX(side, open)).current;

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;
    group.position.x = MathUtils.damp(
      group.position.x,
      curtainTargetX(side, open),
      reducedMotion ? 18 : 5.5,
      delta,
    );
  });

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: R3F group is a Canvas pointer target.
    <group
      ref={groupRef}
      position={[initialX, 2.5, -3.72]}
      name={`curtain-${side}`}
      onClick={(event) => {
        event.stopPropagation();
        if (!open) onOpen();
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        if (!open) setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      <BoxParts parts={CURTAIN_FOLD_PARTS} palette={palette} />
      {hovered && !open ? (
        <mesh>
          <boxGeometry args={[1.9, 3, 0.26]} />
          <meshBasicMaterial transparent opacity={0.04} depthWrite={false} />
          <Edges scale={1.025} color={palette.memory} />
        </mesh>
      ) : null}
    </group>
  );
}

export function RoomFurniture({
  palette,
  curtainsOpen,
  onCurtainInteract,
}: FurnitureProps & {
  curtainsOpen: boolean;
  onCurtainInteract: () => void;
}) {
  return (
    <group name="room-furniture">
      <Bed palette={palette} />
      <Desk palette={palette} />
      <Chair palette={palette} />
      <Cabinet palette={palette} />
      <Nightstand palette={palette} />
      <Shelves palette={palette} />
      <CabinetAccessories palette={palette} />
      <FloorAccessories palette={palette} />
      <Curtain side="left" open={curtainsOpen} palette={palette} onOpen={onCurtainInteract} />
      <Curtain side="right" open={curtainsOpen} palette={palette} onOpen={onCurtainInteract} />
    </group>
  );
}
