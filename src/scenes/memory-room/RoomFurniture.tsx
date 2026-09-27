import { useGLTF } from "@react-three/drei";
import type {} from "@react-three/fiber";
import { useFrame } from "@react-three/fiber";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type Group,
  MathUtils,
  type Mesh,
  type MeshStandardMaterial,
  Plane,
  type PointLight,
  Vector3,
} from "three";
import { ASSETS } from "@/lib/assets";
import { playSound } from "@/lib/audio";
import { useEffectEnabled } from "@/lib/effects/effect-budget";
import { isAtCurtain, selectAct, useMemoryRoomStore } from "@/store/memory-room";
import { BedModel } from "./BedModel";
import { CurtainCloth, CurtainRod } from "./CurtainCloth";
import { CURTAIN_MODEL_POSITION, CURTAIN_OPEN_KEY, CURTAIN_Z } from "./curtain-model";
import {
  CURTAIN_NEAR_RADIUS,
  CURTAIN_TAP_SLOP,
  CURTAIN_X,
  type CurtainPull,
  type CurtainSide,
  curtainX,
  pullProgress,
  pullVelocity,
} from "./curtain-motion";
import { FurnitureModel } from "./FurnitureModel";
import {
  CABINET_BODY,
  CABINET_TOP_PROPS,
  CABINET_TOP_Y,
  CHAIR_POSITION,
  CHAIR_ROTATION,
  CHAIR_SEAT,
  CLUE_PROPS,
  DESK_POSITION,
  DESK_ROTATION,
  DRAWER_TRAVEL,
} from "./layout";
import { MemoryGlowSelection } from "./MemoryOutlineGlow";
import type { RoomPalette } from "./palette";
import { DrawerNoteClue, TouchProp } from "./RoomClues";
import { SpaceLight } from "./SpaceLight";
import { StudentDeskProps, StudentRoomProps } from "./StudentProps";
import { useSideCue } from "./side-cue";
import type { Vec3Tuple } from "./types";
import { useGlowHover } from "./use-glow-hover";
import { useNearPlayer } from "./use-near-player";
import { usePrefersReducedMotion, useSeat, useSeatPull } from "./use-seat";

// 컴퓨터(모니터·키보드·마우스)는 이제 가구가 아니라 기억 오브젝트다.
// MemoryObjects가 그리고 프리로드한다. 여기 다시 넣으면 두 개로 보인다.
// 침대(프레임·베개·이불 한 모델)는 BedModel이 그리고 프리로드한다.
const ROOM_PROP_PATHS = [
  ASSETS.models.tissueBox,
  ASSETS.models.ceilingAc,
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
  /** 볕을 가리지 않는 얇은 천(커튼). 기본은 그림자를 드리운다. */
  castShadow?: boolean;
}

interface FurnitureProps {
  palette: RoomPalette;
}

function FurnitureBox({ part, palette }: { part: BoxPart; palette: RoomPalette }) {
  return (
    <mesh position={part.position} castShadow={part.castShadow ?? true} receiveShadow>
      <boxGeometry args={part.size} />
      <meshStandardMaterial color={palette[part.color]} roughness={0.78} />
    </mesh>
  );
}

/*
 * z-fighting 방지 원칙: 맞닿는 두 박스의 면이 같은 좌표에 놓이면 깊이값이 같아져
 * 프레임마다 어느 쪽이 앞인지 뒤집히며 깜빡인다. 겹치는 부품은 항상
 * (1) 상대 안으로 파고들게 하거나 (2) 눈에 안 띄는 간격을 두어 면을 어긋나게 한다.
 */

// 상판 윗면 y=1.11. 다리는 상판 안으로 0.06 파고든다.
const DESK_PARTS = [
  { size: [4.1, 0.2, 1.6], position: [0, 1.01, 0], color: "wood" },
  { size: [0.22, 0.98, 0.22], position: [-1.87, 0.49, -0.6], color: "frame" },
  { size: [0.22, 0.98, 0.22], position: [1.87, 0.49, -0.6], color: "frame" },
  { size: [0.22, 0.98, 0.22], position: [-1.87, 0.49, 0.6], color: "frame" },
  { size: [0.22, 0.98, 0.22], position: [1.87, 0.49, 0.6], color: "frame" },
  { size: [1.3, 0.46, 1.4], position: [-1.05, 0.7, 0], color: "wood" },
] as const satisfies readonly BoxPart[];

// 다리는 좌석 안으로, 등받이는 좌석 안으로 각각 파고든다. 좌면 치수는 layout의
// CHAIR_SEAT: 앉는 자리(seats)와 발자국이 같은 수를 봐야 한다.
const CHAIR_WIDTH = CHAIR_SEAT.half * 2;
const CHAIR_SEAT_Y = CHAIR_SEAT.topY - CHAIR_SEAT.thickness / 2;
const CHAIR_LEG_INSET = CHAIR_SEAT.half - 0.1;
const CHAIR_PARTS = [
  {
    size: [CHAIR_WIDTH, CHAIR_SEAT.thickness, CHAIR_WIDTH],
    position: [0, CHAIR_SEAT_Y, 0],
    color: "wood",
  },
  {
    size: [0.12, 0.58, 0.12],
    position: [-CHAIR_LEG_INSET, 0.29, -CHAIR_LEG_INSET],
    color: "frame",
  },
  { size: [0.12, 0.58, 0.12], position: [CHAIR_LEG_INSET, 0.29, -CHAIR_LEG_INSET], color: "frame" },
  { size: [0.12, 0.58, 0.12], position: [-CHAIR_LEG_INSET, 0.29, CHAIR_LEG_INSET], color: "frame" },
  { size: [0.12, 0.58, 0.12], position: [CHAIR_LEG_INSET, 0.29, CHAIR_LEG_INSET], color: "frame" },
  // 등받이 뒷면(0.45)을 좌석 모서리(0.43) 뒤로 뺀다. 두 면이 같은 평면에
  // 놓이면 z-fighting으로 깜빡인다 (위 겹침 원칙)
  { size: [CHAIR_WIDTH, 0.68, 0.14], position: [0, 0.96, 0.38], color: "wood" },
] as const satisfies readonly BoxPart[];

