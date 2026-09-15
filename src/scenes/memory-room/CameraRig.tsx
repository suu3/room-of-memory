"use client";

import { useFrame } from "@react-three/fiber";
import { type MutableRefObject, useEffect, useMemo, useRef } from "react";
import { MathUtils, type OrthographicCamera, Vector3 } from "three";
import { focusZoomFor, MIN_ROOM_ZOOM_SCALE } from "@/components/canvas/room-canvas-runtime";
import type { MemoryId } from "@/data/memory-room";
import { useMemoryRoomStore } from "@/store/memory-room";
import { EVENT_PULSE, subscribeEventPulse } from "./event-pulse";
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

/**
 * 타이틀에서 마우스를 따라 방 모형이 기우는 폭. 방위각(rad)과 시선 높이(월드 유닛).
 *
 * 화면 끝까지 밀어도 2도가 채 안 된다. 드리프트(0.16rad)보다 훨씬 작아야 한다.
 * 손에 반응한다는 감각이면 충분하고, 그 이상은 조작으로 읽혀 메뉴에서 손을 뗀다.
 * 따라붙는 속도는 손보다 늦다. 늦어야 무게가 읽힌다.
 */
const PARALLAX_AZIMUTH = 0.03;
const PARALLAX_LIFT = 0.12;
const PARALLAX_LAMBDA = 3;

/**
 * 사건(기억 수집·라디오 각성)에 카메라가 눌리는 폭과 되돌아오는 속도.
 * 배율을 잠깐 줄인다: 화면이 한 번 숨을 들이쉬듯 물러났다 돌아온다. 흔들지는 않는다.
 */
const KICK_ZOOM = 0.012;
const KICK_LAMBDA = 5;
/**
 * 라디오가 깨어나는 순간의 흔들림(rad)과 잦아드는 속도. 기억 하나를 줍는 눌림과는
 * 다른 사건이라 따로 둔다. 세기는 눈치챌 듯 말 듯: 화면이 흔들렸다기보다 "방이
 * 한 번 떨었다"로 읽혀야 한다. 흔든 만큼 정확히 되돌아온다 (lookAt 뒤에 얹는다).
 */
const SHAKE = { roll: 0.011, yaw: 0.007, lambda: 2.4, rollHz: 37, yawHz: 29 } as const;

/** 카메라가 붙을 수 있는 대상: 기억 오브젝트와 엔딩(문 옆 배트). */
export type CameraFocusId = MemoryId | "ending";

