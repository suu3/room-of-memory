import { useGLTF } from "@react-three/drei";
import type {} from "@react-three/fiber";
import { useFrame } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type Group, MathUtils, Plane, Vector3 } from "three";
import { ASSETS } from "@/lib/assets";
import { playSound } from "@/lib/audio";
import {
  CURTAIN_TAP_SLOP,
  CURTAIN_X,
  type CurtainPull,
  type CurtainSide,
  curtainX,
  pullProgress,
} from "./curtain-motion";
import { FurnitureModel } from "./FurnitureModel";
import {
  CABINET_BODY,
  CABINET_TOP_PROPS,
  CABINET_TOP_Y,
  CHAIR_POSITION,
  CHAIR_PULL,
  CHAIR_ROTATION,
  DESK_POSITION,
  DESK_ROTATION,
  DRAWER_TRAVEL,
} from "./layout";
import { MemoryGlowSelection } from "./MemoryOutlineGlow";
import type { RoomPalette } from "./palette";
import type { Vec3Tuple } from "./types";
import { useGlowHover } from "./use-glow-hover";
import { useNearPlayer } from "./use-near-player";

// 컴퓨터(모니터·키보드·마우스)는 이제 가구가 아니라 기억 오브젝트다 —
// MemoryObjects가 그리고 프리로드한다. 여기 다시 넣으면 두 개로 보인다.
const ROOM_PROP_PATHS = [
  ASSETS.models.deskLamp,
  ASSETS.models.books,
  ASSETS.models.rug,
  ASSETS.models.pottedPlant,
] as const;

for (const path of ROOM_PROP_PATHS) useGLTF.preload(path, true, true);

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

/*
 * z-fighting 방지 원칙: 맞닿는 두 박스의 면이 같은 좌표에 놓이면 깊이값이 같아져
 * 프레임마다 어느 쪽이 앞인지 뒤집히며 깜빡인다. 겹치는 부품은 항상
 * (1) 상대 안으로 파고들게 하거나 (2) 눈에 안 띄는 간격을 두어 면을 어긋나게 한다.
 */

// 상판 윗면 y=1.11. 다리는 상판 안으로 0.06 파고든다.
const DESK_PARTS = [
  { size: [4.1, 0.2, 1.6], position: [0, 1.01, 0], color: "dusk" },
  { size: [0.22, 0.98, 0.22], position: [-1.87, 0.49, -0.6], color: "ink" },
  { size: [0.22, 0.98, 0.22], position: [1.87, 0.49, -0.6], color: "ink" },
  { size: [0.22, 0.98, 0.22], position: [-1.87, 0.49, 0.6], color: "ink" },
  { size: [0.22, 0.98, 0.22], position: [1.87, 0.49, 0.6], color: "ink" },
  { size: [1.3, 0.46, 1.4], position: [-1.05, 0.7, 0], color: "slate" },
] as const satisfies readonly BoxPart[];

// 다리는 좌석 안으로, 등받이는 좌석 안으로 각각 파고든다.
const CHAIR_PARTS = [
  { size: [1.05, 0.16, 1.05], position: [0, 0.67, 0], color: "ink" },
  { size: [0.14, 0.64, 0.14], position: [-0.41, 0.32, -0.41], color: "slate" },
  { size: [0.14, 0.64, 0.14], position: [0.41, 0.32, -0.41], color: "slate" },
  { size: [0.14, 0.64, 0.14], position: [-0.41, 0.32, 0.41], color: "slate" },
  { size: [0.14, 0.64, 0.14], position: [0.41, 0.32, 0.41], color: "slate" },
  { size: [1.05, 0.79, 0.16], position: [0, 1.06, 0.445], color: "dusk" },
] as const satisfies readonly BoxPart[];

// 몸통 앞면 z=-2.53. 서랍판은 그 면을 물고, 손잡이는 서랍판 앞에 0.015 띄운다.
// 몸통은 layout의 CABINET_BODY를 그대로 쓴다 — 상판 위 기억 오브젝트와 같은 수치를 봐야 한다.
const CABINET_BODY_PARTS = [
  { ...CABINET_BODY, color: "dusk" },
] as const satisfies readonly BoxPart[];

