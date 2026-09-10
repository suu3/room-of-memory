"use client";

import { useFrame } from "@react-three/fiber";
import { type MutableRefObject, useEffect, useMemo, useRef } from "react";
import { MathUtils, type OrthographicCamera, Vector3 } from "three";
import { focusZoomFor, MIN_ROOM_ZOOM_SCALE } from "@/components/canvas/room-canvas-runtime";
import type { MemoryId } from "@/data/memory-room";
import { useMemoryRoomStore } from "@/store/memory-room";
import { CAMERA_PRESETS, LIVING_BOUNDS, ROOM_BOUNDS } from "./layout";

const cameraPositionGoal = new Vector3();
const cameraTargetGoal = new Vector3();
const orbitOffset = new Vector3();
const ORBIT_AXIS = new Vector3(0, 1, 0);
const roomTarget = CAMERA_PRESETS.room.target;

/**
 * 따라다닐 때 카메라가 보는 높이. 발밑(y=0)을 보면 화면 위쪽이 벽만 남고,
 * 머리 위를 보면 캐릭터가 화면 아래로 처진다. 가슴께가 구도가 가장 안정적이다.
 */
const FOLLOW_TARGET_Y = 1.5;

/**
 * 타깃이 방 밖으로 나가지 않게 하는 여유. 플레이어가 방 모서리에 붙으면 화면
 * 아래쪽에 방 바깥(받침·배경)이 크게 들어오므로, 타깃을 방 안쪽으로 붙들어 둔다.
 * 카메라는 여전히 플레이어 쪽으로 따라가되 모서리에서만 조금 덜 따라간다.
 */
const FOLLOW_INSET = 1.6;
const FOLLOW_LIMITS = {
  minX: ROOM_BOUNDS.minX + FOLLOW_INSET,
  maxX: ROOM_BOUNDS.maxX - FOLLOW_INSET,
  minZ: ROOM_BOUNDS.minZ + FOLLOW_INSET,
  maxZ: ROOM_BOUNDS.maxZ - FOLLOW_INSET,
} as const;

/**
 * 방문이 열린 뒤의 추적 한계: x만 거실 끝까지 는다 (v2).
 *
 * 공간별로 한계를 갈라 문턱에서 스위치하면 목표점이 한 번에 수 유닛을 건너뛰어
 * 카메라가 출렁인다. 두 공간이 x로 이어져 있으므로 x 축 한계만 합치면 목표점이
 * 플레이어를 따라 연속으로 미끄러진다. 전환 연출이 따로 없는 이유다. 문을
 * 넘는 순간은 컷이 아니라 이동이다 (docs/content-design.md 3-3).
 */
const OPEN_FOLLOW_LIMITS = {
  ...FOLLOW_LIMITS,
  minX: LIVING_BOUNDS.minX + FOLLOW_INSET,
} as const;

/**
 * 축소했을 때 카메라가 향하는 공간의 가운데. 플레이어를 끝까지 따라가면 최대 축소에서
 * 방이 화면 한쪽으로 쏠리고 반대쪽 절반이 빈 검정으로 남는다. 배율이 1에서 하한으로
 * 내려가는 만큼 목표점을 플레이어에서 여기로 옮긴다. 방 전체를 보려고 축소한 것이니까.
 */
const ROOM_CENTER = {
  x: (ROOM_BOUNDS.minX + ROOM_BOUNDS.maxX) / 2,
  z: (ROOM_BOUNDS.minZ + ROOM_BOUNDS.maxZ) / 2,
} as const;
const LIVING_CENTER = {
  x: (LIVING_BOUNDS.minX + LIVING_BOUNDS.maxX) / 2,
  z: (LIVING_BOUNDS.minZ + LIVING_BOUNDS.maxZ) / 2,
} as const;

/** 배율(1 = 기본)이 얼마나 축소됐는가 (0 = 기본, 1 = 최대 축소). */
export function zoomOutAmount(zoomScale: number): number {
  const range = 1 - MIN_ROOM_ZOOM_SCALE;
  if (range <= 0 || !Number.isFinite(zoomScale)) return 0;
  return MathUtils.clamp((1 - zoomScale) / range, 0, 1);
}

/** 따라붙는 속도. 프리셋 전환(7)보다 느슨해야 걸을 때 화면이 덜 출렁인다. */
const FOLLOW_LAMBDA = 3.2;

/**
 * 타이틀에서 방 안으로 내려앉는 동안의 속도와 그 구간의 길이(초).
 *
 * 평소 추적 속도(3.2)로 전환하면 0.6초 만에 끝나서, 모형을 보여주고 그 안으로
 * 들어간다는 연출이 통째로 날아간다. 시작 직후 잠깐만 훨씬 느리게 간다.
 */
const ENTER_LAMBDA = 1.25;
const ENTER_DURATION_S = 2.2;

/**
 * 타이틀 화면에서 방 모형이 저 혼자 도는 폭(rad)과 주기(초).
 *
 * 멈춰 있는 3D는 렌더된 그림과 구별이 안 된다. 아주 느리게라도 돌면 "이건 진짜
 * 공간이고 들어갈 수 있다"가 한눈에 읽힌다. 폭은 사용자가 돌릴 수 있는 범위
 * (MAX_ROOM_ORBIT)보다 훨씬 좁게: 타이틀에서 벽이 스러졌다 섰다 하면 산만하다.
 */