// 몸통 앞면 z=-2.53. 서랍판은 그 면을 물고, 손잡이는 서랍판 앞에 0.015 띄운다.
// 몸통은 layout의 CABINET_BODY를 그대로 쓴다. 상판 위 기억 오브젝트와 같은 수치를 봐야 한다.
const CABINET_BODY_PARTS = [
  { ...CABINET_BODY, color: "wood" },
] as const satisfies readonly BoxPart[];

/*
 * 서랍 한 칸은 서랍판 + 손잡이 한 쌍이다. 좌표는 닫혀 있을 때 그대로 두고 그룹째
 * +z로 밀어낸다. 파트마다 위치를 다시 계산하면 손잡이가 판에서 떨어져 나간다.
 * 손잡이 둘이 안쪽(x=2.14, 2.56)에 몰려 있는 건 여닫이처럼 가운데서 잡는 모양이라서다.
 */
const CABINET_DRAWERS = [
  [
    { size: [2.08, 0.92, 0.06], position: [1.23, 0.58, -2.53], color: "wood" },
    { size: [0.12, 0.12, 0.05], position: [2.14, 0.58, -2.46], color: "trim" },
  ],
  [
    { size: [2.08, 0.92, 0.06], position: [3.47, 0.58, -2.53], color: "wood" },
    { size: [0.12, 0.12, 0.05], position: [2.56, 0.58, -2.46], color: "trim" },
  ],
] as const satisfies readonly (readonly BoxPart[])[];

// 몸통 앞면 z=1.16. 캐비닛과 같은 규칙.
const NIGHTSTAND_BODY_PARTS = [
  { size: [0.9, 0.95, 0.82], position: [6.8, 0.48, 0.75], color: "wood" },
] as const satisfies readonly BoxPart[];

const NIGHTSTAND_DRAWER = [
  { size: [0.72, 0.28, 0.06], position: [6.8, 0.72, 1.16], color: "wood" },
  { size: [0.16, 0.08, 0.05], position: [6.8, 0.72, 1.225], color: "trim" },
] as const satisfies readonly BoxPart[];

const SHELF_PARTS = [
  { size: [0.5, 0.12, 2.1], position: [-5.65, 2.95, -1.4], color: "wood" },
  { size: [2.1, 0.12, 0.5], position: [4.35, 2.8, -3.65], color: "wood" },
] as const satisfies readonly BoxPart[];

/**
 * 커튼이 걸린 평면. 드래그 기준점을 커튼 메쉬에서 뽑으면 안 된다. 커튼이 손을 따라
 * 젖혀지는 순간 교차점도 같이 밀려서 이동량이 0으로 무너진다. 움직이지 않는 이 평면에
 * 광선을 쏴서 손이 실제로 간 거리를 잰다.
 */
const CURTAIN_PLANE = new Plane(new Vector3(0, 0, 1), -CURTAIN_Z);
const curtainHit = new Vector3();

/** 포인터 광선이 커튼 평면과 만나는 x. 평행이면 null. */
function curtainPlaneX(ray: { intersectPlane: (plane: Plane, target: Vector3) => Vector3 | null }) {
  return ray.intersectPlane(CURTAIN_PLANE, curtainHit)?.x ?? null;
}

function BoxParts({ parts, palette }: { parts: readonly BoxPart[]; palette: RoomPalette }) {
  return parts.map((part) => (
    <FurnitureBox key={part.position.join(":")} part={part} palette={palette} />
  ));
}

/**
 * 침대. 누르면 옆으로 걸어가 올라가서 눕는다 (seats.ts의 bed): 의자와 같은 훅이라
 * 다가가야 하고, 누워 있을 때 다시 누르면 일어난다. 모양과 이불 접힘은 BedModel.
 */
