"use client";

import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { type MutableRefObject, Suspense, useEffect, useMemo, useRef } from "react";
import { type Group, MathUtils, Vector3 } from "three";
import { ASSETS } from "@/lib/assets";
import {
  openDoorwayIds,
  selectSceneInputLocked,
  selectViewpoint,
  useMemoryRoomStore,
} from "@/store/memory-room";
import type { CurtainSide } from "@/types/curtain";
import type { MovementAxes } from "@/types/movement";
import { advanceCurtainMotion, type CurtainMotion, createCurtainMotion } from "./curtain-animation";
import type { CurtainPull } from "./curtain-motion";
import { MIRROR_ONLY_LAYER } from "./first-person";
import { CURTAIN_STAND } from "./layout";
import { findPath } from "./pathfind";
import {
  type CurtainPose,
  createPlayerRig,
  disposePlayerRig,
  startPlayerRig,
  updatePlayerRig,
} from "./player-animation";
import { captureMovementKeyDown, MOVEMENT_KEYS, resolveMovementInput } from "./player-input";
import { LIE_TILT, STEP_RATE } from "./player-rig";
import { SEATS, type Seat } from "./seats";
import {
  advanceSitPhases,
  LIE_SECONDS,
  type LiePhases,
  lerp,
  lerpAngle,
  liePhasesOf,
  SIT_SECONDS,
  type SitPhases,
  sitEase,
} from "./sit-motion";
import { spaceAt, walkColliders, walkZones } from "./spaces";
import { moveThroughZones, type Vec2 } from "./spatial";
import type { Aabb2 } from "./types";
import { isWalkBlocked, stepToward } from "./walk-to";

/** 발이 바닥에 닿는 높이. 충돌·근접 판정은 x/z만 보므로 y는 순수 시각값이다. */
export const PLAYER_START = new Vector3(0, 0, 2.35);
const PLAYER_RADIUS = 0.38;
const PLAYER_SPEED = 2.35;
const MAX_FRAME_DELTA = 0.05;
/** 진행 방향으로 돌아서는 속도(damp lambda). */
const TURN_LAMBDA = 11;
/** 걷기 강도가 붙고 빠지는 속도. 낮추면 멈춘 뒤에도 다리가 한참 흔들린다. */
const WALK_BLEND_LAMBDA = 12;
/** 한 걸음도 안 되는 거리면 걷는 시늉을 하지 않는다. 제자리걸음이 더 어색하다. */
const MIN_TRAVEL_DISTANCE = 0.25;
const cameraForward = new Vector3();
const cameraRight = new Vector3();

/**
 * 걷기 영역과 막는 것은 열린 문간의 목록에서 나온다 (spaces.ts). 문 자체에 콜라이더가
 * 없으므로 "문이 막는다"는 곧 "그 문간 영역이 없다"이다. 열린 문간 목록이 바뀔 때만
 * 다시 만든다: 프레임마다 배열을 새로 엮으면 걷는 내내 쓰레기가 쌓인다.
 */
function walkableFor(state: { doorOpened: boolean; openedDoorways: readonly string[] }) {
  const open = openDoorwayIds(state as Parameters<typeof openDoorwayIds>[0]);
  const key = open.join(",");
  if (walkableCache.key !== key) {
    walkableCache.key = key;
    walkableCache.zones = walkZones(open);
    walkableCache.colliders = walkColliders(open);
  }
  return walkableCache;
}
const walkableCache: { key: string | null; zones: Aabb2[]; colliders: Aabb2[] } = {
  key: null,
  zones: [],
  colliders: [],
};

useGLTF.preload(ASSETS.models.playerBlocky, true, true);
useGLTF.preload(ASSETS.models.curtainPullTest, true, true);
useGLTF.preload(ASSETS.models.curtainPullLeft, true, true);

/** 최단 회전 방향으로 각도를 damp: -π/π 경계에서 한 바퀴 도는 걸 막는다. */
function dampAngle(current: number, target: number, lambda: number, delta: number): number {
  const shortest = MathUtils.euclideanModulo(target - current + Math.PI, Math.PI * 2) - Math.PI;
  return current + shortest * (1 - Math.exp(-lambda * delta));
}

interface PlayerProps {
  positionRef: MutableRefObject<Vector3>;
  movementInputRef: MutableRefObject<MovementAxes>;
  curtainPull: CurtainPull;
}

