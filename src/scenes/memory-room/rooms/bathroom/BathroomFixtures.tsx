"use client";

import { useEffect } from "react";
import { Vector2 } from "three";
import { pressSinkPlug } from "@/lib/room-press";
import {
  clueUnlocked,
  selectBadgeSeen,
  selectViewpoint,
  useMemoryRoomStore,
} from "@/store/memory-room";
import { MirrorReflection } from "../../effects/MirrorReflection";
import { MemoryBeacon } from "../../memory/MemoryBeacon";
import { ClueProp, type HitBox, TouchProp } from "../../memory/RoomClues";
import { idleFacing } from "../../player/idle-facing";
import { useNearPlayer } from "../../player/use-near-player";
import { InteriorBox as Box, InteriorCylinder as Cylinder } from "../../shared/InteriorPrimitives";
import { BATHROOM_COLLIDERS, BATHROOM_SHELL_BOUNDS } from "../../world/layout";
import type { RoomPalette } from "../../world/palette";
import type { EulerTuple, Vec3Tuple } from "../../world/types";
import { FaceMirror } from "./FaceMirror";
import { SinkWater } from "./SinkWater";

const [toilet, sink, tub] = BATHROOM_COLLIDERS;
const sinkZ = (sink.minZ + sink.maxZ) / 2;

/**
 * 세면대가 선 자리: 왼쪽(-x) 벽, 문과 변기 사이 (layout의 BATHROOM_COLLIDERS 주석).
 *
 * 세면대에 달린 것(대야·하부장·칫솔컵·거울)은 전부 이 틀 안의 로컬 좌표로 놓는다:
 * 로컬 +z가 벽(-x)을 보고 로컬 +x가 +z를 본다. 카메라는 늘 +x 쪽에 있으므로 로컬 -z
 * (하부장 문·다이얼이 달린 앞면)가 카메라를 마주 본다. 벽에서 물러난 거리(0.33)는
 * 안쪽 벽에 붙어 있던 때와 같다.
 */
export const SINK_MOUNT = {
  position: [sink.minX + 0.33, 0, sinkZ] as Vec3Tuple,
  rotation: [0, -Math.PI / 2, 0] as EulerTuple,
} as const;
/** 세면대 앞 한 걸음(왼쪽 벽에서 방 안쪽으로): 하부장·칫솔컵이 켜지는 자리. */
export const SINK_NEAR = [sink.maxX + 0.5, sinkZ] as const;
export const SINK_RADIUS = 1.6;
/**
 * 거울에 얼굴이 맺히는 거리 (FaceMirror). 글로우 반경(1.6)은 문간에 막 들어선 자리
 * (landing, 1.3 떨어짐)까지 품어서, 그대로 쓰면 들어서자마자 맺힌다. 세면대에 붙어 섰을
 * 때만이어야 한다. 문간 자리가 이 안에 들지 않는 것을 layout.test가 지킨다.
 */
export const MIRROR_NEAR_RADIUS = 0.9;
/** 거울을 보는 방향: -x (Player의 facing 축, atan2(dx, dz)). */
const MIRROR_FACING = Math.atan2(-1, 0);
// Outer ceramic wall turns over the rim and descends into the bowl.
const BOWL_PROFILE = [
  [0.13, 0.12],
  [0.17, 0.2],
  [0.24, 0.3],
  [0.285, 0.4],
  [0.28, 0.445],
  [0.235, 0.455],
  [0.205, 0.405],
  [0.16, 0.32],
  [0.09, 0.27],
  [0, 0.27],
].map(([radius, height]) => new Vector2(radius, height));

function Faucet({ palette }: { palette: RoomPalette }) {
  return (
    <group name="basin-faucet">
      <Cylinder
        position={[0, 0.1, 0]}
        radius={0.033}
        height={0.2}
        color={palette.trim}
        metalness={0.8}
      />
      <Box
        position={[0, 0.2, -0.065]}
        size={[0.075, 0.05, 0.18]}
        color={palette.trim}
        metalness={0.8}
        roughness={0.23}
      />
      <Box
        position={[0.075, 0.13, 0]}
        size={[0.13, 0.027, 0.045]}
        color={palette.trim}
        metalness={0.8}
      />
    </group>
  );
}

