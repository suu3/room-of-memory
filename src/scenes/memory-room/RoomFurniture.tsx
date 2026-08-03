import { useGLTF } from "@react-three/drei";
import type {} from "@react-three/fiber";
import { useFrame } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { type Group, MathUtils, Plane, Vector3 } from "three";
import { ASSETS } from "@/lib/assets";
import { type CurtainPull, type CurtainSide, curtainX, pullProgress } from "./curtain-motion";
import { FurnitureModel } from "./FurnitureModel";
import {
  CABINET_BODY,
  CABINET_TOP_PROPS,
  CABINET_TOP_Y,
  CHAIR_POSITION,
  CHAIR_ROTATION,
  DESK_POSITION,
  DESK_ROTATION,
} from "./layout";
import { MemoryGlowSelection } from "./MemoryOutlineGlow";
import type { RoomPalette } from "./palette";
import type { Vec3Tuple } from "./types";
import { useGlowHover } from "./use-glow-hover";

const ROOM_PROP_PATHS = [
  ASSETS.models.computerScreen,
  ASSETS.models.computerKeyboard,
  ASSETS.models.computerMouse,
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
const CABINET_PARTS = [
  { ...CABINET_BODY, color: "dusk" },
  { size: [2.08, 0.92, 0.06], position: [1.23, 0.58, -2.53], color: "slate" },
  { size: [2.08, 0.92, 0.06], position: [3.47, 0.58, -2.53], color: "slate" },
  { size: [0.12, 0.12, 0.05], position: [2.14, 0.58, -2.46], color: "bone" },
  { size: [0.12, 0.12, 0.05], position: [2.56, 0.58, -2.46], color: "bone" },
] as const satisfies readonly BoxPart[];

// 몸통 앞면 z=1.16. 캐비닛과 같은 규칙.
const NIGHTSTAND_PARTS = [
  { size: [0.9, 0.95, 0.82], position: [6.8, 0.48, 0.75], color: "dusk" },
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
  return (
    <group name="desk-accessories">
      <FurnitureModel
        path={ASSETS.models.computerScreen}
        position={[-0.35, DESK_TOP_Y, -0.36]}
        scale={DESK_PROP_SCALE}
      />
      <FurnitureModel
        path={ASSETS.models.computerKeyboard}
        position={[-0.3, DESK_TOP_Y, 0.32]}
        scale={DESK_PROP_SCALE}
      />
      <FurnitureModel
        path={ASSETS.models.computerMouse}
        position={[0.42, DESK_TOP_Y, 0.34]}
        scale={DESK_PROP_SCALE}
      />
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
      <mesh position={[clock.x, 1.43, -2.48]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.28, 0.28, 0.1, 24]} />
        <meshStandardMaterial color={palette.bone} roughness={0.72} />
      </mesh>
      <mesh position={[clock.x, 1.43, -2.42]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.2, 24]} />
        <meshStandardMaterial color={palette.paper} roughness={0.8} />
      </mesh>
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
 * 커튼 한 쪽. 클릭이 아니라 잡아당겨 연다.
 *
 * 포인터를 누른 채 좌우로 끌면 그만큼 젖혀지고, 놓으면 충분히 당겼는지에 따라
 * 끝까지 열리거나 도로 닫힌다. 양쪽을 다 젖혀야 밖이 보인다 — 창을 여는 건
 * 이 게임에서 "진실을 마주하는" 동작이라 손으로 하게 두는 편이 맞는다.
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
  onRelease: (side: CurtainSide) => void;
}) {
  const groupRef = useRef<Group>(null);
  const opened = progress >= 1;
  const { hovered, handlers } = useGlowHover(!opened);
  const reducedMotion = useMemo(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );
  /** 드래그를 시작한 지점과 그때의 진행도. */
  const dragRef = useRef<{ pointerId: number; startX: number; from: number } | null>(null);
  const releaseRef = useRef(onRelease);
  releaseRef.current = onRelease;

  const endDrag = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = null;
    releaseRef.current(side);
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
        if (opened) return;
        event.stopPropagation();
        // 포인터를 잡아둬야 커튼 밖으로 손이 나가도 드래그가 이어진다.
        (event.target as Element | null)?.setPointerCapture?.(event.pointerId);
        const startX = curtainPlaneX(event.ray);
        if (startX === null) return;
        dragRef.current = { pointerId: event.pointerId, startX, from: progress };
      }}
      onPointerMove={(event) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        event.stopPropagation();
        const x = curtainPlaneX(event.ray);
        if (x === null) return;
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
      <MemoryGlowSelection selectionKey={`curtain-${side}`} enabled={hovered}>
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
  onCurtainRelease: (side: CurtainSide) => void;
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