/*
 * 서랍 한 칸은 서랍판 + 손잡이 한 쌍이다. 좌표는 닫혀 있을 때 그대로 두고 그룹째
 * +z로 밀어낸다 — 파트마다 위치를 다시 계산하면 손잡이가 판에서 떨어져 나간다.
 * 손잡이 둘이 안쪽(x=2.14, 2.56)에 몰려 있는 건 여닫이처럼 가운데서 잡는 모양이라서다.
 */
const CABINET_DRAWERS = [
  [
    { size: [2.08, 0.92, 0.06], position: [1.23, 0.58, -2.53], color: "slate" },
    { size: [0.12, 0.12, 0.05], position: [2.14, 0.58, -2.46], color: "bone" },
  ],
  [
    { size: [2.08, 0.92, 0.06], position: [3.47, 0.58, -2.53], color: "slate" },
    { size: [0.12, 0.12, 0.05], position: [2.56, 0.58, -2.46], color: "bone" },
  ],
] as const satisfies readonly (readonly BoxPart[])[];

// 몸통 앞면 z=1.16. 캐비닛과 같은 규칙.
const NIGHTSTAND_BODY_PARTS = [
  { size: [0.9, 0.95, 0.82], position: [6.8, 0.48, 0.75], color: "dusk" },
] as const satisfies readonly BoxPart[];

const NIGHTSTAND_DRAWER = [
  { size: [0.72, 0.28, 0.06], position: [6.8, 0.72, 1.16], color: "slate" },
  { size: [0.16, 0.08, 0.05], position: [6.8, 0.72, 1.225], color: "bone" },
] as const satisfies readonly BoxPart[];

const SHELF_PARTS = [
  { size: [0.5, 0.12, 2.1], position: [-5.65, 2.95, -1.4], color: "dusk" },
  { size: [2.1, 0.12, 0.5], position: [4.35, 2.8, -3.65], color: "dusk" },
] as const satisfies readonly BoxPart[];

/**
 * 커튼이 걸린 평면. 드래그 기준점을 커튼 메쉬에서 뽑으면 안 된다 — 커튼이 손을 따라
 * 밀리는 순간 교차점도 같이 밀려서 이동량이 0으로 무너진다. 움직이지 않는 이 평면에
 * 광선을 쏴서 손이 실제로 간 거리를 잰다.
 */
const CURTAIN_Z = -3.72;
const CURTAIN_PLANE = new Plane(new Vector3(0, 0, 1), -CURTAIN_Z);
const curtainHit = new Vector3();

/** 포인터 광선이 커튼 평면과 만나는 x. 평행이면 null. */
function curtainPlaneX(ray: { intersectPlane: (plane: Plane, target: Vector3) => Vector3 | null }) {
  return ray.intersectPlane(CURTAIN_PLANE, curtainHit)?.x ?? null;
}

/**
 * 커튼이 켜지기 시작하는 거리.
 *
 * 커튼은 뒷벽에 붙어 있어(z=-3.72) 플레이어가 아무리 다가가도 z로 0.8쯤은 떨어져
 * 선다. 창문 기억의 반경(1.6)보다 넉넉히 잡아야 "창가에 왔다" 싶은 자리에서
 * 양쪽 커튼이 함께 켜진다 — 한 쪽만 켜지면 나머지 한 쪽이 있는 줄 모른다.
 */
const CURTAIN_NEAR_RADIUS = 2.1;

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

/**
 * 곁가지 인터랙션이 공통으로 쓰는 값들.
 *
 * 커튼과 달리 이쪽은 끌지 않고 한 번 눌러 여닫는다 — 커튼을 젖히는 건 밖을 보는
 * 이야기의 한 순간이라 손으로 하는 몸짓이 값을 하지만, 서랍과 의자는 방을 만지는
 * 감각이라 몸짓까지 요구하면 품이 이야기보다 커진다.
 */
const FURNITURE_NEAR_RADIUS = 2.1;
/** 손을 떠난 뒤 목표에 붙는 속도. 의자는 무거우니 서랍보다 느리게 민다. */
const DRAWER_LAMBDA = 6;
const CHAIR_LAMBDA = 4.5;
/** 모션을 끈 사람에게는 미끄러짐 없이 곧바로 옮겨 놓는다. */
const REDUCED_LAMBDA = 18;

function usePrefersReducedMotion(): boolean {
  return useMemo(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);
}