function Toilet({ palette }: { palette: RoomPalette }) {
  return (
    <group
      name="ceramic-toilet"
      position={[(toilet.minX + toilet.maxX) / 2 + 0.025, 0, toilet.minZ + 0.35]}
    >
      <Box
        position={[0, 0.08, 0.04]}
        size={[0.4, 0.16, 0.52]}
        color={palette.linen}
        radius={0.07}
        roughness={0.25}
      />
      <mesh position={[0, 0, -0.03]} scale={[0.85, 1, 1.08]} castShadow receiveShadow>
        <latheGeometry args={[BOWL_PROFILE, 32]} />
        <meshStandardMaterial color={palette.linen} roughness={0.23} />
      </mesh>
      <mesh position={[0, 0.285, -0.03]} rotation={[-Math.PI / 2, 0, 0]} scale={[0.085, 0.105, 1]}>
        <circleGeometry args={[1, 32]} />
        <meshStandardMaterial color={palette.deep} roughness={0.4} />
      </mesh>
      <mesh
        position={[0, 0.47, -0.03]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[0.85, 1.08, 1]}
        castShadow
      >
        <torusGeometry args={[0.255, 0.042, 8, 32]} />
        <meshStandardMaterial color={palette.linen} roughness={0.2} />
      </mesh>
      <Box
        position={[0, 0.63, 0.3]}
        size={[0.57, 0.58, 0.19]}
        color={palette.linen}
        radius={0.065}
        roughness={0.24}
      />
      <Box
        position={[0, 0.938, 0.3]}
        size={[0.59, 0.05, 0.21]}
        color={palette.linen}
        roughness={0.2}
      />
      <Cylinder
        position={[0.12, 0.967, 0.3]}
        radius={0.045}
        height={0.015}
        color={palette.trim}
        metalness={0.75}
      />
    </group>
  );
}

/**
 * 세면대 마개. 배수구에 꽂혀 있고 쇠줄이 수도꼭지 쪽으로 늘어져 있다. 가까이 가면 글로우가
 * 붙고, 누르면 물이 빠진다 (store의 drainSink → SinkWater). 뽑힌 마개는 대야 가장자리에
 * 놓인다. 다시 꽂는 일은 없다: 30일 고인 물은 한 번 빠지면 끝이다.
 */
/**
 * 마개와 배지가 눌리는 범위: 대야 안쪽 전체. 둘 다 손톱만 해서 제 모양으로는 거의 안 눌리고,
 * 사람은 세면대를 누른다. 가장자리의 칫솔컵·비누는 덮지 않는다.
 */
const BASIN_HIT: HitBox = { position: [0, 0.8, 0], size: [0.44, 0.12, 0.36] };

function SinkPlug({ palette }: { palette: RoomPalette }) {
  const drained = useMemoryRoomStore((state) => state.sinkDrained);
  const firstPerson = useMemoryRoomStore(selectViewpoint) !== null;
  const near = useNearPlayer(SINK_NEAR[0], SINK_NEAR[1], SINK_RADIUS);
  return (
    <>
      {/*
        마개는 안방 열쇠로 가는 길의 첫 고리인데 손톱만 하고 물 밑이라, 글로우만으로는 눌러야
        하는 물건인지 알 수 없었다. 물을 뺄 때까지 기억처럼 표식을 세운다 (MemoryBeacon의 BeaconId)
      */}
      {/* 표식의 마름모도 눌린다 (MemoryBeacon): 여기서는 마개를 감싼 그룹 밖이라 직접 잇는다 */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: R3F group은 DOM이 아니라 Canvas 안의 포인터 대상이다. */}
      <group
        position={PLUG_BEACON}
        onClick={(event) => {
          event.stopPropagation();
          if (!drained && !firstPerson) pressSinkPlug();
        }}
      >
        <MemoryBeacon
          id="sink-plug"
          color={palette.memory}
          active={!drained && !firstPerson}
          near={near}
          groundOffset={SINK_MOUNT.position[1] + PLUG_BEACON[1]}
        />
      </group>
      <SinkPlugProp palette={palette} drained={drained} />
    </>
  );
}

/** 대야 한가운데, 물 위. 표식의 마름모는 여기서 조금 더 뜬다 (MemoryBeacon의 DIAMOND_LIFT). */
const PLUG_BEACON: Vec3Tuple = [0, 0.8, 0];

