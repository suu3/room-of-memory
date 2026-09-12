"use client";

import { ContactShadows, useGLTF } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { type MutableRefObject, useEffect, useMemo, useRef } from "react";
import type { Group, Mesh, MeshStandardMaterial } from "three";
import { ASSETS } from "@/lib/assets";
import { resolveRoomPalette } from "@/scenes/memory-room/palette";
import {
  createPlayerRig,
  disposePlayerRig,
  startPlayerRig,
  updatePlayerRig,
} from "@/scenes/memory-room/player-animation";
import { SIT_CONTACT_Y, STEP_RATE } from "@/scenes/memory-room/player-rig";
import { seatOffsetFromCenter } from "@/scenes/memory-room/seats";
import { advanceSitProgress, sitEase } from "@/scenes/memory-room/sit-motion";

/**
 * 수첩에서 돌려보는 캐릭터 모델 (CharacterModelViewer 안에서만 쓴다).
 *
 * 방에 서 있는 그 모델 그대로다. 같은 URL을 쓰므로 useGLTF 캐시를 나눠 갖고, 포즈도
 * 게임과 같은 리그 코드(player-animation)가 돌린다. 뷰어 전용 리그를 따로 두면 방에서
 * 바뀐 자세가 수첩에서는 옛날 것으로 남는다.
 */

export type ViewerPose = "stand" | "walk" | "sit";

/** 손을 놓으면 다시 도는 속도(rad/s). 정면으로 굳어 있으면 3D인 줄 모른다. */
const AUTO_SPIN = 0.32;
/** 손을 뗀 뒤 저 혼자 돌기 시작할 때까지(ms). 보던 각도를 잠깐은 지켜 준다. */
const SPIN_RESUME_MS = 2200;
/** 걷기 포즈의 보폭 속도. 방에서 걷는 속도(2.35)보다 느긋하게: 제자리걸음이라. */
const VIEWER_WALK_SPEED = 1.5;

/*
 * 앉기 포즈에 딸려 나오는 걸상.
 *
 * 방에서는 의자가 이 일을 하지만 여기엔 가구가 없다. 허공에 앉은 그림은 자세가 아니라
 * 버그로 읽힌다. 좌면은 몸이 닿는 높이(SIT_CONTACT_Y)에 맞추고, 앞뒤는 방의 의자와 같은
 * 규칙(seats.ts의 seatOffsetFromCenter)으로 몸을 좌면 **앞턱**에 걸쳐 앉힌다: 이 캐릭터는
 * 다리가 짧아 좌면 가운데에 두면 정강이와 발이 좌면을 뚫고 내려간다.
 */
const STOOL_HEIGHT = 0.28;
const STOOL_DEPTH = 0.5;
const STOOL_SIZE: [number, number, number] = [0.78, STOOL_HEIGHT, STOOL_DEPTH];
const STOOL_POSITION: [number, number, number] = [
  0,
  SIT_CONTACT_Y - STOOL_HEIGHT / 2,
  -seatOffsetFromCenter(STOOL_DEPTH / 2),
];

function ViewerModel({
  yawRef,
  touchedAtRef,
  pose,
}: {
  /** 바깥(드래그·키보드)이 쥐고 있는 각도. 값으로 내리면 프레임마다 리렌더된다. */
  yawRef: MutableRefObject<number>;
  /** 마지막으로 손댄 시각(ms). 0이면 아직 아무도 안 만졌다. */
  touchedAtRef: MutableRefObject<number>;
  pose: ViewerPose;
}) {
  const groupRef = useRef<Group>(null);
  const stoolRef = useRef<Mesh>(null);
  const phaseRef = useRef(0);
  const walkRef = useRef(0);
  const sitRef = useRef(0);
  const { scene, animations } = useGLTF(ASSETS.models.playerBlocky, true, true);
  const rig = useMemo(() => createPlayerRig(scene, animations), [scene, animations]);
  const palette = useMemo(resolveRoomPalette, []);

  useEffect(() => {
    startPlayerRig(rig);
    return () => disposePlayerRig(rig);
  }, [rig]);

  useFrame((_, delta) => {
    const step = Math.min(delta, 0.05);
    const group = groupRef.current;
    if (Date.now() - touchedAtRef.current > SPIN_RESUME_MS) yawRef.current += AUTO_SPIN * step;
    if (group) group.rotation.y = yawRef.current;
    sitRef.current = advanceSitProgress(sitRef.current, pose === "sit", step);
    const walking = pose === "walk" ? 1 : 0;
    walkRef.current += (walking - walkRef.current) * Math.min(1, step * 8);
    phaseRef.current += STEP_RATE * VIEWER_WALK_SPEED * walkRef.current * step;
    const sitting = sitEase(sitRef.current);
    updatePlayerRig(rig, phaseRef.current, walkRef.current, step, sitting);
    // 걸상은 몸이 내려앉는 만큼 함께 드러난다. 다 앉은 뒤에 튀어나오면 뒤늦은 변명이 된다.
    const stool = stoolRef.current;
    if (stool) {
      stool.visible = sitting > 0.02;
      (stool.material as MeshStandardMaterial).opacity = sitting;
    }
  });

  return (
    <group ref={groupRef}>
      <primitive object={rig.root} dispose={null} />
      <mesh ref={stoolRef} position={STOOL_POSITION} visible={false} castShadow>
        <boxGeometry args={STOOL_SIZE} />
        <meshStandardMaterial color={palette.wood} roughness={0.78} transparent opacity={0} />
      </mesh>
    </group>
  );
}

export default function CharacterTurntable({
  yawRef,
  touchedAtRef,
  pose,
}: {
  yawRef: MutableRefObject<number>;
  touchedAtRef: MutableRefObject<number>;
  pose: ViewerPose;
}) {
  return (
    <Canvas
      // 수첩은 종이 위다. 방의 밤 조명이 아니라 밝은 실내 광으로 세운다.
      // 세로 화각 30°에서 키(1.55)가 다 들어오려면 3.4는 떨어져야 한다. 2.75에서는 발이 잘렸다
      camera={{ position: [0, 0.05, 3.4], fov: 30 }}
      gl={{ alpha: true, antialias: true }}
      dpr={[1, 2]}
      style={{ touchAction: "none" }}
    >
      <ambientLight intensity={1.35} />
      <directionalLight position={[2.5, 3.5, 3]} intensity={1.7} />
      <directionalLight position={[-3, 1.5, -2]} intensity={0.5} />
      {/* 발이 y=0인 모델이라, 몸 한가운데(0.78)를 화면 가운데에 두려면 통째로 내린다 */}
      <group position={[0, -0.8, 0]}>
        <ViewerModel yawRef={yawRef} touchedAtRef={touchedAtRef} pose={pose} />
        {/* 발밑 그림자. 없으면 종이 위에 떠 있는 그림으로 보인다 */}
        <ContactShadows position={[0, 0.01, 0]} opacity={0.32} scale={3} blur={2.4} far={1.2} />
      </group>
    </Canvas>
  );
}