function Bed({ palette }: FurnitureProps) {
  const { glowing, handlers } = useSeat("bed");
  // 모델이 글로우가 켜진 뒤에 붙으면 선택이 비어 있다. 붙을 때마다 다시 훑게 한다.
  const [modelVersion, setModelVersion] = useState(0);
  const handleModelReady = useCallback(() => setModelVersion((version) => version + 1), []);
  return (
    <group name="bed" {...handlers}>
      <MemoryGlowSelection
        selectionKey="bed"
        tier="prop"
        enabled={glowing}
        selectionVersion={modelVersion}
      >
        <BedModel palette={palette} onModelReady={handleModelReady} />
      </MemoryGlowSelection>
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
 * 커튼과 달리 이쪽은 끌지 않고 한 번 눌러 여닫는다. 커튼을 젖히는 건 밖을 보는
 * 이야기의 한 순간이라 손으로 하는 몸짓이 값을 하지만, 서랍은 방을 만지는
 * 감각이라 몸짓까지 요구하면 품이 이야기보다 커진다.
 */
const FURNITURE_NEAR_RADIUS = 2.1;
/** 손을 떠난 뒤 목표에 붙는 속도. */
const DRAWER_LAMBDA = 6;
/** 모션을 끈 사람에게는 미끄러짐 없이 곧바로 옮겨 놓는다. */
const REDUCED_LAMBDA = 18;

/**
 * 눌러서 여닫는 서랍. 캐비닛 두 칸과 협탁 한 칸이 같은 부품을 쓴다.
 *
 * 열림 여부는 이 컴포넌트가 들고 있다. 이야기에 아무것도 남기지 않는 순수한 겉모습이라
 * 스토어에 올릴 이유가 없다 (플래그도, 세이브도 걸리지 않는다).
 */
function Drawer({
  palette,
  name,
  parts,
  travel,
  near,
  children,
}: FurnitureProps & {
  name: string;
  parts: readonly BoxPart[];
  /** 다 열렸을 때 +z로 나와 있는 거리. */
  travel: number;
  /** 다가왔는지 재는 기준점 (월드 x·z). */
  near: readonly [number, number];
  /**
   * 서랍 안에 든 것. 서랍과 함께 밀려 나와야 하므로 같은 그룹에 들어간다.
   * 열림 여부를 알아야 만질 수 있는지 정할 수 있어 함수로 받는다.
   */
  children?: (open: boolean) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const groupRef = useRef<Group>(null);
  const { hovered, handlers } = useGlowHover(true);
  const nearPlayer = useNearPlayer(near[0], near[1], FURNITURE_NEAR_RADIUS);
  // 1페이즈에는 멀리서도 옅게 보인다: 서랍은 어디서 눌러도 열린다 (side-cue)
  const cue = useSideCue();
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
      <MemoryGlowSelection selectionKey={name} tier="prop" enabled={cue || hovered || nearPlayer}>
        <BoxParts parts={parts} palette={palette} />
      </MemoryGlowSelection>
      {children?.(open)}
    </group>
  );
}

/**
 * 책상 앞으로 붙어 있는 의자. 누르면 다가간 사람이 앉는다. 의자는 그 몫으로 먼저
 * 뒤로 물러나며 살짝 틀어진다 (CHAIR_PULL).
 *
 * 예전에는 누르면 의자만 빠졌다 들어왔다. 앉는 동작이 생기면서 그 움직임은 앉는
 * 몸짓의 일부가 됐다. 밀어 넣은 채로 앉으면 상판 밑에 몸이 낀다 (seats.ts).
 */
function Chair({ palette }: FurnitureProps) {
  const groupRef = useRef<Group>(null);
  const { glowing, handlers } = useSeat("desk-chair");
  useSeatPull(groupRef, "desk-chair", {
    x: CHAIR_POSITION[0],
    z: CHAIR_POSITION[2],
    rotationY: CHAIR_ROTATION[1],
  });

  return (
    <group
      ref={groupRef}
      name="chair"
      position={CHAIR_POSITION}
      rotation={CHAIR_ROTATION}
      {...handlers}
    >
      <MemoryGlowSelection selectionKey="chair" tier="prop" enabled={glowing}>
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
      >
        {/* 도해가 예전에 적어 둔 쪽지: 컴퓨터 비밀번호 단서의 절반이다 */}
        {(open) => <DrawerNoteClue palette={palette} open={open} />}
      </Drawer>
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
 * 책상 위 소품은 자체 제작 glb다. 전부 같은 배율(DESK_PROP_SCALE)을 쓰는데,
 * 모델마다 배율이 다르면 한 책상 위에서 물건 크기가 서로 안 맞아 보인다.
 * 배율은 모니터 높이(0.29)를 예전 프리미티브 높이(0.9)에 맞춰 잡았다.
 *
 * 좌표는 책상 로컬 프레임이다. 책상은 Y 90° 돌아 있어서 로컬 +x가 책상 길이,
 * 로컬 +z가 의자(앉는 쪽)를 향한다. 상판 윗면은 y=1.11.
 */
const DESK_PROP_SCALE = 3.1;
const DESK_TOP_Y = 1.11;

/** 스탠드가 책상 위에 서는 자리 (책상 로컬). glb 높이 0.29 × 배율 3.1 ≈ 0.9. */
const LAMP_LOCAL: Vec3Tuple = [1.42, DESK_TOP_Y, -0.3];
/** 갓 안의 전구 높이: 상판에서 이만큼 위. */
const LAMP_BULB_HEIGHT = 0.64;
/**
 * 스탠드의 월드 x·z. 책상은 Y 90° 돌아 있어 로컬 (x, z) → 월드 (z, -x)다. 다가감 판정은
 * 월드 좌표로 재므로 로컬 자리를 한 번 돌려 둔다.
 */
const LAMP_WORLD = [DESK_POSITION[0] + LAMP_LOCAL[2], DESK_POSITION[2] - LAMP_LOCAL[0]] as const;
/** 켰을 때의 세기. 천장 전등(최대 28, 거리 13)보다 훨씬 작고 가까운 빛이다. */
const LAMP_INTENSITY = 5;
const LAMP_REACH = 4.5;

/**
 * 책상 스탠드. 다가가서 누르면 켜지고 다시 누르면 꺼진다. 전등 스위치·서랍과 같은
 * 곁가지라 진행에도 저장에도 남지 않는다. 불은 갓 안의 전구(emissive)와 point light
 * 하나로, 값은 프레임마다 damp로 따라간다 (툭 켜지면 스위치가 아니라 버그로 읽힌다).
 */
function DeskLamp({ palette }: FurnitureProps) {
  const [on, setOn] = useState(false);
  const near = useNearPlayer(LAMP_WORLD[0], LAMP_WORLD[1], FURNITURE_NEAR_RADIUS);
  // 다가갔을 때만 호버·커서가 산다. 멀리서 누르면 거절하므로 멀리서 빛나면 안 된다
  const { handlers } = useGlowHover(near);
  const lightRef = useRef<PointLight>(null);
  const bulbRef = useRef<MeshStandardMaterial>(null);

  useFrame((_, delta) => {
    const light = lightRef.current;
    const bulb = bulbRef.current;
    if (!light || !bulb) return;
    light.intensity = MathUtils.damp(light.intensity, on ? LAMP_INTENSITY : 0, 6, delta);
    bulb.emissiveIntensity = MathUtils.damp(bulb.emissiveIntensity, on ? 1.4 : 0, 6, delta);
  });

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: R3F group은 DOM이 아니라 Canvas 안의 포인터 대상이다.
    <group
      name="desk-lamp"
      {...handlers}
      onClick={(event) => {
        event.stopPropagation();
        if (!near) {
          playSound("deny");
          return;
        }
        // 딸깍은 조작음이라 방 밝기와 무관하게 늘 같은 크기로 울린다 (LightSwitch와 같다)
        playSound("select");
        setOn((current) => !current);
      }}
    >
      <MemoryGlowSelection selectionKey="desk-lamp" tier="prop" enabled={near}>
        <FurnitureModel
          path={ASSETS.models.deskLamp}
          position={LAMP_LOCAL}
          scale={DESK_PROP_SCALE}
        />
      </MemoryGlowSelection>
      {/* 갓 안의 전구: 켜지면 갓이 안에서부터 데워진다 */}
      <mesh position={[LAMP_LOCAL[0], LAMP_LOCAL[1] + LAMP_BULB_HEIGHT, LAMP_LOCAL[2]]}>
        <sphereGeometry args={[0.055, 10, 8]} />
        <meshStandardMaterial
          ref={bulbRef}
          color={palette.linen}
          emissive={palette.sun}
          emissiveIntensity={0}
          roughness={0.6}
        />
      </mesh>
      <SpaceLight
        ref={lightRef}
        position={[LAMP_LOCAL[0], LAMP_LOCAL[1] + LAMP_BULB_HEIGHT, LAMP_LOCAL[2]]}
        color={palette.sun}
        intensity={0}
        distance={LAMP_REACH}
        decay={2}
      />
    </group>
  );
}

function DeskAccessories({ palette }: FurnitureProps) {
  // 컴퓨터 세트(모니터·키보드·마우스)는 기억 오브젝트로 승격됐다.
  // MemoryObjects의 ComputerMemory가 같은 자리(월드 좌표)에 그린다.
  return (
    <group name="desk-accessories">
      <DeskLamp palette={palette} />
      <StudentDeskProps />
    </group>
  );
}

// 상판 소품의 x는 layout의 CABINET_TOP_PROPS에서 가져온다. 기억 오브젝트가 피해야 할
// 구간이라 한곳에서 관리한다. 도형 크기를 바꾸면 거기 halfWidth도 같이 고칠 것.
const { plant, storageBox, clock } = CABINET_TOP_PROPS;

/**
 * 캐비닛 위 탁상시계.
 *
 * 원통 하나에 종이색 원판을 덧댄 게 전부였는데, 그 원판이 원통과 같은 rotation을
 * 받는 바람에 바닥을 보고 서 있었다. 방에서 보이는 건 아무것도 안 적힌 민짜
 * 원반뿐이라 정체를 알 수 없는 물건이 됐다. 문자판을 방 쪽으로 돌리고 바늘을 단다.
 *
 * 원통 몸통 두께가 0.1이므로 앞면은 중심에서 0.05 앞이다. 문자판·바늘·축은 그 앞으로
 * 조금씩 띄워 쌓는다. 같은 z에 놓으면 면이 겹쳐 깜빡인다.
 */
/*
 * z를 -2.48에서 -2.82로 물렸다. 예전 자리에서는 원통 뒷면(z=-2.53)이 캐비닛
 * 앞면과 정확히 같은 평면에 놓여 깊이값이 같아졌고, 프레임마다 앞뒤가 뒤집히며
 * 깜빡였다. 상판 위가 아니라 캐비닛 앞에 떠 있는 것처럼도 보였다.
 * 상판 안쪽으로 들이면 문자판은 여전히 방을 보고, 겹치는 면은 사라진다.
 */
const CLOCK_CENTER: Vec3Tuple = [clock.x, 1.43, -2.82];
const CLOCK_FACE_Z = 0.055;
/**
 * 멈춰 선 시각: 10월 19일, 그날 하교하던 16:20 (v4.1 3장). 그날 이 방의 시간이
 * 거기서 멈췄다.
 */
const CLOCK_HOUR = 16;
const CLOCK_MINUTE = 20;
/** 12시 방향에서 시계방향으로 도는 각. three의 +Z 회전은 반시계라 부호가 뒤집힌다. */
const MINUTE_ANGLE = -(CLOCK_MINUTE / 60) * Math.PI * 2;
const HOUR_ANGLE = -(((CLOCK_HOUR % 12) + CLOCK_MINUTE / 60) / 12) * Math.PI * 2;
/** 멈춘 초침의 자리(초). 12시에 서 있으면 초침이 없는 시계로 읽혀 어중간한 자리에 둔다. */
const SECOND_STOPPED = 23;

/**
 * 초침 (docs/visual-experiments.md 11장 "시계"). 1막 내내 멈춰 있다가 **2막부터 다시 간다**.
 * 방의 다른 것은 전부 그날에 멈춰 있는데, 목소리를 잡고 문이 열린 뒤 이 시계만 다시
 * 시간이 흐른다. 시·분은 그대로다: 맞는 시각이 아니라 흐른다는 사실이 내용이다.
 *
 * 한 초에 한 칸씩 툭툭 간다(스텝). 매끄럽게 돌면 시계가 아니라 계기다. 회전은 그룹을
 * 직접 만지고 상태로 굴리지 않는다 (.claude/rules/r3f.md).
 */
function SecondHand({ color, running }: { color: string; running: boolean }) {
  const groupRef = useRef<Group>(null);
  const startedAt = useRef<number | null>(null);
  useFrame((state) => {
    const group = groupRef.current;
    if (!group) return;
    if (!running) {
      startedAt.current = null;
      group.rotation.z = -(SECOND_STOPPED / 60) * Math.PI * 2;
      return;
    }
    if (startedAt.current === null) startedAt.current = state.clock.elapsedTime;
    const ticks = Math.floor(state.clock.elapsedTime - startedAt.current);
    group.rotation.z = -((SECOND_STOPPED + ticks) / 60) * Math.PI * 2;
  });
  return (
    <group ref={groupRef} position={[0, 0, CLOCK_FACE_Z + 0.018]}>
      <mesh position={[0, 0.085, 0]}>
        <boxGeometry args={[0.006, 0.19, 0.006]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>
    </group>
  );
}

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
    // 바늘은 축을 중심으로 돈다. 회전은 그룹이 맡고 막대는 그 안에서 길이의 절반만큼 올라간다
    <group position={[0, 0, z]} rotation={[0, 0, angle]}>
      <mesh position={[0, length / 2, 0]}>
        <boxGeometry args={[width, length, 0.012]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
    </group>
  );
}

/**
 * 캐비닛 위 탁상시계. 멈춘 시각을 가리키는 소품이고, 누르면 한 줄을 흘린다
 * (칫솔컵과 같은 쉼표 비트). 1막에는 멈춘 시각을, 2막부터는 다시 가는 초침을 말한다.
 * 예전에는 현관 잠금(angle-turn)의 각도 단서였지만 그 퍼즐을 빼면서 단서 자리도 내려놓았다.
 */
/** 천장 에어컨의 자리와, 그 아래 서서 올려다보는 바닥 자리(책상 오른쪽 옆). */
const CEILING_AC = {
  /** 천장(y 4.7)에서 조금 내려 단다. 천장에 바짝 붙이면 윗면이 벽 두께에 묻혀 납작해 보인다. */
  position: [-2.75, 4.18, -3.25] as Vec3Tuple,
  near: [-2.75, -2.4] as const,
  interactionRadius: 1.6,
} as const;

/**
 * 천장 에어컨 (쉼표 비트): 누르면 한 줄. 진행에는 아무것도 남기지 않는다. 확대는 이 게임에서
 * 조사의 문법이라 하지 않는다. 11월 19일의 방에서 에어컨은 틀 일이 없는 물건이고, 그 한 줄이
 * 계절과 흐른 시간을 한 번 더 말한다.
 */
function CeilingAc() {
  const sayRemark = useMemoryRoomStore((state) => state.sayRemark);
  return (
    <TouchProp
      name="ceiling-ac"
      near={CEILING_AC.near}
      radius={CEILING_AC.interactionRadius}
      onPress={() => {
        playSound("select");
        sayRemark("aircon");
      }}
    >
      <FurnitureModel path={ASSETS.models.ceilingAc} position={CEILING_AC.position} scale={1} />
    </TouchProp>
  );
}

function DeskClock({ palette }: FurnitureProps) {
  // 문이 열리면(2막) 초침이 다시 간다. 모션을 끈 사람에게는 멈춘 채 둔다
  const act = useMemoryRoomStore(selectAct);
  const sayRemark = useMemoryRoomStore((state) => state.sayRemark);
  const motionAllowed = useEffectEnabled("cheap");
  const secondsRunning = act >= 2 && motionAllowed;
  return (
    <TouchProp
      name="desk-clock"
      near={CLUE_PROPS.deskClock.near}
      radius={CLUE_PROPS.deskClock.interactionRadius}
      onPress={() => {
        playSound("select");
        sayRemark(act >= 2 ? "clock-running" : "clock-stopped");
      }}
    >
      <group name="desk-clock" position={CLOCK_CENTER}>
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.28, 0.28, 0.1, 24]} />
          <meshStandardMaterial color={palette.trim} roughness={0.72} />
        </mesh>
        <mesh position={[0, 0, CLOCK_FACE_Z]}>
          <circleGeometry args={[0.2, 24]} />
          <meshStandardMaterial color={palette.linen} roughness={0.8} />
        </mesh>
        <ClockHand
          angle={HOUR_ANGLE}
          length={0.11}
          width={0.022}
          z={CLOCK_FACE_Z + 0.008}
          color={palette.frame}
        />
        <ClockHand
          angle={MINUTE_ANGLE}
          length={0.16}
          width={0.016}
          z={CLOCK_FACE_Z + 0.014}
          color={palette.frame}
        />
        <SecondHand color={palette.clay} running={secondsRunning} />
        {/* 바늘이 만나는 축: 두 바늘이 그냥 겹쳐 있으면 십자 무늬로 보인다 */}
        <mesh position={[0, 0, CLOCK_FACE_Z + 0.026]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.018, 0.018, 0.01, 10]} />
          <meshStandardMaterial color={palette.clay} roughness={0.6} />
        </mesh>
      </group>
    </TouchProp>
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
      <FurnitureModel
        path={ASSETS.models.tissueBox}
        position={[storageBox.x, CABINET_TOP_Y, -2.82]}
        scale={1}
      />
      <DeskClock palette={palette} />
    </group>
  );
}