function SinkPlugProp({ palette, drained }: { palette: RoomPalette; drained: boolean }) {
  return (
    <TouchProp
      name="sink-plug"
      near={SINK_NEAR}
      radius={SINK_RADIUS}
      enabled={!drained}
      // 뽑을 때까지 금빛으로 부른다
      beckon={!drained}
      hitBox={BASIN_HIT}
      onPress={pressSinkPlug}
    >
      <group
        name="sink-plug"
        position={drained ? [0.3, 0.86, -0.12] : [0, 0.791, 0]}
        rotation={drained ? [0, 0.6, Math.PI / 2] : [0, 0, 0]}
      >
        <Cylinder
          position={[0, 0, 0]}
          radius={0.032}
          topRadius={0.028}
          height={0.014}
          color={palette.deep}
        />
        <Cylinder
          position={[0, 0.014, 0]}
          radius={0.009}
          height={0.016}
          color={palette.frame}
          metalness={0.8}
        />
        <Box
          position={[0, 0.02, 0.09]}
          rotation={[0.35, 0, 0]}
          size={[0.006, 0.006, 0.18]}
          color={palette.frame}
          metalness={0.8}
          roughness={0.3}
        />
      </group>
    </TouchProp>
  );
}

/** 대야 윗부분: 받침 위의 몸통, 네 테두리, 오목한 바닥. 칫솔컵(BathroomShell)은 +x 테두리에 앉는다. */
function BasinTop({ palette }: { palette: RoomPalette }) {
  return (
    <>
      <Box
        position={[0, 0.7, 0]}
        size={[0.8, 0.12, 0.46]}
        color={palette.linen}
        radius={0.05}
        roughness={0.22}
      />
      <Box
        position={[0, 0.765, 0]}
        size={[0.45, 0.018, 0.29]}
        color={palette.trim}
        radius={0.007}
        roughness={0.3}
      />
      {[-0.31, 0.31].map((x) => (
        <Box
          key={x}
          position={[x, 0.8, 0]}
          size={[0.24, 0.1, 0.52]}
          color={palette.linen}
          radius={0.045}
          roughness={0.2}
        />
      ))}
      {[-0.22, 0.22].map((z) => (
        <Box
          key={z}
          position={[0, 0.8, z]}
          size={[0.44, 0.1, 0.08]}
          color={palette.linen}
          roughness={0.2}
        />
      ))}
    </>
  );
}

/**
 * 물 밑에 깔려 있던 아빠의 출입증 배지: 둥근 판에 끈이 달린 채 대야 바닥에 엎어져 있다.
 * 물을 빼기 전에는 물 판이 덮어 보이지 않고 만져지지도 않는다 (store의 clueUnlocked).
 * 빠지면 금빛으로 부르고(beckon), 누르면 확대 화면이 펼쳐진다 (ClueOverlay의 LaonBadgeZoom).
 */
function SinkBadge({ palette }: { palette: RoomPalette }) {
  const unlocked = useMemoryRoomStore((state) => clueUnlocked(state, "laon-badge"));
  const seen = useMemoryRoomStore(selectBadgeSeen);
  return (
    <ClueProp
      clue="laon-badge"
      near={SINK_NEAR}
      radius={SINK_RADIUS}
      enabled={unlocked}
      beckon={unlocked && !seen}
      hitBox={BASIN_HIT}
    >
      {/*
        윤곽선은 배지 조각이 아니라 대야 윗부분 전체에 선다: 배지는 손톱만 해서 제 윤곽만으로는
        멀리서 안 보인다. 그래서 대야 윗부분이 이 단서의 글로우 안에 들어와 있다
      */}
      <BasinTop palette={palette} />
      <group name="laon-badge" position={[0.12, 0.774, -0.05]} rotation={[0, -0.5, 0]}>
        <Cylinder position={[0, 0, 0]} radius={0.058} height={0.006} color={palette.linen} />
        <mesh position={[0, 0.0035, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.036, 0.05, 24]} />
          <meshStandardMaterial color={palette.frame} metalness={0.6} roughness={0.3} />
        </mesh>
        <Cylinder position={[0, 0.004, 0]} radius={0.014} height={0.002} color={palette.frame} />
        {/* 목걸이 끈: 배지에서 대야 벽 쪽으로 늘어진다 */}
        <Box
          position={[-0.06, 0.004, 0.07]}
          rotation={[0, 0.9, 0]}
          size={[0.014, 0.004, 0.16]}
          color={palette.deep}
          roughness={0.7}
        />
      </group>
    </ClueProp>
  );
}