/**
 * 눌러서 여닫는 서랍. 캐비닛 두 칸과 협탁 한 칸이 같은 부품을 쓴다.
 *
 * 열림 여부는 이 컴포넌트가 들고 있다 — 이야기에 아무것도 남기지 않는 순수한 겉모습이라
 * 스토어에 올릴 이유가 없다 (플래그도, 세이브도 걸리지 않는다).
 */
function Drawer({
  palette,
  name,
  parts,
  travel,
  near,
}: FurnitureProps & {
  name: string;
  parts: readonly BoxPart[];
  /** 다 열렸을 때 +z로 나와 있는 거리. */
  travel: number;
  /** 다가왔는지 재는 기준점 (월드 x·z). */
  near: readonly [number, number];
}) {
  const [open, setOpen] = useState(false);
  const groupRef = useRef<Group>(null);
  const { hovered, handlers } = useGlowHover(true);
  const nearPlayer = useNearPlayer(near[0], near[1], FURNITURE_NEAR_RADIUS);
  const reducedMotion = usePrefersReducedMotion();

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;
    const goal = open ? travel : 0;
    group.position.z = MathUtils.damp(
      group.position.z,
      goal,
      reducedMotion ? REDUCED_LAMBDA : DRAWER_LAMBDA,
      delta,
    );
  });

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: R3F group은 DOM이 아니라 Canvas 안의 포인터 대상이다.
    <group
      ref={groupRef}
      name={name}
      {...handlers}
      onClick={(event) => {
        // 서랍 뒤에 있는 몸통·벽까지 같이 눌리면 안 된다.
        event.stopPropagation();
        playSound("drawer");
        setOpen((current) => !current);
      }}
    >
      <MemoryGlowSelection selectionKey={name} tier="prop" enabled={hovered || nearPlayer}>
        <BoxParts parts={parts} palette={palette} />
      </MemoryGlowSelection>
    </group>
  );
}

/** 책상 앞으로 붙어 있는 의자. 누르면 뒤로 물러나며 살짝 틀어진다. */
function Chair({ palette }: FurnitureProps) {
  const [pulled, setPulled] = useState(false);
  const groupRef = useRef<Group>(null);
  const { hovered, handlers } = useGlowHover(true);
  const near = useNearPlayer(CHAIR_POSITION[0], CHAIR_POSITION[2], FURNITURE_NEAR_RADIUS);
  const reducedMotion = usePrefersReducedMotion();

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;
    const lambda = reducedMotion ? REDUCED_LAMBDA : CHAIR_LAMBDA;
    // 책상은 의자의 -x 쪽에 있다 — 물러나는 건 +x.
    group.position.x = MathUtils.damp(
      group.position.x,
      CHAIR_POSITION[0] + (pulled ? CHAIR_PULL.distance : 0),
      lambda,
      delta,
    );
    // 밀려나기만 하면 미끄러진 것처럼 보인다. 조금 틀어져야 누가 일어난 자리가 된다.
    group.rotation.y = MathUtils.damp(
      group.rotation.y,
      CHAIR_ROTATION[1] + (pulled ? CHAIR_PULL.turn : 0),
      lambda,
      delta,
    );
  });

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: R3F group은 DOM이 아니라 Canvas 안의 포인터 대상이다.
    <group
      ref={groupRef}
      name="chair"
      position={CHAIR_POSITION}
      rotation={CHAIR_ROTATION}
      {...handlers}
      onClick={(event) => {
        event.stopPropagation();
        playSound("chairDrag");
        setPulled((current) => !current);
      }}
    >
      <MemoryGlowSelection selectionKey="chair" tier="prop" enabled={hovered || near}>
        <BoxParts parts={CHAIR_PARTS} palette={palette} />
      </MemoryGlowSelection>
    </group>
  );
}

function Cabinet({ palette }: FurnitureProps) {
  return (
    <group name="cabinet">
      <BoxParts parts={CABINET_BODY_PARTS} palette={palette} />
      {CABINET_DRAWERS.map((parts, index) => (
        <Drawer
          key={parts[0].position.join(":")}
          name={`cabinet-drawer-${index}`}
          parts={parts}
          travel={DRAWER_TRAVEL.cabinet}
          near={[parts[0].position[0], parts[0].position[2]]}
          palette={palette}
        />
      ))}
    </group>
  );
}

