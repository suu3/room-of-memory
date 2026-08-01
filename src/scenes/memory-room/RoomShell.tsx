import type {} from "@react-three/fiber";

import type { RoomPalette } from "./palette";
import type { EulerTuple, Vec3Tuple } from "./types";

interface ShellBoxProps {
  size: Vec3Tuple;
  position: Vec3Tuple;
  color: string;
  castShadow?: boolean;
  receiveShadow?: boolean;
  emissive?: string;
  emissiveIntensity?: number;
}

function ShellBox({
  size,
  position,
  color,
  castShadow = false,
  receiveShadow = false,
  emissive = color,
  emissiveIntensity = 0,
}: ShellBoxProps) {
  return (
    <mesh position={position} castShadow={castShadow} receiveShadow={receiveShadow}>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        emissive={emissive}
        emissiveIntensity={emissiveIntensity}
        roughness={0.82}
      />
    </mesh>
  );
}

interface ShellPlaneProps {
  size: readonly [width: number, height: number];
  position: Vec3Tuple;
  rotation?: EulerTuple;
  color: string;
  opacity?: number;
}

function ShellPlane({ size, position, rotation = [0, 0, 0], color, opacity = 1 }: ShellPlaneProps) {
  return (
    <mesh position={position} rotation={rotation} receiveShadow>
      <planeGeometry args={size} />
      <meshStandardMaterial color={color} opacity={opacity} transparent={opacity < 1} />
    </mesh>
  );
}

const SHELL = {
  floor: { size: [12, 0.22, 8], position: [0, -0.12, 0] },
  backWall: { size: [12, 4.8, 0.18], position: [0, 2.3, -4] },
  rightWall: { size: [0.18, 4.8, 8], position: [6, 2.3, 0] },
} as const satisfies Record<string, { size: Vec3Tuple; position: Vec3Tuple }>;

const WINDOW_FRAME = [
  { size: [3.1, 0.16, 0.16], position: [0, 1.28, 0] },
  { size: [3.1, 0.16, 0.16], position: [0, -1.28, 0] },
  { size: [0.16, 2.72, 0.16], position: [-1.47, 0, 0] },
  { size: [0.16, 2.72, 0.16], position: [1.47, 0, 0] },
  { size: [0.1, 2.48, 0.13], position: [0, 0, 0.02] },
] as const satisfies readonly { size: Vec3Tuple; position: Vec3Tuple }[];

const DOOR_FRAME = [
  { size: [0.18, 3.62, 0.18], position: [-0.82, 0.09, 0] },
  { size: [0.18, 3.62, 0.18], position: [0.82, 0.09, 0] },
  { size: [1.82, 0.18, 0.18], position: [0, 1.81, 0] },
] as const satisfies readonly { size: Vec3Tuple; position: Vec3Tuple }[];

const FLOOR_RIM = [
  { size: [12.3, 0.12, 0.14], position: [0, 0.01, -4.06] },
  { size: [12.3, 0.12, 0.14], position: [0, 0.01, 4.06] },
  { size: [0.14, 0.12, 8], position: [-6.08, 0.01, 0] },
  { size: [0.14, 0.12, 8], position: [6.08, 0.01, 0] },
] as const satisfies readonly { size: Vec3Tuple; position: Vec3Tuple }[];

export function RoomShell({ palette, doorReady }: { palette: RoomPalette; doorReady: boolean }) {
  return (
    <group name="room-shell">
      <ShellBox {...SHELL.floor} color={palette.deep} receiveShadow />
      <ShellBox {...SHELL.backWall} color={palette.mist} receiveShadow />
      <ShellBox {...SHELL.rightWall} color={palette.slate} receiveShadow />

      <group position={[1.15, 2.55, -3.88]}>
        <ShellPlane size={[2.84, 2.4]} position={[0, 0, 0]} color={palette.dusk} opacity={0.72} />
        {WINDOW_FRAME.map((part) => (
          <ShellBox key={part.position.join(":")} {...part} color={palette.bone} castShadow />
        ))}
      </group>

      <group position={[-5, 1.7, -3.86]}>
        <ShellBox
          size={[1.45, 3.4, 0.12]}
          position={[0, 0, 0]}
          color={doorReady ? palette.memory : palette.navy}
          castShadow
          emissive={palette.memory}
          emissiveIntensity={doorReady ? 0.65 : 0}
        />
        {DOOR_FRAME.map((part) => (
          <ShellBox key={part.position.join(":")} {...part} color={palette.ink} castShadow />
        ))}
        <ShellBox size={[0.11, 0.11, 0.1]} position={[0.48, 0, 0.1]} color={palette.ember} />
      </group>

      <ShellBox
        size={[10, 0.3, 0.14]}
        position={[0.91, 0.15, -3.84]}
        color={palette.bone}
        castShadow
        receiveShadow
      />
      <ShellBox
        size={[0.14, 0.3, 7.68]}
        position={[5.84, 0.15, 0.08]}
        color={palette.bone}
        castShadow
        receiveShadow
      />

      {FLOOR_RIM.map((part) => (
        <ShellBox key={part.position.join(":")} {...part} color={palette.ink} receiveShadow />
      ))}
    </group>
  );
}