function Sink({ palette }: { palette: RoomPalette }) {
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: R3F group은 DOM이 아니라 Canvas 안의 포인터 대상이다.
    <group
      name="pedestal-basin"
      position={SINK_MOUNT.position}
      rotation={SINK_MOUNT.rotation}
      // 세면대 몸통이 클릭을 받아 삼킨다. 안 그러면 몸통을 누른 클릭이 벽 너머 거실의 물건으로 넘어간다
      onClick={(event) => event.stopPropagation()}
    >
      <Cylinder
        position={[0, 0.08, 0.09]}
        radius={0.19}
        topRadius={0.15}
        height={0.14}
        color={palette.linen}
      />
      <Cylinder
        position={[0, 0.39, 0.09]}
        radius={0.12}
        topRadius={0.17}
        height={0.64}
        color={palette.linen}
      />
      <Cylinder
        position={[0, 0.78, 0]}
        radius={0.035}
        height={0.01}
        color={palette.frame}
        metalness={0.8}
      />
      {/* 대야 윗부분과 물 밑의 배지. 배지는 물보다 먼저 그린다: 물 판이 투명해지며 걷힐 때 그 아래가 보여야 한다 */}
      <SinkBadge palette={palette} />
      {/* 30일 고인 물. 열쇠를 집는 순간 파문 하나가 번진다. 마개를 뽑으면 빠진다 (SinkWater) */}
      <SinkWater palette={palette} />
      <SinkPlug palette={palette} />
      <group position={[0, 0.85, 0.2]}>
        <Faucet palette={palette} />
      </group>
      <Box
        position={[-0.3, 0.873, 0.04]}
        size={[0.14, 0.035, 0.19]}
        color={palette.sage}
        roughness={0.35}
      />
      <Box
        position={[-0.3, 0.904, 0.04]}
        size={[0.105, 0.035, 0.13]}
        color={palette.linen}
        radius={0.014}
      />
    </group>
  );
}

function Bathtub({ palette }: { palette: RoomPalette }) {
  const width = tub.maxX - tub.minX - 0.12;
  const depth = tub.maxZ - tub.minZ - 0.18;
  return (
    <group
      name="recessed-bathtub"
      position={[(tub.minX + tub.maxX) / 2 - 0.025, 0, (tub.minZ + tub.maxZ) / 2]}
    >
      <Box
        position={[0, 0.12, 0]}
        size={[width, 0.22, depth]}
        color={palette.linen}
        radius={0.08}
        roughness={0.28}
      />
      <Box
        position={[0, 0.239, 0]}
        size={[width - 0.15, 0.018, depth - 0.21]}
        color={palette.trim}
        roughness={0.32}
      />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Box
            position={[side * (width / 2 - 0.05), 0.37, 0]}
            size={[0.1, 0.51, depth]}
            color={palette.linen}
            radius={0.04}
            roughness={0.24}
          />
          <Box
            position={[0, 0.37, side * (depth / 2 - 0.065)]}
            size={[width - 0.08, 0.51, 0.13]}
            color={palette.linen}
            radius={0.055}
            roughness={0.24}
          />
        </group>
      ))}
      <Cylinder
        position={[0, 0.256, -depth / 2 + 0.3]}
        radius={0.045}
        height={0.014}
        color={palette.frame}
        metalness={0.7}
      />
      {/* The hanging cloth clears the ceramic face but stays inside the collider margin. */}
      <Box
        position={[-width / 2 + 0.085, 0.645, 0.15]}
        size={[0.18, 0.05, 0.44]}
        color={palette.fabric}
        radius={0.02}
      />
      <Box
        position={[-width / 2 - 0.014, 0.47, 0.15]}
        size={[0.025, 0.34, 0.44]}
        color={palette.fabric}
        radius={0.01}
      />
    </group>
  );
}

/**
 * Wall-mounted fittings belong to the wall's culling group.
 *
 * 세면대 위, 왼쪽(-x) 벽에 걸린다 (SINK_MOUNT와 같은 방향: 로컬 -z가 방 안쪽 +x를 본다).
 * 그 벽은 카메라 반대쪽이라 걷히지 않으므로 거울은 늘 보인다. 안쪽 벽에 걸려 있던 때는
 * 그 벽이 카메라 쪽이라 회전 한쪽 끝에서만 잠깐 섰다.
 *
 * 유리는 방의 전신거울과 같은 진짜 거울이다 (MirrorReflection). 전에는 세로줄마다 시간이
 * 어긋나는 slit-scan이었는데(2026-09-30까지), 방 저편에서는 깨진 텍스처로 읽히고 가까이서도
 * "30일 만의 얼굴"보다 고장 난 거울로 읽혀 걷었다. 화장실은 1인칭으로 들어오지 않아
 * 늘 3인칭 간격으로 그린다.
 *
 * 세면대 앞에 서면 그 위로 얼굴이 맺힌다 (FaceMirror): 내려다보는 반사에는 정수리뿐이라,
 * 거울이 보는 쪽에서 찍은 얼굴을 얹는다. 창도 대사도 없는, 다가서면 생기는 일이다.
 */
