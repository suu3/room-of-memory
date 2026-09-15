"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { type MutableRefObject, useLayoutEffect, useMemo, useRef } from "react";
import { MathUtils, Object3D, PerspectiveCamera, type SpotLight, type Vector3 } from "three";
import type { Viewpoint } from "@/store/memory-room";
import { EYE_HEIGHT, FIRST_PERSON_FOV, initialLook, type LookAngles } from "./first-person";
import type { RoomPalette } from "./palette";

/** 시선이 입력을 따라붙는 속도. 끌기가 곧바로 붙되 한 프레임씩 튀지는 않게. */
const LOOK_LAMBDA = 16;
/**
 * 어둠에 적응한 눈: 카메라에 달린 좁은 빛 원뿔. 인트로에서만 켠다. 이게 없으면
 * 소등(BLACKOUT_FACTOR)한 방은 검은 화면이고, 이게 넓으면 그냥 어두운 방이다.
 * 각도는 화각의 절반쯤: 화면 가운데만 보이고 가장자리는 어둠에 잠긴다.
 */
const EYE_CONE = { angle: 0.6, penumbra: 0.8, intensity: 14, distance: 11, decay: 1.7 } as const;

/**
 * 1인칭 카메라. 인트로(스위치 찾기)와 2막 도입(문 넘기)이 같은 리그를 쓴다.
 *
 * 마운트되면 제 원근 카메라를 기본 카메라로 세우고, 언마운트되면 원래(아이소메트릭
 * 직교) 카메라를 돌려놓는다. 두 카메라는 서로 보간되지 않는다. 직교와 원근 사이에
 * 연속된 길은 없으므로 전환은 컷이고, 화면 위의 번쩍임(ViewpointTransition)이 그 컷을
 * 덮는다. 잠들어 있는 동안 직교 카메라는 CameraRig가 건드리지 않아 마지막 자리에
 * 남고, 돌아오면 거기서부터 damp로 따라온다.
 *
 * 위치는 플레이어의 머리다 (positionRef + 눈높이). 몸은 Player가 숨긴다.
 */
export function FirstPersonRig({
  viewpoint,
  playerPositionRef,
  lookRef,
  palette,
}: {
  viewpoint: Exclude<Viewpoint, null>;
  playerPositionRef: MutableRefObject<Vector3>;
  /** DOM 입력(use-first-person-look)이 쓰는 시선. 여기서는 읽고 damp만 한다. */
  lookRef: MutableRefObject<LookAngles>;
  palette: RoomPalette;
}) {
  const set = useThree((state) => state.set);
  const size = useThree((state) => state.size);
  const camera = useMemo(() => {
    const perspective = new PerspectiveCamera(FIRST_PERSON_FOV, 1, 0.05, 60);
    // yaw(Y)를 먼저, pitch(X)를 나중에: 고개를 돌린 뒤 끄덕여야 수평이 안 기운다
    perspective.rotation.order = "YXZ";
    perspective.name = "first-person-camera";
    return perspective;
  }, []);
  /** 원뿔이 향하는 자리: 카메라 정면 1유닛. 카메라의 자식이라 시선을 그대로 따른다. */
  const coneTarget = useMemo(() => {
    const target = new Object3D();
    target.position.set(0, 0, -1);
    return target;
  }, []);
  const coneRef = useRef<SpotLight>(null);
  /** damp로 굴리는 현재 시선. 목표는 lookRef다. */
  const smoothRef = useRef<LookAngles>({ yaw: 0, pitch: 0 });

  // 구간에 들어서는 순간 시선을 놓는다. damp 없이 곧장: 첫 프레임에 휙 도는 건 연출이 아니라 멀미다
  useLayoutEffect(() => {
    const player = playerPositionRef.current;
    const look = initialLook(viewpoint, { x: player.x, z: player.z });
    lookRef.current.yaw = look.yaw;
    lookRef.current.pitch = look.pitch;
    smoothRef.current.yaw = look.yaw;
    smoothRef.current.pitch = look.pitch;
    camera.position.set(player.x, player.y + EYE_HEIGHT, player.z);
    camera.rotation.set(look.pitch, look.yaw, 0);
    camera.updateMatrixWorld();
  }, [viewpoint, camera, lookRef, playerPositionRef]);

  useLayoutEffect(() => {
    camera.aspect = size.width / size.height;
    camera.updateProjectionMatrix();
  }, [camera, size]);

  useLayoutEffect(() => {
    const cone = coneRef.current;
    if (cone) cone.target = coneTarget;
  }, [coneTarget]);

  // 기본 카메라를 바꿔 끼운다. 되돌리는 것까지가 이 리그의 몫이다
  useLayoutEffect(() => {
    let previous: PerspectiveCamera | null = null;
    set((state) => {
      previous = state.camera as PerspectiveCamera;
      return { camera };
    });
    return () => {
      if (previous) set({ camera: previous });
    };
  }, [camera, set]);

  useFrame((_, delta) => {
    const player = playerPositionRef.current;
    camera.position.set(player.x, player.y + EYE_HEIGHT, player.z);
    const smooth = smoothRef.current;
    const goal = lookRef.current;
    smooth.yaw = MathUtils.damp(smooth.yaw, goal.yaw, LOOK_LAMBDA, delta);
    smooth.pitch = MathUtils.damp(smooth.pitch, goal.pitch, LOOK_LAMBDA, delta);
    camera.rotation.set(smooth.pitch, smooth.yaw, 0);
  });

  return (
    <primitive object={camera}>
      {viewpoint === "intro" && (
        <spotLight
          ref={coneRef}
          color={palette.linen}
          angle={EYE_CONE.angle}
          penumbra={EYE_CONE.penumbra}
          intensity={EYE_CONE.intensity}
          distance={EYE_CONE.distance}
          decay={EYE_CONE.decay}
        />
      )}
      <primitive object={coneTarget} />
    </primitive>
  );
}