function FloorAccessories({ palette }: FurnitureProps) {
  /*
   * 자체 제작 러그의 바탕은 리넨, 테두리는 테라코타다.
   * 재질 이름(carpet · carpetDarker)은 glb에 박혀 있는 것이다. 팔레트가 바뀌면 같이 바뀌게
   * 메모해 둔다 (FurnitureModel이 재질을 useMemo 안에서 만들어서 참조가 고정돼야 한다).
   */
  const rugColors = useMemo(
    () => ({ carpet: palette.linen, carpetDarker: palette.clay }),
    [palette.linen, palette.clay],
  );
  return (
    <group name="floor-accessories">
      {/* 러그는 두께가 0.01뿐이라 바닥과 겹치지 않게 살짝 띄운다 */}
      <FurnitureModel
        path={ASSETS.models.rug}
        position={[0.2, 0.012, 3.65]}
        scale={2.1}
        materialColors={rugColors}
      />
    </group>
  );
}

/** 놓기 전에 손이 이만큼(초) 멈춰 있었으면 속도를 버린다. */
const CURTAIN_VELOCITY_HOLD_S = 0.1;

/**
 * 커튼 한 쪽. 잡아당겨 젖히고, 한 번 눌러도 여닫힌다.
 *
 * 포인터를 누른 채 좌우로 끌면 그만큼 젖혀지고, 놓으면 충분히 당겼는지에 따라
 * 끝까지 열리거나 도로 닫힌다. 양쪽을 다 젖혀야 밖이 보인다. 창을 여는 건
 * 이 게임에서 "진실을 마주하는" 동작이라 손으로 하게 두는 편이 맞는다.
 *
 * 다 젖힌 뒤에도 계속 만질 수 있다. 커튼은 수집 대상이 아니라 전등 스위치와 같은
 * 방의 곁가지 인터랙션이라, 창밖을 한 번 봤다고 굳어 버리면 안 된다. 도로 닫고
 * 다시 젖히는 것까지가 이 물건의 전부다 (창문 기억 자체는 스토어가 따로 잠근다).
 *
 * 키보드 사용자를 위해 Enter/Space는 그 쪽을 한 번에 젖힌다 (RoomInteractionPrompt의
 * 창문 버튼도 같은 경로로 들어온다).
 */