export function BathroomMirror({ palette }: { palette: RoomPalette }) {
  const nearSink = useNearPlayer(SINK_NEAR[0], SINK_NEAR[1], MIRROR_NEAR_RADIUS);
  // 세면대 앞에 가만히 서면 거울(-x 벽)을 본다. 등을 보이면 거울에는 뒤통수뿐이다
  useEffect(() => {
    if (!nearSink) return;
    idleFacing.yaw = MIRROR_FACING;
    return () => {
      if (idleFacing.yaw === MIRROR_FACING) idleFacing.yaw = null;
    };
  }, [nearSink]);
  return (
    <group
      name="bathroom-mirror-cabinet"
      position={[sink.minX + 0.15, 1.72, sinkZ]}
      rotation={SINK_MOUNT.rotation}
    >
      <Box size={[1.02, 0.99, 0.1]} position={[0, 0, 0]} color={palette.frame} radius={0.04} />
      {/* 거울판은 +z를 보게 만들어진다. 캐비닛 로컬 -z가 방 안쪽이라 돌려 세우고, 유리면(-0.06)에 맞춘다 */}
      <group rotation={[0, Math.PI, 0]}>
        <MirrorReflection
          width={0.91}
          height={0.88}
          offset={0.06}
          palette={palette}
          firstPerson={false}
        />
        <FaceMirror width={0.91} height={0.88} offset={0.06} active={nearSink} />
      </group>
      <Box
        size={[0.035, 0.76, 0.008]}
        position={[-0.37, 0.01, -0.074]}
        color={palette.trim}
        roughness={0.22}
      />
      <Box size={[1.04, 0.055, 0.25]} position={[0, -0.54, -0.045]} color={palette.trim} />
      <Cylinder position={[-0.34, -0.4, -0.07]} radius={0.065} height={0.23} color={palette.sage} />
      <Cylinder
        position={[-0.34, -0.26, -0.07]}
        radius={0.028}
        height={0.05}
        color={palette.frame}
      />
      <Cylinder
        position={[0.33, -0.415, -0.07]}
        radius={0.055}
        height={0.2}
        color={palette.linen}
      />
    </group>
  );
}

export function BathroomShower({ palette }: { palette: RoomPalette }) {
  return (
    <group
      name="shower-fittings"
      position={[BATHROOM_SHELL_BOUNDS.maxX - 0.15, 0, tub.minZ + 0.48]}
    >
      <Cylinder
        position={[-0.02, 1.75, 0]}
        radius={0.022}
        height={1.55}
        color={palette.trim}
        metalness={0.8}
      />
      <Cylinder
        position={[-0.14, 2.49, 0]}
        radius={0.022}
        height={0.27}
        rotation={[0, 0, Math.PI / 2]}
        color={palette.trim}
        metalness={0.8}
      />
      <Cylinder
        position={[-0.25, 2.44, 0]}
        radius={0.14}
        height={0.045}
        color={palette.trim}
        metalness={0.75}
      />
      <Cylinder position={[-0.25, 2.411, 0]} radius={0.115} height={0.008} color={palette.frame} />
      <Box
        position={[-0.04, 0.99, 0]}
        size={[0.12, 0.09, 0.32]}
        color={palette.trim}
        metalness={0.7}
        roughness={0.25}
      />
      <Box
        position={[-0.07, 1.38, 0.64]}
        size={[0.17, 0.045, 0.36]}
        color={palette.trim}
        metalness={0.65}
      />
      <Cylinder position={[-0.08, 1.53, 0.59]} radius={0.05} height={0.25} color={palette.sage} />
      <Cylinder
        position={[-0.08, 1.675, 0.59]}
        radius={0.028}
        height={0.04}
        color={palette.frame}
      />
    </group>
  );
}

export function BathroomFixtures({ palette }: { palette: RoomPalette }) {
  return (
    <group name="bathroom-fixtures">
      <Toilet palette={palette} />
      <Sink palette={palette} />
      <Bathtub palette={palette} />
    </group>
  );
}