const TITLE_DRIFT_AMPLITUDE = 0.16;
const TITLE_DRIFT_PERIOD_S = 26;

/** 카메라가 붙을 수 있는 대상: 기억 오브젝트와 엔딩(문 옆 배트). */
export type CameraFocusId = MemoryId | "ending";

export function CameraRig({
  focusId,
  roomZoom,
  zoomScale = 1,
  orbitAzimuth,
  following,
  playerPositionRef,
}: {
  focusId: CameraFocusId | null;
  roomZoom: number;
  /** 사용자 배율 (1 = 기본). 축소할수록 목표점이 공간의 가운데로 옮겨 간다. */
  zoomScale?: number;
  orbitAzimuth: number;
  /**
   * 플레이어를 따라갈지. 타이틀 화면에서는 false: 방 모형 전체를 정면으로 잡아
   * 놓고, 시작 버튼을 누르면 true가 되면서 카메라가 방 안으로 내려앉는다.
   * 전환 애니메이션은 따로 없다. 목표값이 바뀌면 아래 damp가 알아서 데려간다.
   */
  following: boolean;
  /** 따라갈 대상. */
  playerPositionRef: MutableRefObject<Vector3>;
}) {
  const targetRef = useRef(new Vector3(...roomTarget));
  const reducedMotion = useMemo(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );
  const preset = CAMERA_PRESETS[focusId ?? "room"];
  const follows = following && focusId === null;
  const zoomGoal = focusZoomFor(roomZoom, focusId !== null);
  /** 방 안으로 내려앉기 시작한 뒤 흐른 시간. following이 켜질 때 0으로 되감는다. */
  const enterElapsed = useRef(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: following은 값이 아니라 "구도가 바뀌었다"는 신호로만 쓴다.
  useEffect(() => {
    enterElapsed.current = 0;
  }, [following]);

  useFrame((state, delta) => {
    const { camera } = state;
    if (follows) enterElapsed.current += delta;
    const entering = follows && enterElapsed.current < ENTER_DURATION_S;
    const lambda = reducedMotion ? 18 : entering ? ENTER_LAMBDA : follows ? FOLLOW_LAMBDA : 7;

    if (follows) {
      // 자유 이동 중: 방 한가운데 고정이 아니라 플레이어를 따라본다.
      const player = playerPositionRef.current;
      const store = useMemoryRoomStore.getState();
      const limits = store.doorOpened ? OPEN_FOLLOW_LIMITS : FOLLOW_LIMITS;
      const center = store.inLivingRoom ? LIVING_CENTER : ROOM_CENTER;
      const toCenter = zoomOutAmount(zoomScale);
      cameraTargetGoal.set(
        MathUtils.lerp(MathUtils.clamp(player.x, limits.minX, limits.maxX), center.x, toCenter),
        FOLLOW_TARGET_Y,
        MathUtils.lerp(MathUtils.clamp(player.z, limits.minZ, limits.maxZ), center.z, toCenter),
      );
    } else {
      cameraTargetGoal.set(preset.target[0], preset.target[1], preset.target[2]);
    }
    // 타이틀에서는 사용자 입력 없이도 아주 느리게 돈다. 시작하면 그 흐름 그대로
    // 0으로 수렴시켜야 방에 들어서는 순간 구도가 튀지 않는다.
    const drift =
      following || reducedMotion
        ? 0
        : Math.sin((state.clock.elapsedTime / TITLE_DRIFT_PERIOD_S) * Math.PI * 2) *
          TITLE_DRIFT_AMPLITUDE;

    // 프리셋 위치를 타깃 기준으로 Y축 회전시킨다. 타깃은 그대로라 구도 중심이 유지된다.
    orbitOffset
      .set(
        preset.position[0] - preset.target[0],
        preset.position[1] - preset.target[1],
        preset.position[2] - preset.target[2],
      )
      .applyAxisAngle(ORBIT_AXIS, orbitAzimuth + drift);
    cameraPositionGoal.copy(cameraTargetGoal).add(orbitOffset);

    camera.position.x = MathUtils.damp(camera.position.x, cameraPositionGoal.x, lambda, delta);
    camera.position.y = MathUtils.damp(camera.position.y, cameraPositionGoal.y, lambda, delta);
    camera.position.z = MathUtils.damp(camera.position.z, cameraPositionGoal.z, lambda, delta);

    if ("isOrthographicCamera" in camera && camera.isOrthographicCamera) {
      const orthographicCamera = camera as OrthographicCamera;
      orthographicCamera.zoom = MathUtils.damp(orthographicCamera.zoom, zoomGoal, lambda, delta);
      orthographicCamera.updateProjectionMatrix();
    }

    const target = targetRef.current;
    target.x = MathUtils.damp(target.x, cameraTargetGoal.x, lambda, delta);
    target.y = MathUtils.damp(target.y, cameraTargetGoal.y, lambda, delta);
    target.z = MathUtils.damp(target.z, cameraTargetGoal.z, lambda, delta);
    camera.lookAt(target);
  });

  return null;
}
