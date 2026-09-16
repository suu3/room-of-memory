"use client";

import { InteriorBox } from "./InteriorPrimitives";
import type { RoomPalette } from "./palette";
import type { Vec3Tuple } from "./types";

interface PianoPart {
  name: string;
  position: Vec3Tuple;
  size: Vec3Tuple;
  color: keyof RoomPalette;
}

/** 기존 가구의 로컬 좌표. 건반 높이는 비워 두고, 앞쪽은 받침과 양옆으로 지지한다. */
export const PIANO_CABINET_PARTS: readonly PianoPart[] = [
  { name: "back", position: [-14.95, 0.68, 6.285], size: [1.5, 1.32, 0.27], color: "frame" },
  { name: "top", position: [-14.95, 1.34, 6.2], size: [1.54, 0.06, 0.46], color: "wood" },
  { name: "top-bead", position: [-14.95, 1.298, 6.01], size: [1.43, 0.024, 0.06], color: "wood" },
  { name: "upper-panel", position: [-14.95, 1.18, 6.085], size: [1.3, 0.22, 0.14], color: "wood" },
  {
    name: "upper-inset",
    position: [-14.95, 1.18, 6.009],
    size: [1.15, 0.14, 0.014],
    color: "frame",
  },
  { name: "keybed", position: [-14.95, 0.841, 5.915], size: [1.5, 0.066, 0.43], color: "wood" },
  { name: "front-rail", position: [-14.95, 0.878, 5.708], size: [1.4, 0.034, 0.02], color: "wood" },
  { name: "lower-panel", position: [-14.95, 0.46, 6.073], size: [1.28, 0.64, 0.15], color: "wood" },
  {
    name: "lower-inset",
    position: [-14.95, 0.46, 5.989],
    size: [1.1, 0.48, 0.018],
    color: "frame",
  },
  { name: "plinth", position: [-14.95, 0.09, 6.13], size: [1.48, 0.12, 0.52], color: "wood" },
  {
    name: "pedal-socket",
    position: [-14.95, 0.125, 5.96],
    size: [0.43, 0.065, 0.065],
    color: "frame",
  },
  ...([-1, 1] as const).flatMap((side): PianoPart[] => [
    {
      name: `music-rest-support-${side}`,
      position: [-14.95 + side * 0.34, 1.34, 6.015],
      size: [0.05, 0.13, 0.1],
      color: "wood",
    },
    {
      name: `stile-${side}`,
      position: [-14.95 + side * 0.71, 0.68, 6.055],
      size: [0.08, 1.25, 0.21],
      color: "wood",
    },
    {
      name: `cheek-${side}`,
      position: [-14.95 + side * 0.709, 0.946, 5.91],
      size: [0.082, 0.14, 0.43],
      color: "wood",
    },
    {
      name: `leg-${side}`,
      position: [-14.95 + side * 0.68, 0.435, 5.8],
      size: [0.105, 0.79, 0.12],
      color: "wood",
    },
    {
      name: `foot-${side}`,
      position: [-14.95 + side * 0.68, 0.045, 5.91],
      size: [0.14, 0.09, 0.4],
      color: "frame",
    },
    {
      name: `leg-collar-${side}`,
      position: [-14.95 + side * 0.68, 0.744, 5.8],
      size: [0.12, 0.06, 0.14],
      color: "frame",
    },
  ]),
];

/** 열고 닫아도 두께가 같은 건반 덮개. 미니게임도 같은 부품을 쓴다. */
export const PIANO_FALLBOARD = {
  pivot: [-14.95, 1.012, 6.09] as Vec3Tuple,
  depth: 0.38,
  thickness: 0.032,
  width: 1.326,
};

export function PianoFallboard({ palette }: { palette: RoomPalette }) {
  return (
    <group name="piano-fallboard">
      <InteriorBox
        position={[0, 0, -PIANO_FALLBOARD.depth / 2]}
        size={[PIANO_FALLBOARD.width, PIANO_FALLBOARD.thickness, PIANO_FALLBOARD.depth]}
        color={palette.wood}
        radius={0.008}
        roughness={0.38}
      />
      <InteriorBox
        position={[0, 0.02, -0.335]}
        size={[0.16, 0.015, 0.024]}
        color={palette.amber}
        radius={0.006}
        metalness={0.65}
        roughness={0.3}
      />
    </group>
  );
}

export function PianoCabinet({ palette, open }: { palette: RoomPalette; open: boolean }) {
  return (
    <group name="piano-cabinet">
      {PIANO_CABINET_PARTS.map((part) => (
        <group key={part.name} name={`piano-${part.name}`}>
          <InteriorBox
            position={part.position}
            size={part.size}
            color={palette[part.color]}
            radius={0.008}
            roughness={part.color === "wood" ? 0.42 : 0.55}
          />
        </group>
      ))}
      {[-0.14, 0, 0.14].map((x) => (
        <InteriorBox
          key={x}
          position={[-14.95 + x, 0.075, 5.865]}
          size={[0.07, 0.032, 0.21]}
          color={palette.amber}
          radius={0.013}
          rotation={[-0.12, 0, 0]}
          metalness={0.72}
          roughness={0.3}
        />
      ))}
      {!open && (
        <group position={PIANO_FALLBOARD.pivot}>
          <PianoFallboard palette={palette} />
        </group>
      )}
    </group>
  );
}
