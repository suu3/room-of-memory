import type {} from "@react-three/fiber";
import { CulledWall } from "./CulledWall";
import { LightSwitch } from "./LightSwitch";
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
} as const satisfies Record<string, { size: Vec3Tuple; position: Vec3Tuple }>;

/**
 * 벽을 굽도리와 윗부분으로 가르는 높이. 카메라 쪽 벽은 윗부분만 스러지고
 * 굽도리는 남는다 (wall-culling.ts 참고).
 */
const WALL_STUB_TOP_Y = 0.55;

interface WallBox {
  size: Vec3Tuple;
  position: Vec3Tuple;
}

/** x축을 보고 선 벽(왼쪽·오른쪽) 한 조각. */
function sideWall(x: number, minY: number, maxY: number): WallBox {
  return {
    size: [WALL_THICKNESS, maxY - minY, SHELL_DEPTH],
    position: [x, (minY + maxY) / 2, SHELL_CENTER_Z],
  };
}

/** z축을 보고 선 벽(앞) 한 조각. 뒷벽은 창 구멍 때문에 wallSegment가 따로 짠다. */
function endWall(z: number, minY: number, maxY: number): WallBox {
  return {
    size: [SHELL_WIDTH, maxY - minY, WALL_THICKNESS],
    position: [SHELL_CENTER_X, (minY + maxY) / 2, z],
  };
}

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
 * 뒷벽 윗부분. 통짜 상자 하나였는데, 그러면 창이 벽에 그려진 그림일 뿐이라 밖이 안 보인다.
 * 창 개구부를 비워둔 네 조각으로 쪼개 진짜 구멍을 낸다.
 * 아래 끝은 굽도리 높이 — 그 아래는 BASE_WALLS가 통짜로 잇는다.
 */
const UPPER_Y = { min: WALL_STUB_TOP_Y, max: WALL_Y.max };
const BACK_WALL_SEGMENTS = [
  wallSegment({ min: WALL_X.min, max: OPENING_X.min }, UPPER_Y),
  wallSegment({ min: OPENING_X.max, max: WALL_X.max }, UPPER_Y),
  wallSegment(OPENING_X, { min: OPENING_Y.max, max: WALL_Y.max }),
  wallSegment(OPENING_X, { min: UPPER_Y.min, max: OPENING_Y.min }),
] as const satisfies readonly WallBox[];

/**
 * 네 면의 굽도리. 카메라가 어느 쪽에 있든 남아서 바닥의 테두리를 이룬다 —
 * 이게 없으면 카메라 쪽 벽이 스러진 자리에서 바닥이 허공에 뜬 판으로 보인다.
 */
const BASE_WALLS = [
  endWall(ROOM_SHELL_BOUNDS.minZ, WALL_Y.min, WALL_STUB_TOP_Y),
  endWall(ROOM_SHELL_BOUNDS.maxZ, WALL_Y.min, WALL_STUB_TOP_Y),
  sideWall(ROOM_SHELL_BOUNDS.minX, WALL_Y.min, WALL_STUB_TOP_Y),
  sideWall(ROOM_SHELL_BOUNDS.maxX, WALL_Y.min, WALL_STUB_TOP_Y),
] as const satisfies readonly WallBox[];

/** 굽도리 위로 서는 나머지 세 면 (뒷벽은 창 때문에 위에서 따로 짰다). */
const LEFT_WALL_UPPER = sideWall(ROOM_SHELL_BOUNDS.minX, WALL_STUB_TOP_Y, WALL_Y.max);
const RIGHT_WALL_UPPER = sideWall(ROOM_SHELL_BOUNDS.maxX, WALL_STUB_TOP_Y, WALL_Y.max);
const FRONT_WALL_UPPER = endWall(ROOM_SHELL_BOUNDS.maxZ, WALL_STUB_TOP_Y, WALL_Y.max);

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

/** 문짝이 도는 축 — 왼쪽 문틀 안쪽. */
const DOOR_HINGE_X = 0.73;

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

/*
 * 바닥 테두리(FLOOR_RIM)는 뺐다.
 *
 * 열린 면이 있던 디오라마 시절에는 바닥의 잘린 단면을 마감하는 몰딩이었다.
 * 사면벽이 되면서 네 면 굽도리(BASE_WALLS)가 그 자리를 통째로 감쌌고, 테두리는
 * 굽도리 안에 완전히 파묻혀 한 픽셀도 보이지 않게 됐다 — 대신 폭이 굽도리와 똑같아
 * 양 끝면이 같은 평면에 놓이면서 모서리에서 깜빡이기만 했다.
 */

export function RoomShell({
  palette,
  doorReady,
  doorOpen,
  outsideDecay,
}: {
  palette: RoomPalette;
  doorReady: boolean;
  /** 배트를 쥐었는가 — 문이 열린다. */
  doorOpen: boolean;
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

      {/* 네 면의 굽도리 — 늘 남는다 */}
      {BASE_WALLS.map((part) => (
        <ShellBox key={part.position.join(":")} {...part} color={palette.slate} receiveShadow />
      ))}

      <CulledWall side="back">
        {BACK_WALL_SEGMENTS.map((part) => (
          <ShellBox key={part.position.join(":")} {...part} color={palette.slate} receiveShadow />
        ))}
        {/* 창밖 풍경도 뒷벽에 속한다 — 벽이 스러졌는데 풍경만 남으면 허공에 뜬 판이 된다 */}
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
      </CulledWall>

      <CulledWall side="left">
        <ShellBox {...LEFT_WALL_UPPER} color={palette.slate} receiveShadow />
        {/* 벽에 붙은 물건이라 벽과 함께 스러져야 한다 — 밖에 두면 허공에 뜬다 */}
        <LightSwitch palette={palette} />
      </CulledWall>
      <CulledWall side="front">
        <ShellBox {...FRONT_WALL_UPPER} color={palette.slate} receiveShadow />
      </CulledWall>
      <CulledWall side="right">
        <ShellBox {...RIGHT_WALL_UPPER} color={palette.slate} receiveShadow />
      </CulledWall>

      <group position={ROOM_DOOR_POSITION} rotation={ROOM_DOOR_ROTATION}>
        {/* 문짝만 경첩(왼쪽 문틀)을 축으로 열린다. 문틀·손잡이는 제자리에 남는다. */}
        <group position={[-DOOR_HINGE_X, 0, 0]} rotation={[0, doorOpen ? -1.15 : 0, 0]}>
          <group position={[DOOR_HINGE_X, 0, 0]}>
            <ShellBox
              size={[1.45, 3.4, 0.12]}
              position={[0, 0, 0]}
              color={doorReady ? palette.memory : palette.navy}
              castShadow
              emissive={palette.memory}
              emissiveIntensity={doorReady ? 0.65 : 0}
            />
            <ShellBox size={[0.11, 0.11, 0.1]} position={[0.48, 0, 0.1]} color={palette.ember} />
          </group>
        </group>
        {DOOR_FRAME.map((part) => (
          <ShellBox key={part.position.join(":")} {...part} color={palette.ink} castShadow />
        ))}
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
    </group>
  );
}