function Nightstand({ palette }: FurnitureProps) {
  return (
    <group name="nightstand">
      <BoxParts parts={NIGHTSTAND_BODY_PARTS} palette={palette} />
      <Drawer
        name="nightstand-drawer"
        parts={NIGHTSTAND_DRAWER}
        travel={DRAWER_TRAVEL.nightstand}
        near={[NIGHTSTAND_DRAWER[0].position[0], NIGHTSTAND_DRAWER[0].position[2]]}
        palette={palette}
      />
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

/*
 * 책상 위 소품은 가구킷 glb로 바꿨다. 전부 같은 배율(DESK_PROP_SCALE)을 쓰는데,
 * 모델마다 배율이 다르면 한 책상 위에서 물건 크기가 서로 안 맞아 보인다.
 * 배율은 모니터 높이(0.29)를 예전 프리미티브 높이(0.9)에 맞춰 잡았다.
 *
 * 좌표는 책상 로컬 프레임이다 — 책상은 Y 90° 돌아 있어서 로컬 +x가 책상 길이,
 * 로컬 +z가 의자(앉는 쪽)를 향한다. 상판 윗면은 y=1.11.
 */
const DESK_PROP_SCALE = 3.1;
const DESK_TOP_Y = 1.11;

function DeskAccessories(_: FurnitureProps) {
  // 컴퓨터 세트(모니터·키보드·마우스)는 기억 오브젝트로 승격됐다 —
  // MemoryObjects의 ComputerMemory가 같은 자리(월드 좌표)에 그린다.
  return (
    <group name="desk-accessories">
      <FurnitureModel
        path={ASSETS.models.deskLamp}
        position={[1.42, DESK_TOP_Y, -0.3]}
        scale={DESK_PROP_SCALE}
      />
      <FurnitureModel
        path={ASSETS.models.books}
        position={[1.05, DESK_TOP_Y, 0.34]}
        rotation={[0, -0.5, 0]}
        scale={DESK_PROP_SCALE}
      />
    </group>
  );
}

// 상판 소품의 x는 layout의 CABINET_TOP_PROPS에서 가져온다 — 기억 오브젝트가 피해야 할
// 구간이라 한곳에서 관리한다. 도형 크기를 바꾸면 거기 halfWidth도 같이 고칠 것.
const { plant, storageBox, clock } = CABINET_TOP_PROPS;

/**
 * 캐비닛 위 탁상시계.
 *
 * 원통 하나에 종이색 원판을 덧댄 게 전부였는데, 그 원판이 원통과 같은 rotation을
 * 받는 바람에 바닥을 보고 서 있었다 — 방에서 보이는 건 아무것도 안 적힌 민짜
 * 원반뿐이라 정체를 알 수 없는 물건이 됐다. 문자판을 방 쪽으로 돌리고 바늘을 단다.
 *
 * 원통 몸통 두께가 0.1이므로 앞면은 중심에서 0.05 앞이다. 문자판·바늘·축은 그 앞으로
 * 조금씩 띄워 쌓는다 — 같은 z에 놓으면 면이 겹쳐 깜빡인다.
 */
/*
 * z를 -2.48에서 -2.82로 물렸다. 예전 자리에서는 원통 뒷면(z=-2.53)이 캐비닛
 * 앞면과 정확히 같은 평면에 놓여 깊이값이 같아졌고, 프레임마다 앞뒤가 뒤집히며
 * 깜빡였다. 상판 위가 아니라 캐비닛 앞에 떠 있는 것처럼도 보였다.
 * 상판 안쪽으로 들이면 문자판은 여전히 방을 보고, 겹치는 면은 사라진다.
 */
const CLOCK_CENTER: Vec3Tuple = [clock.x, 1.43, -2.82];
const CLOCK_FACE_Z = 0.055;
/** 멈춰 선 시각. 폰 잠금화면과 같은 20:47이다 — 방 안의 두 시계가 어긋나면 안 된다. */
const CLOCK_HOUR = 20;
const CLOCK_MINUTE = 47;
/** 12시 방향에서 시계방향으로 도는 각. three의 +Z 회전은 반시계라 부호가 뒤집힌다. */
const MINUTE_ANGLE = -(CLOCK_MINUTE / 60) * Math.PI * 2;
const HOUR_ANGLE = -(((CLOCK_HOUR % 12) + CLOCK_MINUTE / 60) / 12) * Math.PI * 2;

function ClockHand({
  angle,
  length,
  width,
  z,
  color,
}: {
  angle: number;
  length: number;
  width: number;
  z: number;
  color: string;
}) {
  return (
    // 바늘은 축을 중심으로 돈다 — 회전은 그룹이 맡고 막대는 그 안에서 길이의 절반만큼 올라간다
    <group position={[0, 0, z]} rotation={[0, 0, angle]}>
      <mesh position={[0, length / 2, 0]}>
        <boxGeometry args={[width, length, 0.012]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
    </group>
  );
}

function DeskClock({ palette }: FurnitureProps) {
  return (
    <group name="desk-clock" position={CLOCK_CENTER}>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.28, 0.28, 0.1, 24]} />
        <meshStandardMaterial color={palette.bone} roughness={0.72} />
      </mesh>
      <mesh position={[0, 0, CLOCK_FACE_Z]}>
        <circleGeometry args={[0.2, 24]} />
        <meshStandardMaterial color={palette.paper} roughness={0.8} />
      </mesh>
      <ClockHand
        angle={HOUR_ANGLE}
        length={0.11}
        width={0.022}
        z={CLOCK_FACE_Z + 0.008}
        color={palette.ink}
      />
      <ClockHand
        angle={MINUTE_ANGLE}
        length={0.16}
        width={0.016}
        z={CLOCK_FACE_Z + 0.014}
        color={palette.ink}
      />
      {/* 바늘이 만나는 축 — 두 바늘이 그냥 겹쳐 있으면 십자 무늬로 보인다 */}
      <mesh position={[0, 0, CLOCK_FACE_Z + 0.022]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.018, 0.018, 0.01, 10]} />
        <meshStandardMaterial color={palette.ember} roughness={0.6} />
      </mesh>
    </group>
  );
}

