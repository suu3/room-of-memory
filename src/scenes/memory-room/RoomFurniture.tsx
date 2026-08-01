import type {} from "@react-three/fiber";

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
  { size: [3.6, 0.35, 2.3], position: [3.35, 0.28, 1.15], color: "ink" },
  { size: [3.45, 0.38, 2.18], position: [3.3, 0.58, 1.12], color: "slate" },
  { size: [0.22, 1.35, 2.35], position: [5.05, 0.92, 1.15], color: "ink" },
  { size: [0.95, 0.22, 1.72], position: [4.2, 0.86, 1.15], color: "paper" },
] as const satisfies readonly BoxPart[];

const DESK_PARTS = [
  { size: [3.5, 0.18, 1.35], position: [-3, 1.01, -2.45], color: "ink" },
  { size: [0.2, 0.92, 0.2], position: [-4.57, 0.46, -2.94], color: "slate" },
  { size: [0.2, 0.92, 0.2], position: [-1.43, 0.46, -2.94], color: "slate" },
  { size: [0.2, 0.92, 0.2], position: [-4.57, 0.46, -1.96], color: "slate" },
  { size: [0.2, 0.92, 0.2], position: [-1.43, 0.46, -1.96], color: "slate" },
  { size: [1.18, 0.42, 1.18], position: [-3.88, 0.72, -2.45], color: "dusk" },
] as const satisfies readonly BoxPart[];

const CHAIR_PARTS = [
  { size: [1.05, 0.16, 1.05], position: [-2.45, 0.67, -0.75], color: "ink" },
  { size: [0.14, 0.585, 0.14], position: [-2.86, 0.2975, -1.16], color: "slate" },
  { size: [0.14, 0.585, 0.14], position: [-2.04, 0.2975, -1.16], color: "slate" },
  { size: [0.14, 0.585, 0.14], position: [-2.86, 0.2975, -0.34], color: "slate" },
  { size: [0.14, 0.585, 0.14], position: [-2.04, 0.2975, -0.34], color: "slate" },
  { size: [1.05, 0.705, 0.16], position: [-2.45, 1.1025, -1.195], color: "dusk" },
] as const satisfies readonly BoxPart[];

const CABINET_PARTS = [
  { size: [4.4, 1.15, 0.72], position: [2.35, 0.58, -2.89], color: "ink" },
  { size: [2.08, 0.92, 0.08], position: [1.23, 0.58, -2.49], color: "slate" },
  { size: [2.08, 0.92, 0.08], position: [3.47, 0.58, -2.49], color: "slate" },
  { size: [0.12, 0.12, 0.08], position: [2.14, 0.58, -2.49], color: "bone" },
  { size: [0.12, 0.12, 0.08], position: [2.56, 0.58, -2.49], color: "bone" },
] as const satisfies readonly BoxPart[];

const NIGHTSTAND_PARTS = [
  { size: [0.9, 0.95, 0.82], position: [4.8, 0.48, 2.71], color: "ink" },
  { size: [0.72, 0.28, 0.08], position: [4.8, 0.72, 3.16], color: "slate" },
  { size: [0.16, 0.08, 0.06], position: [4.8, 0.72, 3.17], color: "bone" },
] as const satisfies readonly BoxPart[];

const SHELF_PARTS = [
  { size: [2.1, 0.12, 0.5], position: [-3.1, 2.95, -3.65], color: "ink" },
  { size: [2.1, 0.12, 0.5], position: [4.35, 2.8, -3.65], color: "ink" },
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
    <group name="desk">
      <BoxParts parts={DESK_PARTS} palette={palette} />
    </group>
  );
}

function Chair({ palette }: FurnitureProps) {
  return (
    <group name="chair">
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

function Curtain({ center, palette }: FurnitureProps & { center: Vec3Tuple }) {
  return (
    <group position={center} name="curtain">
      <BoxParts parts={CURTAIN_FOLD_PARTS} palette={palette} />
    </group>
  );
}

export function RoomFurniture({ palette }: FurnitureProps) {
  return (
    <group name="room-furniture">
      <Bed palette={palette} />
      <Desk palette={palette} />
      <Chair palette={palette} />
      <Cabinet palette={palette} />
      <Nightstand palette={palette} />
      <Shelves palette={palette} />
      <Curtain center={[-0.55, 2.5, -3.72]} palette={palette} />
      <Curtain center={[2.85, 2.5, -3.72]} palette={palette} />
    </group>
  );
}