/**
 * 몸. Suspense 경계는 밖의 Player가 들고 있다 (아래 주석).
 */
function LoadedPlayer({ positionRef, movementInputRef, curtainPull }: PlayerProps) {
  const groupRef = useRef<Group>(null);
  const facingRef = useRef<Group>(null);
  /** 눕는 회전(침대). 바라보는 방향 안쪽에서 몸을 뒤로 젖힌다. */
  const lieRef = useRef<Group>(null);
  const keysRef = useRef(new Set<string>());
  const originRef = useRef<Vec2>({ x: PLAYER_START.x, z: PLAYER_START.z });
  const deltaRef = useRef<Vec2>({ x: 0, z: 0 });
  const resultRef = useRef<Vec2>({ x: PLAYER_START.x, z: PLAYER_START.z });
  const resolvedInputRef = useRef<MovementAxes>({ horizontal: 0, vertical: 0 });
  const phaseRef = useRef(0);
  const walkRef = useRef(0);
  const curtainPoseRef = useRef<CurtainPose>({ side: "right", time: 0, weight: 0 });
  const inputLocked = useMemoryRoomStore(selectSceneInputLocked);
  /*
   * 앉기.
   *
   * 자리는 스토어가 갖고(가구가 앉힌다), 몸이 거기까지 가는 건 여기서 한다. **걸어가서**
   * 앉고, 일어선 다음 걸어 돌아온다 (sit-motion의 advanceSitPhases).
   *
   * `standing`은 앉기 직전에 서 있던 자리다. 좌석은 콜라이더 안(의자 위)이라 일어설
   * 자리를 새로 찾는 대신 왔던 자리를 기억하는 편이 확실하다.
   */
  const seatedAt = useMemoryRoomStore((state) => state.seatedAt);
  const phasesRef = useRef<SitPhases>({ travel: 0, sit: 0 });
  /** 눕는 자리에서 sit 진행도를 걸터앉기·젖히기로 가른 것. 프레임마다 채워 쓴다. */
  const liePhasesRef = useRef<LiePhases>({ perch: 0, recline: 0 });
  const seatRef = useRef<{
    seat: Seat;
    standing: { x: number; z: number; facing: number };
    /** 자리까지 걷는 데 걸리는 시간(초)과 걸어가는 방향. */
    travelSeconds: number;
    approach: number;
  } | null>(null);
  /*
   * 커튼 잡기.
   *
   * 잡으면 창가(CURTAIN_STAND)로 **걸어가서** 벽을 보고 선 다음에야 팔을 든다. 앉기와
   * 같은 걸음이다. 커튼은 도착(arriveAtCurtain)을 보고서야 손을 따른다. 놓으면 팔이
   * 잠깐 남았다가 내려오고, 다 내려오면 몸짓을 지운다(endCurtainGrab). 몸은 그 자리에
   * 남는다. 커튼을 젖히고 창밖을 보는 자리라 돌아올 이유가 없다.
   */
  const curtainGrab = useMemoryRoomStore((state) => state.curtainGrab);
  /*
   * 바닥 클릭으로 걷기. 목표는 스토어가 들고(바닥이 준다) 걸음은 여기서 뗀다. 키·조이스틱과
   * 같은 이동 경로(moveThroughZones)를 타서 가구에 걸리면 미끄러지다 서고, 키를 누르면 잊는다.
   */
  const walkTarget = useMemoryRoomStore((state) => state.walkTarget);
  /**
   * 목표까지의 경유점. 클릭할 때 한 번 찾는다(pathfind). 앞의 것부터 하나씩 지운다.
   * 길이 없으면(방 밖을 눌렀다) 비어 있고, 스토어의 목표도 같이 지운다.
   */
  const walkTargetRef = useRef<Vec2[] | null>(null);
  useEffect(() => {
    const group = groupRef.current;
    if (!walkTarget || !group) {
      walkTargetRef.current = null;
      return;
    }
    const walkable = walkableFor(useMemoryRoomStore.getState());
    const path = findPath(
      { x: group.position.x, z: group.position.z },
      { x: walkTarget.x, z: walkTarget.z },
      PLAYER_RADIUS,
      walkable.zones,
      walkable.colliders,
    );
    walkTargetRef.current = path;
    if (!path) useMemoryRoomStore.getState().clearWalk();
  }, [walkTarget]);
  const grabRef = useRef<{
    standing: { x: number; z: number };
    travelSeconds: number;
    approach: number;
    travel: number;
    side: CurtainSide;
    motion: CurtainMotion;
  } | null>(null);
  const { scene, animations } = useGLTF(ASSETS.models.playerBlocky, true, true);
  const rightMotion = useGLTF(ASSETS.models.curtainPullTest, true, true);
  const leftMotion = useGLTF(ASSETS.models.curtainPullLeft, true, true);
  const rig = useMemo(
    () =>
      createPlayerRig(scene, animations, {
        right: rightMotion.animations[0],
        left: leftMotion.animations[0],
      }),
    [scene, animations, rightMotion.animations, leftMotion.animations],
  );

  useEffect(() => {
    startPlayerRig(rig);
    return () => disposePlayerRig(rig);
  }, [rig]);

  /*
   * 1인칭 구간에는 몸을 메인 카메라가 안 보는 층으로 옮긴다. 카메라가 머리 안에 있어서
   * 보이면 제 몸통 속이다. 지우지 않고 층만 옮기는 이유는 거울이다: 거울의 반사
   * 카메라만 그 층을 켜서(MirrorReflection) 어둠 속 제 모습이 거울에 비친다.
   * 위치·걸음은 그대로 돈다: 카메라(FirstPersonRig)가 positionRef를 따라간다.
   */
  const firstPerson = useMemoryRoomStore(selectViewpoint) !== null;
  useEffect(() => {
    rig.root.traverse((object) => object.layers.set(firstPerson ? MIRROR_ONLY_LAYER : 0));
  }, [rig, firstPerson]);

  /*
   * 리셋(HUD "처음으로"·엔딩 화면)마다 몸도 시작 자리로 돌아간다.
   *
   * 진행은 스토어가 지우지만 위치는 이 그룹의 변환에만 있어서, 안 돌리면 거실까지
   * 걸어갔던 몸이 그 자리에 남는다. 다음 "새 게임"이 닫힌 문 너머 거실에서
   * 시작되고, 방으로 돌아올 길이 없다 (엔딩이 거실 현관에서 나므로 완주 후
   * 새 게임이 정확히 이 꼴이 된다).
   */
  const resetRevision = useMemoryRoomStore((state) => state.resetRevision);
  useEffect(() => {
    // 값은 안 읽는다. 리셋마다 다시 실행되게 하는 신호다 (MemoryOutlineGlow와 같은 패턴).
    void resetRevision;
    positionRef.current.copy(PLAYER_START);
    const group = groupRef.current;
    if (group) group.position.copy(PLAYER_START);
    if (facingRef.current) facingRef.current.rotation.y = 0;
    if (lieRef.current) lieRef.current.rotation.x = 0;
    walkRef.current = 0;
    curtainPoseRef.current.weight = 0;
    phaseRef.current = 0;
    phasesRef.current.travel = 0;
    phasesRef.current.sit = 0;
    seatRef.current = null;
    grabRef.current = null;
    walkTargetRef.current = null;
    updatePlayerRig(rig, 0, 0, 0);
  }, [resetRevision, positionRef, rig]);

  /*
   * 개발 도구가 몸을 옮긴다 (AdminPanel의 방/거실 버튼).
   *
   * 위치는 이 그룹의 변환에만 있으므로 스토어 혼자서는 못 옮긴다. 신호를 받아 여기서
   * 옮기고, 어느 공간에 들어왔는지도 같이 알린다(공유벽 컬링과 카메라가 그걸 본다).
   * 걷던 상태·앉던 상태는 같이 정리한다: 자리로 걸어가던 도중에 옮겨지면 몸이 옛 목표를
   * 향해 다시 미끄러져 돌아간다.
   */
  const warpTarget = useMemoryRoomStore((state) => state.warpTarget);
  useEffect(() => {
    const group = groupRef.current;
    if (warpTarget === null || !group) return;
    group.position.set(warpTarget.x, 0, warpTarget.z);
    positionRef.current.copy(group.position);
    const store = useMemoryRoomStore.getState();
    store.setSpace(spaceAt(warpTarget.x, warpTarget.z, store.space));
    seatRef.current = null;
    grabRef.current = null;
    curtainPoseRef.current.weight = 0;
    walkTargetRef.current = null;
    if (lieRef.current) lieRef.current.rotation.x = 0;
    phasesRef.current.travel = 0;
    phasesRef.current.sit = 0;
    walkRef.current = 0;
  }, [warpTarget, positionRef]);

  /*
   * 앉으라는 신호가 오면 그 순간 서 있던 자리를 붙잡아 둔다. 일어설 때는 목표만
   * 되돌리면 되므로(진행도가 0으로 흐른다) 좌석 정보는 다 돌아올 때까지 남겨 둔다.
   */
  useEffect(() => {
    if (seatedAt === null) return;
    const group = groupRef.current;
    const facing = facingRef.current;
    if (!group || !facing) return;
    const seat = SEATS[seatedAt];
    // 창가로 가던 중이면 그 몸짓은 접는다. 두 목표를 동시에 쫓으면 몸이 둘로 갈린다.
    if (grabRef.current) {
      useMemoryRoomStore.getState().endCurtainGrab();
      grabRef.current = null;
    }
    // 걸어가는 목표는 앉는 자리가 아니라 그 앞에 서는 자리다 (침대는 옆에 선다).
    const spot = seat.approach ?? seat.anchor;
    const toSeatX = spot.x - group.position.x;
    const toSeatZ = spot.z - group.position.z;
    const distance = Math.hypot(toSeatX, toSeatZ);
    seatRef.current = {
      seat,
      standing: { x: group.position.x, z: group.position.z, facing: facing.rotation.y },
      travelSeconds: distance < MIN_TRAVEL_DISTANCE ? 0 : distance / PLAYER_SPEED,
      approach: Math.atan2(toSeatX, toSeatZ),
    };
  }, [seatedAt]);

  /*
   * 커튼을 잡으면 그 순간 서 있던 자리에서 창가까지의 걸음을 잰다. 이미 걸어가는 중이면
   * (같은 몸짓 안에서 다른 쪽 커튼을 잡았다) 그대로 둔다. 도착 판정이 이어서 처리한다.
   */
  useEffect(() => {
    if (curtainGrab === null) {
      grabRef.current = null;
      return;
    }
    if (grabRef.current?.side === curtainGrab.side) return;
    const group = groupRef.current;
    if (!group) return;
    // 앉으러 가는 도중이면 몸이 둘로 갈린다. 그 몸짓은 없던 일로 한다.
    if (seatRef.current) {
      useMemoryRoomStore.getState().endCurtainGrab();
      return;
    }
    const toStandX = CURTAIN_STAND.x - group.position.x;
    const toStandZ = CURTAIN_STAND.z - group.position.z;
    const distance = Math.hypot(toStandX, toStandZ);
    grabRef.current = {
      standing: { x: group.position.x, z: group.position.z },
      travelSeconds: distance < MIN_TRAVEL_DISTANCE ? 0 : distance / PLAYER_SPEED,
      approach: Math.atan2(toStandX, toStandZ),
      travel: 0,
      side: curtainGrab.side,
      motion: createCurtainMotion(curtainPull[curtainGrab.side]),
    };
  }, [curtainGrab, curtainPull]);

  useEffect(() => {
    const keys = keysRef.current;
    const clearInputs = () => {
      keys.clear();
      movementInputRef.current.horizontal = 0;
      movementInputRef.current.vertical = 0;
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      captureMovementKeyDown(event, keys, selectSceneInputLocked(useMemoryRoomStore.getState()));
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (MOVEMENT_KEYS.has(event.code)) keys.delete(event.code);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", clearInputs);
    document.addEventListener("visibilitychange", clearInputs);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", clearInputs);
      document.removeEventListener("visibilitychange", clearInputs);
      clearInputs();
    };
  }, [movementInputRef]);

  useEffect(() => {
    if (!inputLocked) return;
    keysRef.current.clear();
    movementInputRef.current.horizontal = 0;
    movementInputRef.current.vertical = 0;
  }, [inputLocked, movementInputRef]);

  useFrame(({ camera }, delta) => {
    const group = groupRef.current;
    const facing = facingRef.current;
    if (!group || !facing) return;

    const step = Math.min(delta, MAX_FRAME_DELTA);
    // 입력이 잠겨도 포즈는 계속 돈다. 대사 중에 다리가 걷다 만 자세로 굳지 않게.
    const locked = selectSceneInputLocked(useMemoryRoomStore.getState());
    const input = locked
      ? null
      : resolveMovementInput(keysRef.current, movementInputRef.current, resolvedInputRef.current);
    const horizontal = input?.horizontal ?? 0;
    const vertical = input?.vertical ?? 0;
    const moving = horizontal !== 0 || vertical !== 0;
    let speed = 0;

    /*
     * 앉아 있는 동안에는 걷지 않는다. 대신 움직이려는 입력이 곧 일어서라는 신호다.
     * 자리에서 벗어나려면 의자를 다시 눌러야 한다면, 걸어 나가려던 손이 갇힌다.
     */
    const seated = useMemoryRoomStore.getState().seatedAt !== null;
    if (seated && moving) useMemoryRoomStore.getState().standUp();
    const parked = seatRef.current;
    const lying = parked?.seat.pose === "lie";
    const phases = parked
      ? advanceSitPhases(
          phasesRef.current,
          seated,
          step,
          parked.travelSeconds,
          phasesRef.current,
          lying ? LIE_SECONDS : SIT_SECONDS,
        )
      : phasesRef.current;
    const sitting = phases.travel > 0 || phases.sit > 0;

    // 창가로 가는 도중에 걸으려 들면 그 몸짓은 접는다. 손이 갇히면 안 된다 (앉기와 같다).
    if (moving && grabRef.current) {
      useMemoryRoomStore.getState().endCurtainGrab();
      grabRef.current = null;
    }
    const grab = grabRef.current;
    const grabState = grab ? useMemoryRoomStore.getState().curtainGrab : null;

    // 키·조이스틱으로 걷기 시작하면 클릭 목표는 잊는다. 손이 직접 잡은 쪽이 우선이다.
    if (moving && walkTargetRef.current) {
      walkTargetRef.current = null;
      useMemoryRoomStore.getState().clearWalk();
    }

    /**
     * 몸을 `movementDelta`만큼 옮긴다 (가구·벽에 걸리면 미끄러진다). 키 이동과 클릭 이동이
     * 같은 길을 타야 한다. 실제로 간 거리를 돌려주고, 걸음 애니메이션은 그 거리로 돈다.
     */
    const walkBy = (movementDelta: Vec2): number => {
      const origin = originRef.current;
      origin.x = group.position.x;
      origin.z = group.position.z;
      const store = useMemoryRoomStore.getState();
      const walkable = walkableFor(store);
      const result = moveThroughZones(
        origin,
        movementDelta,
        PLAYER_RADIUS,
        walkable.zones,
        walkable.colliders,
        resultRef.current,
      );
      group.position.x = result.x;
      group.position.z = result.z;
      positionRef.current.copy(group.position);

      // 문턱을 넘어 다른 공간의 껍데기에 들면 알린다. 공유벽 컬링과 카메라가 이 사실을 본다.
      // setSpace는 값이 같으면 아무것도 안 하므로 프레임마다 불러도 싸다.
      store.setSpace(spaceAt(result.x, result.z, store.space));

      facing.rotation.y = dampAngle(
        facing.rotation.y,
        Math.atan2(movementDelta.x, movementDelta.z),
        TURN_LAMBDA,
        delta,
      );
      // 조이스틱은 아날로그라 살살 밀면 천천히 간다. 보폭도 같이 느려져야 발이 안 미끄러진다.
      const traveled = Math.hypot(result.x - origin.x, result.z - origin.z);
      speed = step > 0 ? Math.min(1, traveled / (PLAYER_SPEED * step)) : 0;
      phaseRef.current += STEP_RATE * traveled;
      return traveled;
    };

    if (moving && !seated && !sitting) {
      camera.getWorldDirection(cameraForward);
      cameraForward.y = 0;
      cameraForward.normalize();
      cameraRight.crossVectors(cameraForward, camera.up).normalize();

      const frameDistance = PLAYER_SPEED * step;
      const movementDelta = deltaRef.current;
      movementDelta.x = (cameraRight.x * horizontal + cameraForward.x * vertical) * frameDistance;
      movementDelta.z = (cameraRight.z * horizontal + cameraForward.z * vertical) * frameDistance;
      walkBy(movementDelta);
    } else if (walkTargetRef.current && !locked && !seated && !sitting && !grab) {
      // 경유점을 하나씩 따라 걷는다. 마지막 점에 닿았거나 정면으로 막혔으면 거기서 선다.
      const waypoints = walkTargetRef.current;
      const next = waypoints[0];
      if (!next) {
        walkTargetRef.current = null;
        useMemoryRoomStore.getState().clearWalk();
      } else {
        const intended = stepToward(group.position, next, PLAYER_SPEED * step, deltaRef.current);
        const traveled = intended > 0 ? walkBy(deltaRef.current) : 0;
        if (intended === 0) {
          waypoints.shift();
          if (waypoints.length === 0) {
            walkTargetRef.current = null;
            useMemoryRoomStore.getState().clearWalk();
          }
        } else if (isWalkBlocked(intended, traveled)) {
          walkTargetRef.current = null;
          useMemoryRoomStore.getState().clearWalk();
        }
      }
    }

    /*
     * 자리로 가고 앉는 동안의 몸.
     *
     * 걷는 구간에서는 실제로 간 거리로 보폭을 돌린다 (평소 이동과 같은 계산): 다리를
     * 멈춘 채 미끄러져 들어가면 앉는 자세보다 그 미끄러짐이 먼저 눈에 걸린다.
     * 앉는 구간에서만 몸이 좌면 높이로 내려앉고 의자 쪽으로 돌아선다.
     */
    const sitting01 = sitEase(phases.sit);
    // 리그에 넘길 Sit 가중치. 눕는 자리는 걸터앉았다가 젖히면서 다시 편다. 아래서 갈라진다.
    let sitWeight = sitting01;
    if (parked) {
      const { anchor, bodyY, facing: seatFacing, perch } = parked.seat;
      const spot = parked.seat.approach ?? anchor;
      const { standing, approach } = parked;
      const eased = sitEase(phases.travel);
      /*
       * 눕는 자리는 앉는 구간이 둘로 갈린다 (sit-motion의 liePhasesOf): 가장자리(perch)에
       * 걸터앉고, 그 다음에야 발을 올리며 뒤로 눕는다(recline). 서서 판자처럼 넘어가던
       * 그림을 앉았다 눕는 순서로 바꾼 것이다. 의자는 걸터앉는 자리가 곧 앉는 자리라
       * 두 번째 토막이 없다.
       */
      let settle01 = sitting01;
      let recline01 = 0;
      if (lying) {
        const split = liePhasesOf(phases.sit, liePhasesRef.current);
        settle01 = sitEase(split.perch);
        recline01 = sitEase(split.recline);
      }
      const perchX = perch?.x ?? anchor.x;
      const perchZ = perch?.z ?? anchor.z;
      const perchY = perch?.bodyY ?? bodyY;
      const perchFacing = perch?.facing ?? seatFacing;
      // 걷는 구간은 서는 자리까지, 앉는 구간은 거기서 걸터앉는 자리까지, 눕는 구간은 다시 눕는 자리까지.
      const nextX = lerp(
        lerp(lerp(standing.x, spot.x, eased), perchX, settle01),
        anchor.x,
        recline01,
      );
      const nextZ = lerp(
        lerp(lerp(standing.z, spot.z, eased), perchZ, settle01),
        anchor.z,
        recline01,
      );
      const traveled = Math.hypot(nextX - group.position.x, nextZ - group.position.z);
      group.position.x = nextX;
      group.position.z = nextZ;
      group.position.y = lerp(lerp(0, perchY, settle01), bodyY, recline01);
      // 걸어갈 때는 가는 쪽을 보고(돌아올 때는 그 반대), 앉으면서 의자 쪽으로 돌아앉는다.
      const walkFacing = seated ? approach : approach + Math.PI;
      facing.rotation.y =
        phases.sit > 0
          ? lerpAngle(lerpAngle(walkFacing, perchFacing, settle01), seatFacing, recline01)
          : dampAngle(facing.rotation.y, walkFacing, TURN_LAMBDA, delta);
      // 눕는 자리는 젖히는 토막에 몸을 뒤로 눕힌다. 발 원점을 축으로 머리가 베개 쪽으로 간다.
      if (lieRef.current) {
        lieRef.current.rotation.x = lying ? -(Math.PI / 2 - LIE_TILT) * recline01 : 0;
      }
      // 젖히는 동안 다리를 편다. 다 누우면 Idle을 눕힌 자세다.
      sitWeight = settle01 * (1 - recline01);
      positionRef.current.copy(group.position);
      // 침대에 올라가는 미끄러짐은 걸음이 아니다. 다리는 걷는 구간에서만 돈다.
      if (phases.sit === 0) {
        speed = step > 0 ? Math.min(1, traveled / (PLAYER_SPEED * step)) : 0;
        phaseRef.current += STEP_RATE * traveled;
      }
      // 다 일어서서 제자리로 돌아왔으면 좌석을 놓는다. 다음 걸음부터는 평소의 이동 경로다.
      if (!seated && phases.travel === 0 && phases.sit === 0) seatRef.current = null;
    }

    /*
     * 창가로 가서 커튼을 잡는 몸. 걸어가는 동안은 가는 쪽을 보고, 닿으면 벽을 보고 선다.
     * 닿은 것을 스토어에 알려야 커튼이 손을 따르기 시작한다.
     */
    if (grab && grabState) {
      grab.travel =
        grab.travelSeconds <= 0 ? 1 : Math.min(1, grab.travel + step / grab.travelSeconds);
      const eased = sitEase(grab.travel);
      const nextX = lerp(grab.standing.x, CURTAIN_STAND.x, eased);
      const nextZ = lerp(grab.standing.z, CURTAIN_STAND.z, eased);
      const traveled = Math.hypot(nextX - group.position.x, nextZ - group.position.z);
      group.position.x = nextX;
      group.position.z = nextZ;
      positionRef.current.copy(group.position);
      facing.rotation.y = dampAngle(
        facing.rotation.y,
        grab.travel < 1 ? grab.approach : CURTAIN_STAND.facing,
        TURN_LAMBDA,
        delta,
      );
      speed = step > 0 ? Math.min(1, traveled / (PLAYER_SPEED * step)) : 0;
      phaseRef.current += STEP_RATE * traveled;
      if (grab.travel >= 1) {
        advanceCurtainMotion(grab.motion, grabState.held, curtainPull[grabState.side], step);
        const pose = curtainPoseRef.current;
        pose.side = grabState.side;
        pose.time = grab.motion.time;
        pose.weight = grab.motion.weight;
        // Reaching the standing spot is not enough: the authored hand must rise first.
        if (grab.motion.ready && !grabState.arrived)
          useMemoryRoomStore.getState().arriveAtCurtain();
        if (grab.motion.done) {
          useMemoryRoomStore.getState().endCurtainGrab();
          grabRef.current = null;
        }
      }
    }

    if (!grabRef.current || grabRef.current.travel < 1) {
      const pose = curtainPoseRef.current;
      pose.weight = MathUtils.damp(pose.weight, 0, 10, step);
      if (pose.weight < 0.001) pose.weight = 0;
    }

    walkRef.current = MathUtils.damp(walkRef.current, speed, WALK_BLEND_LAMBDA, delta);
    updatePlayerRig(
      rig,
      phaseRef.current,
      walkRef.current,
      step,
      sitWeight,
      0,
      curtainPoseRef.current,
    );
  });

  return (
    <group ref={groupRef} name="player" position={PLAYER_START}>
      <group ref={facingRef}>
        <group ref={lieRef}>
          <primitive object={rig.root} dispose={null} />
        </group>
      </group>
    </group>
  );
}

/**
 * 플레이어. Suspense 경계를 제 안에 둔다 (FurnitureModel·BedModel과 같은 규약).
 *
 * 없으면 몸이나 커튼 모션 glb가 늦게 도착할 때 서스펜드가 **씬 전체로** 올라간다.
 * r3f의 Canvas가 자식을 통째로 감싸고 있어서, 그 순간 1인칭 리그까지 같이 내려가고
 * 리그의 정리 함수가 기본 카메라를 아이소메트릭으로 되돌린다. 로딩이 한 번 끊길
 * 때마다 시점이 튀어 보이는 것이 이것이다. 경계를 여기 두면 늦는 건 몸뿐이다.
 */
export function Player(props: PlayerProps) {
  return (
    <Suspense fallback={null}>
      <LoadedPlayer {...props} />
    </Suspense>
  );
}
