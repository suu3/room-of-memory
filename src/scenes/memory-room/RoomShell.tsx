import type {} from "@react-three/fiber";
import {
  ROOM_DOOR_POSITION,
  ROOM_DOOR_ROTATION,
  ROOM_SHELL_BOUNDS,
  ROOM_SHELL_CENTER,
} from "./layout";
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

const SHELL_WIDTH = ROOM_SHELL_BOUNDS.maxX - ROOM_SHELL_BOUNDS.minX;
const SHELL_DEPTH = ROOM_SHELL_BOUNDS.maxZ - ROOM_SHELL_BOUNDS.minZ;
const [SHELL_CENTER_X, SHELL_CENTER_Z] = ROOM_SHELL_CENTER;

const SHELL = {
  floor: {
    size: [SHELL_WIDTH, 0.22, SHELL_DEPTH],
    position: [SHELL_CENTER_X, -0.12, SHELL_CENTER_Z],
  },
  backWall: {
    size: [SHELL_WIDTH, 4.8, 0.18],
    position: [SHELL_CENTER_X, 2.3, ROOM_SHELL_BOUNDS.minZ],
  },
  leftWall: {
    size: [0.18, 4.8, SHELL_DEPTH],
    position: [ROOM_SHELL_BOUNDS.minX, 2.3, SHELL_CENTER_Z],
  },
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
  {
    size: [SHELL_WIDTH, 0.12, 0.14],
    position: [SHELL_CENTER_X, 0.01, ROOM_SHELL_BOUNDS.minZ],
  },
  {
    size: [SHELL_WIDTH, 0.12, 0.14],
    position: [SHELL_CENTER_X, 0.01, ROOM_SHELL_BOUNDS.maxZ],
  },
  {
    size: [0.14, 0.12, SHELL_DEPTH],
    position: [ROOM_SHELL_BOUNDS.minX, 0.01, SHELL_CENTER_Z],
  },
  {
    size: [0.14, 0.12, SHELL_DEPTH],
    position: [ROOM_SHELL_BOUNDS.maxX, 0.01, SHELL_CENTER_Z],
  },
] as const satisfies readonly { size: Vec3Tuple; position: Vec3Tuple }[];

export function RoomShell({ palette, doorReady }: { palette: RoomPalette; doorReady: boolean }) {
  return (
    <group name="room-shell">
      <ShellBox {...SHELL.floor} color={palette.mist} receiveShadow />
      <ShellBox {...SHELL.backWall} color={palette.slate} receiveShadow />
      <ShellBox {...SHELL.leftWall} color={palette.slate} receiveShadow />

      <group position={[1.15, 2.55, -3.88]}>
        <ShellPlane size={[2.84, 2.4]} position={[0, 0, 0]} color={palette.dusk} opacity={0.72} />
        {WINDOW_FRAME.map((part) => (
          <ShellBox key={part.position.join(":")} {...part} color={palette.bone} castShadow />
        ))}
      </group>

      <group position={ROOM_DOOR_POSITION} rotation={ROOM_DOOR_ROTATION}>
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
        size={[SHELL_WIDTH - 0.32, 0.3, 0.14]}
        position={[SHELL_CENTER_X, 0.15, ROOM_SHELL_BOUNDS.minZ + 0.16]}
        color={palette.bone}
        castShadow
        receiveShadow
      />
      <ShellBox
        size={[0.14, 0.3, SHELL_DEPTH - 0.32]}
        position={[ROOM_SHELL_BOUNDS.minX + 0.16, 0.15, SHELL_CENTER_Z]}
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