export function Curtain({
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
  /**
   * 손을 뗐다. `progress`는 놓는 순간의 진행도, `tapped`면 끌지 않고 누르기만 한 것:
   * 그대로 뒤집는다. `velocity`는 놓는 순간 손이 가던 속도(진행도/초)다. 세게 튕기면
   * 반쯤에서 놓아도 끝까지 간다 (curtain-motion의 releaseProgress).
   */
  onRelease: (side: CurtainSide, progress: number, tapped: boolean, velocity: number) => void;
}) {
  /*
   * 다가가면 빛난다. 호버·커서도 다가갔을 때만 켠다. 멀리서 잡을 수 없는 물건이
   * 멀리서 빛나면 "만질 수 있다"는 거짓말이 된다.
   *
   * 기준점은 닫혀 있을 때 천의 가운데다. 젖혀진 천을 따라 판정 원이 미끄러지면,
   * 당기다 말고 반경 밖으로 나가 빛이 꺼진다.
   */
  const clothRef = useRef<Mesh>(null);
  const hitRef = useRef<Mesh>(null);
  const near = useNearPlayer(CURTAIN_X[side].closed, CURTAIN_Z, CURTAIN_NEAR_RADIUS);
  const { handlers } = useGlowHover(near);
  // 모델이 글로우가 켜진 뒤에 붙으면 선택이 비어 있다. 붙을 때마다 다시 훑게 한다.
  const [modelVersion, setModelVersion] = useState(0);
  const handleModelReady = useCallback(() => setModelVersion((version) => version + 1), []);
  /** 화면에 보이는 젖힘 진행도. 놓은 뒤 damp로 `progress`를 따라간다. */
  const shownRef = useRef(progress);
  const reducedMotion = useMemo(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );
  /**
   * 드래그를 시작한 지점과 그때의 진행도. `moved`는 탭과 드래그를 가른다.
   * `velocity`·`lastProgress`·`lastTime`은 놓는 순간의 속도를 셈하는 데 쓴다.
   */
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    from: number;
    moved: boolean;
    velocity: number;
    lastProgress: number;
    lastTime: number;
  } | null>(null);
  const pullRef = useRef(onPull);
  pullRef.current = onPull;
  const releaseRef = useRef(onRelease);
  releaseRef.current = onRelease;
  /** 마지막으로 알린 진행도: 놓을 때 어디서 놓았는지 알려 주기 위해서. */
  const progressRef = useRef(progress);
  progressRef.current = progress;

  /*
   * 커튼을 잡으면 캐릭터가 창가로 걸어가 벽을 보고 서서 양팔을 든다 (Player). 커튼은
   * 몸이 **닿은 뒤에야** 손을 따른다. 그 전에 끌거나 놓은 것은 여기 담아 두었다가
   * 닿는 프레임에 흘려보낸다. 방 저쪽에서 누르면 의자처럼 거절한다: 손이 닿을 리 없는
   * 자리에서 커튼이 혼자 열리면 안 된다.
   */
  const grabCurtain = useMemoryRoomStore((state) => state.grabCurtain);
  const releaseCurtain = useMemoryRoomStore((state) => state.releaseCurtain);
  const pendingRef = useRef<{
    pull: number | null;
    release: { tapped: boolean; velocity: number } | null;
  }>({
    pull: null,
    release: null,
  });
  const nearRef = useRef(near);
  nearRef.current = near;
  const suppressClickRef = useRef(false);

  const pull = useCallback(
    (next: number) => {
      progressRef.current = next;
      pullRef.current(side, next);
    },
    [side],
  );

  const endDrag = useCallback(() => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    suppressClickRef.current = true;
    if (useMemoryRoomStore.getState().curtainGrab?.side !== side) return;
    releaseCurtain();
    const tapped = !drag.moved;
    // 놓기 직전에 손이 멈춰 있었으면 속도는 없는 셈이다. 끌다가 멈춰 서서 놓는 것은
    // "여기 두겠다"는 뜻이지 튕긴 게 아니다
    const stale = (performance.now() - drag.lastTime) / 1000;
    const velocity = stale > CURTAIN_VELOCITY_HOLD_S ? 0 : drag.velocity;
    if (isAtCurtain(useMemoryRoomStore.getState())) {
      releaseRef.current(side, progressRef.current, tapped, velocity);
    } else {
      pendingRef.current.release = { tapped, velocity };
    }
  }, [side, releaseCurtain]);

  // 캔버스 밖에서 손을 떼도 커튼이 끌린 채로 굳지 않게 하는 안전망.
  useEffect(() => {
    const clearSuppressedClick = () => {
      suppressClickRef.current = false;
    };
    const consumeDragClick = (event: MouseEvent) => {
      if (!suppressClickRef.current) return;
      suppressClickRef.current = false;
      event.stopPropagation();
      event.preventDefault();
    };
    // Capture before the Canvas, even when the released pointer is over the floor.
    window.addEventListener("click", consumeDragClick, true);
    window.addEventListener("pointerdown", clearSuppressedClick, true);
    window.addEventListener("keydown", clearSuppressedClick, true);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    return () => {
      window.removeEventListener("click", consumeDragClick, true);
      window.removeEventListener("pointerdown", clearSuppressedClick, true);
      window.removeEventListener("keydown", clearSuppressedClick, true);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
    };
  }, [endDrag]);

  useFrame((_, delta) => {
    // 몸이 창가에 닿기 전에 끌거나 놓은 것을 이제 흘려보낸다. 몸짓이 도중에 접혔으면 버린다.
    const pending = pendingRef.current;
    const currentGrab = useMemoryRoomStore.getState().curtainGrab;
    if (currentGrab?.side !== side) {
      dragRef.current = null;
      pending.pull = null;
      pending.release = null;
    }
    if (pending.pull !== null || pending.release !== null) {
      const state = useMemoryRoomStore.getState();
      if (isAtCurtain(state)) {
        if (pending.pull !== null) pull(pending.pull);
        if (pending.release !== null) {
          releaseRef.current(
            side,
            progressRef.current,
            pending.release.tapped,
            pending.release.velocity,
          );
        }
        pending.pull = null;
        pending.release = null;
      } else if (state.curtainGrab === null) {
        pending.pull = null;
        pending.release = null;
      }
    }
    // 끌고 있는 동안에는 손을 그대로 따라가고, 놓은 뒤에만 부드럽게 붙는다.
    shownRef.current = dragRef.current
      ? progress
      : MathUtils.damp(shownRef.current, progress, reducedMotion ? 18 : 5.5, delta);
    /*
     * 여닫힘은 천의 shape key `open` 하나다 (curtain-model.ts): 천이 바깥쪽 끝에 뭉치며
     * 창이 드러난다. 코드는 천을 옮기지 않아서 블렌더 제작 커튼으로 바꿔도 여기는 그대로다.
     */
    const cloth = clothRef.current;
    const index = cloth?.morphTargetDictionary?.[CURTAIN_OPEN_KEY];
    if (cloth?.morphTargetInfluences && index !== undefined) {
      cloth.morphTargetInfluences[index] =
        CURTAIN_REST_GAP + shownRef.current * (1 - CURTAIN_REST_GAP);
    }
    if (hitRef.current) {
      hitRef.current.position.x = curtainX(side, shownRef.current) - CURTAIN_MODEL_POSITION[0];
    }
  });

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: R3F group은 DOM이 아니라 Canvas 안의 포인터 대상이다.
    <group
      position={CURTAIN_MODEL_POSITION}
      name={`curtain-${side}`}
      {...handlers}
      // A tap's click follows pointerup; don't let the floor cancel the queued closing motion.
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => {
        event.stopPropagation();
        // R3F propagation only stops 3D hits. Also keep the DOM camera drag from starting.
        event.nativeEvent.stopPropagation();
        const startX = curtainPlaneX(event.ray);
        if (startX === null) return;
        // 다가가야 잡을 수 있다. 앉아 있거나 대사 중이면 스토어가 잡기를 거절한다.
        if (!nearRef.current) {
          playSound("deny");
          return;
        }
        grabCurtain(side);
        if (!nearRef.current || !useMemoryRoomStore.getState().curtainGrab?.held) {
          playSound("deny");
          return;
        }
        pendingRef.current.pull = null;
        pendingRef.current.release = null;
        // 포인터를 잡아둬야 커튼 밖으로 손이 나가도 드래그가 이어진다.
        (event.target as Element | null)?.setPointerCapture?.(event.pointerId);
        dragRef.current = {
          pointerId: event.pointerId,
          startX,
          from: progress,
          moved: false,
          velocity: 0,
          lastProgress: progress,
          lastTime: performance.now(),
        };
      }}
      onPointerMove={(event) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        event.stopPropagation();
        event.nativeEvent.stopPropagation();
        const x = curtainPlaneX(event.ray);
        if (x === null) return;
        // 손이 이 폭을 넘긴 적이 있으면 그 뒤로는 계속 드래그다. 되돌아왔다고 탭이 되면
        // 끌다 만 커튼이 엉뚱하게 뒤집힌다.
        if (Math.abs(x - drag.startX) >= CURTAIN_TAP_SLOP) drag.moved = true;
        const next = pullProgress(side, x - drag.startX, drag.from);
        const now = performance.now();
        drag.velocity = pullVelocity(
          drag.velocity,
          drag.lastProgress,
          next,
          (now - drag.lastTime) / 1000,
        );
        drag.lastProgress = next;
        drag.lastTime = now;
        if (isAtCurtain(useMemoryRoomStore.getState())) pull(next);
        else pendingRef.current.pull = next;
      }}
      onPointerUp={(event) => {
        if (!dragRef.current) return;
        event.stopPropagation();
        (event.target as Element | null)?.releasePointerCapture?.(event.pointerId);
        endDrag();
      }}
      // onPointerLeave는 쓰지 않는다. 커튼을 젖히는 순간 포인터가 메쉬 밖으로 나가면서
      // 곧바로 드래그가 취소돼 한 칸도 못 움직였다. 포인터 캡처가 잡혀 있으므로
      // 밖으로 나가도 move/up은 계속 들어온다.
    >
      {/* Follow the gathered cloth with a wider target, without covering the window center. */}
      <mesh
        ref={hitRef}
        name={`curtain-hit-${side}`}
        position={[curtainX(side, progress) - CURTAIN_MODEL_POSITION[0], 1.45, 0.14]}
      >
        <boxGeometry args={[0.76, 2.82, 0.2]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
      </mesh>
      <MemoryGlowSelection
        selectionKey={`curtain-${side}`}
        tier="prop"
        enabled={near}
        selectionVersion={modelVersion}
      >
        <CurtainCloth side={side} palette={palette} meshRef={clothRef} onReady={handleModelReady} />
      </MemoryGlowSelection>
    </group>
  );
}

