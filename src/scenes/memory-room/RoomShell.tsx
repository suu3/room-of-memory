import type {} from "@react-three/fiber";
import {
  ROOM_DOOR_POSITION,
  ROOM_DOOR_ROTATION,
  ROOM_SHELL_BOUNDS,
  ROOM_SHELL_CENTER,
} from "./layout";
import type { RoomPalette } from "./palette";
import type { Vec3Tuple } from "./types";
import { WindowView } from "./WindowView";

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

const SHELL_WIDTH = ROOM_SHELL_BOUNDS.maxX - ROOM_SHELL_BOUNDS.minX;
const SHELL_DEPTH = ROOM_SHELL_BOUNDS.maxZ - ROOM_SHELL_BOUNDS.minZ;
const [SHELL_CENTER_X, SHELL_CENTER_Z] = ROOM_SHELL_CENTER;

const WALL_HEIGHT = 4.8;
const WALL_THICKNESS = 0.18;
const WALL_CENTER_Y = 2.3;

const SHELL = {
  floor: {
    size: [SHELL_WIDTH, 0.22, SHELL_DEPTH],
    position: [SHELL_CENTER_X, -0.12, SHELL_CENTER_Z],
  },
  leftWall: {
    size: [WALL_THICKNESS, WALL_HEIGHT, SHELL_DEPTH],
    position: [ROOM_SHELL_BOUNDS.minX, WALL_CENTER_Y, SHELL_CENTER_Z],
  },
} as const satisfies Record<string, { size: Vec3Tuple; position: Vec3Tuple }>;

/** 창의 중심과 유리 크기. 뒷벽 개구부와 창밖 풍경이 모두 이 값을 기준으로 잡힌다. */
export const WINDOW_CENTER = [1.15, 2.55, -3.88] as const satisfies Vec3Tuple;
export const WINDOW_OPENING = { width: 2.84, height: 2.4 } as const;

const WALL_X = { min: SHELL_CENTER_X - SHELL_WIDTH / 2, max: SHELL_CENTER_X + SHELL_WIDTH / 2 };
const WALL_Y = { min: WALL_CENTER_Y - WALL_HEIGHT / 2, max: WALL_CENTER_Y + WALL_HEIGHT / 2 };
const OPENING_X = {
  min: WINDOW_CENTER[0] - WINDOW_OPENING.width / 2,
  max: WINDOW_CENTER[0] + WINDOW_OPENING.width / 2,
};
const OPENING_Y = {
  min: WINDOW_CENTER[1] - WINDOW_OPENING.height / 2,
  max: WINDOW_CENTER[1] + WINDOW_OPENING.height / 2,
};

function wallSegment(
  x: { min: number; max: number },
  y: { min: number; max: number },
): { size: Vec3Tuple; position: Vec3Tuple } {
  return {
    size: [x.max - x.min, y.max - y.min, WALL_THICKNESS],
    position: [(x.min + x.max) / 2, (y.min + y.max) / 2, ROOM_SHELL_BOUNDS.minZ],
  };
}

/**
 * 뒷벽. 통짜 상자 하나였는데, 그러면 창이 벽에 그려진 그림일 뿐이라 밖이 안 보인다.
 * 창 개구부를 비워둔 네 조각으로 쪼개 진짜 구멍을 낸다.
 */
const BACK_WALL_SEGMENTS = [
  wallSegment({ min: WALL_X.min, max: OPENING_X.min }, WALL_Y),
  wallSegment({ min: OPENING_X.max, max: WALL_X.max }, WALL_Y),
  wallSegment(OPENING_X, { min: OPENING_Y.max, max: WALL_Y.max }),
  wallSegment(OPENING_X, { min: WALL_Y.min, max: OPENING_Y.min }),
] as const satisfies readonly { size: Vec3Tuple; position: Vec3Tuple }[];