export function CameraRig({
  focusId,
  roomZoom,
  zoomScale = 1,
  orbitAzimuth,
  following,
  firstPerson = false,
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
  /**
   * 1인칭 구간(FirstPersonRig)이 기본 카메라를 쥐고 있는가. 그동안 이 리그는 아무것도
   * 하지 않는다. 직교 카메라는 마지막 자리에 잠들어 있다가 돌아오면 거기서 따라온다.
   * 인트로 뒤에는 타이틀 구도에서 방 안으로 내려앉는 연출이 그대로 살아난다.
   */
  firstPerson?: boolean;
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
  /** 마우스 자리(-1~1). 타이틀에서만 읽고, 시작하면 0으로 수렴시킨다. */
  const pointerRef = useRef({ x: 0, y: 0 });
  const parallaxRef = useRef({ x: 0, y: 0 });
  /** 사건의 눌림 (0~1). 곧바로 붙었다가 잦아든다. */
  const kickRef = useRef(0);
  /** 라디오 각성의 떨림 (0~1). 눌림과 같은 사건에서 시작해 더 오래 남는다. */
  const shakeRef = useRef(0);
  /** damp로 굴리는 배율의 본값. 눌림은 이 위에 곱해서 카메라에만 쓴다. */
  const zoomRef = useRef<number | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: following은 값이 아니라 "구도가 바뀌었다"는 신호로만 쓴다.
  useEffect(() => {
    enterElapsed.current = 0;
  }, [following]);

  // 타이틀 화면은 캔버스를 덮고 있어 r3f의 pointer는 갱신되지 않는다. 창에서 직접 듣는다.
  useEffect(() => {
    if (following || reducedMotion) return;
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      pointerRef.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      pointerRef.current.y = (event.clientY / window.innerHeight) * 2 - 1;
    };
    const onLeave = () => {
      pointerRef.current.x = 0;
      pointerRef.current.y = 0;
    };
    window.addEventListener("pointermove", onMove);
    document.addEventListener("pointerleave", onLeave);
    window.addEventListener("blur", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("blur", onLeave);
      onLeave();
    };
  }, [following, reducedMotion]);

  useEffect(() => {
    if (reducedMotion) return;
    return subscribeEventPulse((strength) => {
      kickRef.current = Math.max(kickRef.current, strength);
      if (strength >= EVENT_PULSE.radioWake) shakeRef.current = 1;
    });
  }, [reducedMotion]);

  useFrame((state, delta) => {
    const { camera } = state;
    // 머릿속에 있는 동안은 잠든다. 내려앉는 연출의 시계도 멈춰 두어 돌아온 뒤에 돈다
    if (firstPerson) {
      enterElapsed.current = 0;
      return;
    }
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

    // 마우스를 따라 아주 조금 기운다. 시작하면(following) 목표가 0이라 드리프트처럼 수렴한다
    const parallax = parallaxRef.current;
    const parallaxGoal = following || reducedMotion ? 0 : 1;
    parallax.x = MathUtils.damp(
      parallax.x,
      pointerRef.current.x * parallaxGoal,
      PARALLAX_LAMBDA,
      delta,
    );
    parallax.y = MathUtils.damp(
      parallax.y,
      pointerRef.current.y * parallaxGoal,
      PARALLAX_LAMBDA,
      delta,
    );
    cameraTargetGoal.y -= parallax.y * PARALLAX_LIFT;

    // 프리셋 위치를 타깃 기준으로 Y축 회전시킨다. 타깃은 그대로라 구도 중심이 유지된다.
    orbitOffset
      .set(
        preset.position[0] - preset.target[0],
        preset.position[1] - preset.target[1],
        preset.position[2] - preset.target[2],
      )
      .applyAxisAngle(ORBIT_AXIS, orbitAzimuth + drift + parallax.x * PARALLAX_AZIMUTH);
    cameraPositionGoal.copy(cameraTargetGoal).add(orbitOffset);

    camera.position.x = MathUtils.damp(camera.position.x, cameraPositionGoal.x, lambda, delta);
    camera.position.y = MathUtils.damp(camera.position.y, cameraPositionGoal.y, lambda, delta);
    camera.position.z = MathUtils.damp(camera.position.z, cameraPositionGoal.z, lambda, delta);

    if ("isOrthographicCamera" in camera && camera.isOrthographicCamera) {
      const orthographicCamera = camera as OrthographicCamera;
      // 본값은 따로 굴린다. 눌림을 camera.zoom에 곱한 채 다음 프레임에 읽으면 damp가 그걸 목표와의 거리로 오해한다
      const zoom = MathUtils.damp(
        zoomRef.current ?? orthographicCamera.zoom,
        zoomGoal,
        lambda,
        delta,
      );
      zoomRef.current = zoom;
      kickRef.current *= Math.exp(-KICK_LAMBDA * delta);
      if (kickRef.current < 0.001) kickRef.current = 0;
      orthographicCamera.zoom = zoom * (1 - kickRef.current * KICK_ZOOM);
      orthographicCamera.updateProjectionMatrix();
    }

    const target = targetRef.current;
    target.x = MathUtils.damp(target.x, cameraTargetGoal.x, lambda, delta);
    target.y = MathUtils.damp(target.y, cameraTargetGoal.y, lambda, delta);
    target.z = MathUtils.damp(target.z, cameraTargetGoal.z, lambda, delta);
    camera.lookAt(target);

    // 떨림은 lookAt 위에 얹는다. lookAt이 프레임마다 자세를 새로 놓으므로 누적되지 않는다
    if (shakeRef.current > 0) {
      const shake = shakeRef.current;
      const time = state.clock.elapsedTime;
      camera.rotateZ(Math.sin(time * SHAKE.rollHz) * SHAKE.roll * shake);
      camera.rotateY(Math.sin(time * SHAKE.yawHz) * SHAKE.yaw * shake);
      shakeRef.current = shake * Math.exp(-SHAKE.lambda * delta);
      if (shakeRef.current < 0.001) shakeRef.current = 0;
    }
  });

  return null;
}