/**
 * 닫힌 커튼이 남기는 틈 (shape key `open`의 바닥값).
 *
 * 두 폭이 정확히 맞물리면 창이 통째로 사라져서, 커튼을 걷기 전까지 바깥이 저녁이라는
 * 것을 알 길이 없다 (창밖은 노을이다: WindowView). 한 뼘 못 미치게 닫아 두면 가운데로
 * 노을 한 줄이 샌다. 이 방에서 시간이 흐르는 유일한 자리를 가리지 않으려는 값이라,
 * 젖히는 손맛(진행도 0~1)은 그대로 둔 채 바닥값만 올린다.
 */
const CURTAIN_REST_GAP = 0.07;

export function RoomFurniture({
  palette,
  curtainPull,
  onCurtainPull,
  onCurtainRelease,
}: FurnitureProps & {
  curtainPull: CurtainPull;
  onCurtainPull: (side: CurtainSide, progress: number) => void;
  onCurtainRelease: (
    side: CurtainSide,
    progress: number,
    tapped: boolean,
    velocity: number,
  ) => void;
}) {
  return (
    <group name="room-furniture">
      <CeilingAc />
      <Bed palette={palette} />
      <Desk palette={palette} />
      <Chair palette={palette} />
      <Cabinet palette={palette} />
      <Nightstand palette={palette} />
      <Shelves palette={palette} />
      <CabinetAccessories palette={palette} />
      <FloorAccessories palette={palette} />
      <StudentRoomProps />
      <CurtainRod palette={palette} />
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