/** 디오라마 받침. 방이 허공에 떠 있으면 모형이라는 인상이 안 산다. */
const PLINTH = [
  {
    size: [SHELL_WIDTH + 0.5, 0.14, SHELL_DEPTH + 0.5],
    position: [SHELL_CENTER_X, -0.28, SHELL_CENTER_Z],
  },
  {
    size: [SHELL_WIDTH + 0.14, 0.55, SHELL_DEPTH + 0.14],
    position: [SHELL_CENTER_X, -0.6, SHELL_CENTER_Z],
  },
] as const satisfies readonly { size: Vec3Tuple; position: Vec3Tuple }[];

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

// 왼쪽 벽 걸레받이는 문 앞에서 끊어야 한다 — 그대로 이으면 문짝 아랫부분을 가로지른다.
const DOOR_OUTER_WIDTH = 1.82;
/** 문틀 바깥까지 포함한 문의 z 범위. 문은 Y 90° 회전이라 폭이 z축을 따라 놓인다. */
export const DOOR_OPENING_Z = {
  min: ROOM_DOOR_POSITION[2] - DOOR_OUTER_WIDTH / 2,
  max: ROOM_DOOR_POSITION[2] + DOOR_OUTER_WIDTH / 2,
} as const;
const SKIRTING_START_Z = ROOM_SHELL_BOUNDS.minZ + 0.16;
export const LEFT_SKIRTING = {
  size: [0.14, 0.3, DOOR_OPENING_Z.min - SKIRTING_START_Z],
  position: [ROOM_SHELL_BOUNDS.minX + 0.16, 0.15, (SKIRTING_START_Z + DOOR_OPENING_Z.min) / 2],
} as const satisfies { size: Vec3Tuple; position: Vec3Tuple };

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

export function RoomShell({
  palette,
  doorReady,
  outsideDecay,
}: {
  palette: RoomPalette;
  doorReady: boolean;
  /** 창밖이 얼마나 무너져 보이는지 (0=평범한 야경, 1=사태 이후). */
  outsideDecay: number;
}) {
  return (
    <group name="room-shell">
      {PLINTH.map((part, index) => (
        <ShellBox
          key={part.position.join(":")}
          {...part}
          color={index === 0 ? palette.ink : palette.void}
        />
      ))}

      <ShellBox {...SHELL.floor} color={palette.mist} receiveShadow />
      {BACK_WALL_SEGMENTS.map((part) => (
        <ShellBox key={part.position.join(":")} {...part} color={palette.slate} receiveShadow />
      ))}
      <ShellBox {...SHELL.leftWall} color={palette.slate} receiveShadow />

      {/* 벽 뒤 — 개구부를 통해서만 보인다 */}
      <WindowView
        palette={palette}
        decay={outsideDecay}
        center={WINDOW_CENTER}
        width={WINDOW_OPENING.width}
        height={WINDOW_OPENING.height}
      />

      <group position={WINDOW_CENTER}>
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
        {/* 문틈으로 새는 빛 — 문 밖에도 뭔가 있다는 유일한 단서다. doorReady 금빛과
            헷갈리지 않게 세기를 낮게 잡는다. */}
        <ShellBox
          size={[1.3, 0.045, 0.05]}
          position={[0, -1.71, 0.08]}
          color={palette.memory}
          emissive={palette.memory}
          emissiveIntensity={0.9}
        />
      </group>

      <ShellBox
        size={[SHELL_WIDTH - 0.32, 0.3, 0.14]}
        position={[SHELL_CENTER_X, 0.15, ROOM_SHELL_BOUNDS.minZ + 0.16]}
        color={palette.bone}
        castShadow
        receiveShadow
      />
      <ShellBox {...LEFT_SKIRTING} color={palette.bone} castShadow receiveShadow />

      {FLOOR_RIM.map((part) => (
        <ShellBox key={part.position.join(":")} {...part} color={palette.ink} receiveShadow />
      ))}
    </group>
  );
}