function CabinetAccessories({ palette }: FurnitureProps) {
  return (
    <group name="cabinet-accessories">
      <FurnitureModel
        path={ASSETS.models.pottedPlant}
        position={[plant.x, CABINET_TOP_Y, -2.86]}
        scale={1.08}
      />
      <FurnitureBox
        part={{ size: [0.72, 0.34, 0.45], position: [storageBox.x, 1.32, -2.82], color: "navy" }}
        palette={palette}
      />
      <FurnitureBox
        part={{ size: [0.22, 0.22, 0.04], position: [storageBox.x, 1.56, -2.79], color: "paper" }}
        palette={palette}
      />
      <DeskClock palette={palette} />
    </group>
  );
}

function FloorAccessories({ palette }: FurnitureProps) {
  return (
    <group name="floor-accessories">
      {/* 러그는 두께가 0.01뿐이라 바닥과 겹치지 않게 살짝 띄운다 */}
      <FurnitureModel path={ASSETS.models.rug} position={[0.2, 0.012, 3.65]} scale={2.1} />
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

/**
 * 커튼 한 쪽. 잡아당겨 젖히고, 한 번 눌러도 여닫힌다.
 *
 * 포인터를 누른 채 좌우로 끌면 그만큼 젖혀지고, 놓으면 충분히 당겼는지에 따라
 * 끝까지 열리거나 도로 닫힌다. 양쪽을 다 젖혀야 밖이 보인다 — 창을 여는 건
 * 이 게임에서 "진실을 마주하는" 동작이라 손으로 하게 두는 편이 맞는다.
 *
 * 다 젖힌 뒤에도 계속 만질 수 있다. 커튼은 수집 대상이 아니라 전등 스위치와 같은
 * 방의 곁가지 인터랙션이라, 창밖을 한 번 봤다고 굳어 버리면 안 된다 — 도로 닫고
 * 다시 젖히는 것까지가 이 물건의 전부다 (창문 기억 자체는 스토어가 따로 잠근다).
 *
 * 키보드 사용자를 위해 Enter/Space는 그 쪽을 한 번에 젖힌다 (RoomInteractionPrompt의
 * 창문 버튼도 같은 경로로 들어온다).
 */
function Curtain({
  side,
  progress,
  onPull,
  onRelease,
  palette,
}: FurnitureProps & {
  side: CurtainSide;
  progress: number;
  /** 이번 프레임까지 끌어온 진행도(0~1). */
  onPull: (side: CurtainSide, progress: number) => void;
  /** `tapped`면 끌지 않고 누르기만 한 것 — 진행도를 그대로 뒤집는다. */
  onRelease: (side: CurtainSide, tapped: boolean) => void;
}) {
  const groupRef = useRef<Group>(null);
  const { hovered, handlers } = useGlowHover(true);
  /*
   * 다가가면 빛난다.
   *
   * 기준점은 커튼이 지금 있는 자리가 아니라 닫혀 있을 때의 자리다. 젖히는 도중에
   * 판정 원이 손을 따라 미끄러지면, 당기다 말고 반경 밖으로 나가 빛이 꺼진다.
   */
  const near = useNearPlayer(CURTAIN_X[side].closed, CURTAIN_Z, CURTAIN_NEAR_RADIUS);
  const reducedMotion = useMemo(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );
  /** 드래그를 시작한 지점과 그때의 진행도. `moved`는 탭과 드래그를 가른다. */
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    from: number;
    moved: boolean;
  } | null>(null);
  const releaseRef = useRef(onRelease);
  releaseRef.current = onRelease;

  const endDrag = useCallback(() => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    releaseRef.current(side, !drag.moved);
  }, [side]);

  // 캔버스 밖에서 손을 떼도 커튼이 끌린 채로 굳지 않게 하는 안전망.
  useEffect(() => {
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    return () => {
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
    };
  }, [endDrag]);

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;
    // 끌고 있는 동안에는 손을 그대로 따라가고, 놓은 뒤에만 부드럽게 붙는다.
    const goal = curtainX(side, progress);
    group.position.x = dragRef.current
      ? goal
      : MathUtils.damp(group.position.x, goal, reducedMotion ? 18 : 5.5, delta);
  });

  return (
    <group
      ref={groupRef}
      position={[curtainX(side, progress), 2.5, CURTAIN_Z]}
      name={`curtain-${side}`}
      {...handlers}
      onPointerDown={(event) => {
        event.stopPropagation();
        // 포인터를 잡아둬야 커튼 밖으로 손이 나가도 드래그가 이어진다.
        (event.target as Element | null)?.setPointerCapture?.(event.pointerId);
        const startX = curtainPlaneX(event.ray);
        if (startX === null) return;
        dragRef.current = { pointerId: event.pointerId, startX, from: progress, moved: false };
      }}
      onPointerMove={(event) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        event.stopPropagation();
        const x = curtainPlaneX(event.ray);
        if (x === null) return;
        // 손이 이 폭을 넘긴 적이 있으면 그 뒤로는 계속 드래그다 — 되돌아왔다고 탭이 되면
        // 끌다 만 커튼이 엉뚱하게 뒤집힌다.
        if (Math.abs(x - drag.startX) >= CURTAIN_TAP_SLOP) drag.moved = true;
        onPull(side, pullProgress(side, x - drag.startX, drag.from));
      }}
      onPointerUp={(event) => {
        if (!dragRef.current) return;
        event.stopPropagation();
        (event.target as Element | null)?.releasePointerCapture?.(event.pointerId);
        endDrag();
      }}
      // onPointerLeave는 쓰지 않는다 — 커튼을 젖히는 순간 포인터가 메쉬 밖으로 나가면서
      // 곧바로 드래그가 취소돼 한 칸도 못 움직였다. 포인터 캡처가 잡혀 있으므로
      // 밖으로 나가도 move/up은 계속 들어온다.
    >
      <MemoryGlowSelection selectionKey={`curtain-${side}`} tier="prop" enabled={hovered || near}>
        <BoxParts parts={CURTAIN_FOLD_PARTS} palette={palette} />
      </MemoryGlowSelection>
    </group>
  );
}

export function RoomFurniture({
  palette,
  curtainPull,
  onCurtainPull,
  onCurtainRelease,
}: FurnitureProps & {
  curtainPull: CurtainPull;
  onCurtainPull: (side: CurtainSide, progress: number) => void;
  onCurtainRelease: (side: CurtainSide, tapped: boolean) => void;
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
      <Curtain
        side="left"
        progress={curtainPull.left}
        palette={palette}
        onPull={onCurtainPull}
        onRelease={onCurtainRelease}
      />
      <Curtain
        side="right"
        progress={curtainPull.right}
        palette={palette}
        onPull={onCurtainPull}
        onRelease={onCurtainRelease}
      />
    </group>
  );
}
