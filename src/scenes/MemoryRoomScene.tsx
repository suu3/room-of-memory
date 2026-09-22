"use client";

import { type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { type MutableRefObject, useCallback, useEffect, useMemo, useRef } from "react";
import {
  type AmbientLight,
  type DirectionalLight,
  type HemisphereLight,
  MathUtils,
  Object3D,
  Plane,
  type PointLight,
  Vector3,
} from "three";
import type { MemoryId } from "@/data/memory-room";
import { usePointerKind } from "@/i18n/control-hint";
import { useEffectEnabled } from "@/lib/effects/effect-budget";
import { selectCanvasPuzzle } from "@/minigames/active";
import {
  gamePhaseOf,
  MEMORY_TOTAL,
  selectActTwoProgress,
  selectCollectedCount,
  useMemoryRoomStore,
  type Viewpoint,
} from "@/store/memory-room";
import type { MovementAxes } from "@/types/movement";
import { BathroomShell } from "./memory-room/BathroomShell";
import { CameraRig } from "./memory-room/CameraRig";
import { CanvasMinigameHost } from "./memory-room/CanvasMinigameHost";
import { CursorTargetProjector } from "./memory-room/CursorTargetProjector";
import type { CurtainPull, CurtainSide } from "./memory-room/curtain-motion";
import { DustMotes } from "./memory-room/DustMotes";
import { EndingTrigger } from "./memory-room/EndingTrigger";
import { visibleHitsOnly } from "./memory-room/event-visibility";
import { FirstPersonRig } from "./memory-room/FirstPersonRig";
import type { LookAngles } from "./memory-room/first-person";
import { Lantern } from "./memory-room/Lantern";
import { LivingRoomFurniture } from "./memory-room/LivingRoomFurniture";
import { LivingRoomShell } from "./memory-room/LivingRoomShell";
import { MemoryBurst } from "./memory-room/MemoryBurst";
import { MemoryObjects } from "./memory-room/MemoryObjects";
import { MemoryGlowRoot } from "./memory-room/MemoryOutlineGlow";
import { ParentsRoomShell } from "./memory-room/ParentsRoomShell";
import { Player } from "./memory-room/Player";
import { type RoomPalette, resolveRoomPalette } from "./memory-room/palette";
import { RoomDecor } from "./memory-room/RoomDecor";
import { RoomFurniture } from "./memory-room/RoomFurniture";
import { RoomShell } from "./memory-room/RoomShell";
import { RoomSurroundings } from "./memory-room/RoomSurroundings";
import { SpaceDoor } from "./memory-room/SpaceDoor";
import { SPACES } from "./memory-room/spaces";
import { PlayerPositionProvider } from "./memory-room/use-near-player";
import {
  lampScaled,
  outsideDecay,
  ROOM_LIGHT_RAMP,
  roomLightLevel,
  roomLightMix,
  roomLightValue,
} from "./memory-room/visual-state";
import { WalkMarker } from "./memory-room/WalkMarker";
import { WindowLight } from "./memory-room/WindowLight";

/** 바닥 평면(y=0). 클릭한 곳이 상판이든 벽이든, 광선이 이 평면과 만나는 자리로 걸어간다. */
const FLOOR_PLANE = new Plane(new Vector3(0, 1, 0), 0);
const floorHit = new Vector3();

/*
 * 창으로 드는 볕의 방향. 창(뒷벽 x≈1.15, z=-3.88) 바깥 위에서 방 안쪽 왼편:
 * 책상(x -5.4~-3.8)과 그 앞 바닥: 을 향한다. 뒷벽 조각이 그림자를 드리우므로
 * 볕은 창 개구부 모양으로만 들어오고, 위쪽 창을 지난 빛이 책상 상판에, 아래쪽 창을
 * 지난 빛이 캐비닛 왼편 바닥에 닿는다. 실제 창의 경로다. 허공의 광선이 아니라
 * 표면에 닿는 빛과 그림자의 대비가 우선이다 (DESIGN.md > Lighting).
 */
const SUN_POSITION: [number, number, number] = [7.15, 6.5, -7.2];
const SUN_TARGET: [number, number, number] = [-4.35, 0.5, -0.4];
/** 그림자 카메라의 반폭. 방 전체(x -6~8, z -4~6.5)가 비스듬한 축에서도 다 들어와야 한다. 밖으로 나간 자리는 그림자 없이 볕을 받아 엉뚱한 구석이 밝아진다. */
const SUN_SHADOW_EXTENT = 15;
/** 커튼이 닫혀 있을 때 남는 볕의 몫. 얇은 천이라 다 막지는 못하고 흐려질 뿐이다. */
const CURTAIN_SUN_FACTOR = 0.6;
/** 창가 point light의 닿는 거리. 되찾을수록 볕의 범위가 넓어진다. */
const WINDOW_GLOW_REACH: readonly [number, number] = [5, 9];
/** 조명이 목표값을 따라가는 속도: 1.5~3초 안에 자리 잡는다. */
const LIGHT_LAMBDA = 2.2;

function StageLighting({
  cool,
  warm,
  lightsOn,
  blackout,
  curtainsOpen,
  sunlit,
  palette,
}: {
  /** 차가운 간접광의 양 (0~1). 1막에 깎이고 2막에도 낮게 남는다. */
  cool: number;
  /** 창으로 드는 볕의 양 (0~1). 2막 회복도를 따른다. */
  warm: number;
  /** 벽의 전등 스위치. 꺼도 창으로 드는 빛은 남는다. */
  lightsOn: boolean;
  /** 인트로의 어둠: 소등보다 훨씬 깊다 (visual-state의 BLACKOUT_FACTOR). */
  blackout: boolean;
  /** 커튼이 열렸는가: 닫히면 볕이 흐려진다. */
  curtainsOpen: boolean;
  /** 지금 공간에 창이 있는가. 볕은 창이 있는 방의 것이다 (SPACES의 hasWindow). */
  sunlit: boolean;
  palette: RoomPalette;
}) {
  const ambientRef = useRef<AmbientLight>(null);
  const hemisphereRef = useRef<HemisphereLight>(null);
  const keyRef = useRef<DirectionalLight>(null);
  const lampRef = useRef<PointLight>(null);
  const windowGlowRef = useRef<PointLight>(null);
  const sunRef = useRef<DirectionalLight>(null);
  const sunTarget = useMemo(() => {
    const target = new Object3D();
    target.position.set(...SUN_TARGET);
    return target;
  }, []);
  const initial = useRef({ cool, warm }).current;

  const sunGoal =
    roomLightValue(ROOM_LIGHT_RAMP.sun, warm) *
    (curtainsOpen ? 1 : CURTAIN_SUN_FACTOR) *
    (sunlit ? 1 : 0);

  useFrame((_, delta) => {
    const ambient = ambientRef.current;
    const hemisphere = hemisphereRef.current;
    const key = keyRef.current;
    const lamp = lampRef.current;
    const windowGlow = windowGlowRef.current;
    const sun = sunRef.current;
    if (!ambient || !hemisphere || !key || !lamp || !windowGlow || !sun) return;

    const follow = (current: number, goal: number) =>
      MathUtils.damp(current, goal, LIGHT_LAMBDA, delta);

    // 방 안의 빛(간접광·전등)만 스위치를 탄다. 창으로 드는 볕은 스위치와 무관하다
    ambient.intensity = follow(
      ambient.intensity,
      lampScaled(roomLightValue(ROOM_LIGHT_RAMP.ambient, cool), lightsOn, blackout),
    );
    hemisphere.intensity = follow(
      hemisphere.intensity,
      lampScaled(roomLightValue(ROOM_LIGHT_RAMP.hemisphere, cool), lightsOn, blackout),
    );
    key.intensity = follow(
      key.intensity,
      lampScaled(roomLightValue(ROOM_LIGHT_RAMP.key, cool), lightsOn, blackout),
    );
    lamp.intensity = follow(
      lamp.intensity,
      lampScaled(roomLightValue(ROOM_LIGHT_RAMP.lamp, cool), lightsOn, blackout),
    );
    windowGlow.intensity = follow(
      windowGlow.intensity,
      roomLightValue(ROOM_LIGHT_RAMP.windowGlow, warm),
    );
    windowGlow.distance = follow(windowGlow.distance, roomLightValue(WINDOW_GLOW_REACH, warm));
    sun.intensity = follow(sun.intensity, sunGoal);
    // 세기가 0인 볕은 그림자 패스도 돌리지 않는다
    sun.visible = sun.intensity > 0.01;
  });

  return (
    <>
      <ambientLight
        ref={ambientRef}
        color={palette.daylight}
        intensity={roomLightValue(ROOM_LIGHT_RAMP.ambient, initial.cool)}
      />
      <hemisphereLight
        ref={hemisphereRef}
        color={palette.daylight}
        groundColor={palette.deep}
        intensity={roomLightValue(ROOM_LIGHT_RAMP.hemisphere, initial.cool)}
      />
      {/* 차가운 키: 커튼 너머의 낮. 앞 위에서 내려와 윤곽을 세운다 */}
      <directionalLight
        ref={keyRef}
        position={[3, 8, 5]}
        color={palette.daylight}
        intensity={roomLightValue(ROOM_LIGHT_RAMP.key, initial.cool)}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      {/* 천장 전등: 스위치가 끄는 빛의 본체 */}
      <pointLight
        ref={lampRef}
        position={[0, 4.2, 0.8]}
        color={palette.linen}
        intensity={roomLightValue(ROOM_LIGHT_RAMP.lamp, initial.cool)}
        distance={13}
        decay={2}
      />
      {/* 창가에 고이는 볕: 커튼을 통과한 산광. 되찾을수록 멀리까지 닿는다 */}
      <pointLight
        ref={windowGlowRef}
        position={[1.2, 3.1, -3.2]}
        color={palette.sun}
        intensity={roomLightValue(ROOM_LIGHT_RAMP.windowGlow, initial.warm)}
        distance={roomLightValue(WINDOW_GLOW_REACH, initial.warm)}
        decay={2}
      />
      {/*
        창으로 드는 볕. 이 씬의 두 번째이자 마지막 그림자 광원이다. 뒷벽이 창 모양으로
        가리고, 책상·의자·몸이 그 빛 안에서 그림자를 드리운다.
      */}
      <directionalLight
        ref={sunRef}
        position={SUN_POSITION}
        target={sunTarget}
        color={palette.sun}
        intensity={0}
        visible={false}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-SUN_SHADOW_EXTENT}
        shadow-camera-right={SUN_SHADOW_EXTENT}
        shadow-camera-top={SUN_SHADOW_EXTENT}
        shadow-camera-bottom={-SUN_SHADOW_EXTENT}
        shadow-camera-near={0.5}
        shadow-camera-far={30}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
      />
      <primitive object={sunTarget} />
    </>
  );
}

export function MemoryRoomScene({
  playerPositionRef,
  movementInputRef,
  focusMemoryId,
  nearbyMemoryId,
  curtainsOpen,
  curtainPull,
  onCurtainPull,
  onCurtainRelease,
  roomZoom,
  zoomScale,
  orbitAzimuth,
  following,
  viewpoint,
  lookRef,
  onInteract,
}: {
  playerPositionRef: MutableRefObject<Vector3>;
  movementInputRef: MutableRefObject<MovementAxes>;
  focusMemoryId: MemoryId | null;
  nearbyMemoryId: MemoryId | null;
  curtainsOpen: boolean;
  curtainPull: CurtainPull;
  onCurtainPull: (side: CurtainSide, progress: number) => void;
  onCurtainRelease: (
    side: CurtainSide,
    progress: number,
    tapped: boolean,
    velocity: number,
  ) => void;
  roomZoom: number;
  /** 사용자가 휠·핀치로 정한 배율 (1 = 기본). 축소할수록 카메라가 방 가운데로 물러난다. */
  zoomScale: number;
  orbitAzimuth: number;
  /** 게임이 시작됐는가: 타이틀 구도(방 모형 전체)와 플레이 구도(플레이어 추적)를 가른다. */
  following: boolean;
  /**
   * 카메라가 1인칭에 있는 구간 (인트로·2막 도입). null이면 아이소메트릭이다.
   * 1인칭 동안은 FirstPersonRig가 기본 카메라를 쥐고 CameraRig는 잠든다.
   */
  viewpoint: Viewpoint;
  /** 1인칭의 시선. RoomCanvas가 DOM 입력으로 채우고 FirstPersonRig가 읽는다. */
  lookRef: MutableRefObject<LookAngles>;
  onInteract: (id: MemoryId) => void;
}) {
  const palette = useMemo(resolveRoomPalette, []);
  /** 오클루전의 색은 방의 가장 깊은 어둠(void)이다. 검정을 곱하면 재질이 죽는다 */
  const ambientOcclusion = useMemo(() => ({ color: palette.void }), [palette]);
  const doorOpened = useMemoryRoomStore((state) => state.doorOpened);
  const space = useMemoryRoomStore((state) => state.space);
  const inRoom = space === "room";
  const inLivingRoom = space === "living";
  const endingStarted = useMemoryRoomStore((state) => state.endingStarted);
  const gamePhase = useMemoryRoomStore(gamePhaseOf);
  const collectedCount = useMemoryRoomStore(selectCollectedCount);
  const recovery = useMemoryRoomStore(selectActTwoProgress);
  const lightsOn = useMemoryRoomStore((state) => state.lightsOn);
  /** 씬 안에서 도는 미궁 문제(거실 피아노). 그동안 카메라는 그쪽이 쥔다 */
  const canvasPuzzle = useMemoryRoomStore(selectCanvasPuzzle);
  const walkTo = useMemoryRoomStore((state) => state.walkTo);
  /*
   * 숨긴 공간은 클릭도 받지 않는다 (event-visibility). 방은 카메라와 거실 사이에 있어서,
   * 이 필터가 없으면 거실 바닥을 눌러도 숨은 방의 야구공이 먼저 눌린다.
   */
  const setEvents = useThree((state) => state.setEvents);
  useEffect(() => {
    setEvents({ filter: visibleHitsOnly });
    return () => setEvents({ filter: undefined });
  }, [setEvents]);
  /*
   * 바닥을 누르면 걸어간다. 만질 수 있는 것(기억·의자·커튼·문·스위치)은 저마다 클릭을
   * 멈추므로(stopPropagation) 여기까지 오는 클릭은 "그냥 어딘가를 눌렀다"다. 카메라를
   * 끄는 드래그는 RoomCanvas가 뒤따르는 click을 삼켜서 여기 오지 않는다.
   */
  const handleFloorClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      if (!event.ray.intersectPlane(FLOOR_PLANE, floorHit)) return;
      walkTo(floorHit.x, floorHit.z);
    },
    [walkTo],
  );
  const mix = roomLightMix({
    collected: collectedCount,
    memoryTotal: MEMORY_TOTAL,
    recovery,
  });
  /*
   * 밝기는 진행도가 정하고 공간이 정하지 않는다. 다만 방이 아닌 공간은 한 단계 낮게
   * 출발한다 (docs/content-design.md 5장, SPACES의 lightOffset). 여기서 한 번만 깎아
   * 두면 조명·창빛·먼지가 전부 같은 값을 본다. 볕(warm)은 방의 창에서 오므로 창이
   * 없는 공간에서는 꺼진다.
   */
  /** 커튼이 젖혀진 몫 (0~1). 양쪽 평균: 한쪽만 젖히면 빛도 반만 든다. */
  const curtainOpenAmount = (curtainPull.left + curtainPull.right) / 2;
  const cool = Math.max(0, mix.cool - SPACES[space].lightOffset);
  const warm = mix.warm;
  /*
   * 어둠의 양: 비네트(MemoryRoom)와 같은 축이다. 진행도가 정한 밝기에 전등 스위치를
   * 곱한 값의 나머지라, 비네트가 조여드는 만큼 가장자리의 색수차도 어긋난다.
   */
  /** 인트로의 어둠. 소등이 아니라 "아직 불을 켜기 전"이라 스위치를 찾는 동안만이다. */
  const blackout = viewpoint === "intro";
  const level = roomLightLevel({ collected: collectedCount, memoryTotal: MEMORY_TOTAL, recovery });
  const dim = 1 - lampScaled(level, lightsOn, blackout);
  /*
   * 등 (docs/visual-experiments.md 6장): 1막 후반 손 가까이만 비추는 점광원. 싼 효과라
   * 폰에서도 켜지되, 커서가 없는 기기에서는 몸을 따라간다. 1인칭 구간에서는 빼는데,
   * 그 구간은 빛 하나(스위치·문)만 보여야 하기 때문이다.
   */
  const lanternEnabled = useEffectEnabled("cheap") && viewpoint === null && lightsOn;
  const followCursor = usePointerKind() !== "touch";

  return (
    // 커튼·전등 스위치처럼 표식 없이 근접으로만 켜지는 것들이 플레이어 위치를 본다
    <PlayerPositionProvider value={playerPositionRef}>
      <StageLighting
        cool={cool}
        warm={warm}
        lightsOn={lightsOn}
        blackout={blackout}
        curtainsOpen={curtainsOpen}
        sunlit={SPACES[space].hasWindow}
        palette={palette}
      />
      {/*
        방의 몸통은 통째로 글로우 루트 안에 둔다.

        예전에는 "만질 수 있는 것"만 넣었는데, 전등 스위치가 벽에 붙은 물건이라
        RoomShell(=루트 밖)에 있었고: MemoryGlowSelection이 컨텍스트를 못 찾아
        조용히 아무것도 안 했다. 스위치만 혼자 빛나지 않던 이유다.

        루트 안에 있다고 빛나는 게 아니라 MemoryGlowSelection이 enabled일 때만
        빛나므로, 범위를 넓혀도 장식·벽은 그대로 잠잠하다. EffectComposer는
        화면 전체를 한 번 훑는 패스라 트리에서의 위치도 그림에 영향이 없다.
      */}
      <MemoryGlowRoot color={palette.memory} dim={dim} ambientOcclusion={ambientOcclusion}>
        {/*
          한 번에 한 방만 보인다 (v2). 두 방을 나란히 세워두면 디오라마가 아니라
          단면도가 된다. 지금 서 있는 공간만 서 있고, 문턱을 넘는 순간 바뀐다.
          숨긴 방의 인터랙션은 근접 판정이 어차피 막는다 (다가갈 수 없는 거리다).
        */}
        {/* biome-ignore lint/a11y/noStaticElementInteractions: R3F group은 DOM이 아니라 Canvas 안의 포인터 대상이다. */}
        <group name="walkable" onClick={handleFloorClick}>
          <group visible={inRoom}>
            <RoomShell
              palette={palette}
              doorOpen={doorOpened}
              outsideDecay={outsideDecay({
                collected: collectedCount,
                memoryTotal: MEMORY_TOTAL,
                phase: gamePhase,
              })}
            />
            {/* 벽에 붙은 것들: 포스터·페넌트·선반 소품. 만질 수 없어 빛나지 않는다 */}
            <RoomDecor palette={palette} />
            <RoomFurniture
              palette={palette}
              curtainPull={curtainPull}
              onCurtainPull={onCurtainPull}
              onCurtainRelease={onCurtainRelease}
            />
            <MemoryObjects
              space="room"
              palette={palette}
              nearbyMemoryId={nearbyMemoryId}
              onInteract={onInteract}
            />
          </group>
          {/*
            방문 너머: 2막에 문이 열리면 걸어 나갈 수 있다.
            문 넘기(1인칭)를 하는 동안은 방에 선 채로도 거실이 선다. 열린 문 너머가
            허공이면 "문 쪽이 밝아"가 거짓말이 된다. 문턱을 넘는 순간 그 구간이 끝나고
            평소의 "한 번에 한 방"으로 돌아온다.
          */}
          <group visible={inLivingRoom || (inRoom && viewpoint === "doorway")}>
            <LivingRoomShell palette={palette} inLivingRoom={inLivingRoom} />
            <LivingRoomFurniture palette={palette} />
            <MemoryObjects
              space="living"
              palette={palette}
              nearbyMemoryId={nearbyMemoryId}
              onInteract={onInteract}
            />
            {/* 현관 옆 배트: 앰플을 쥐면 켜지는 3막 트리거 */}
            <EndingTrigger palette={palette} />
          </group>
          {/* 거실 너머의 공간들 (v3). 문은 두 껍데기 밖, 양쪽 어디서든 보이게 */}
          <group visible={space === "bathroom"}>
            <BathroomShell palette={palette} />
          </group>
          <group visible={space === "parents"}>
            <ParentsRoomShell palette={palette} />
          </group>
          <group visible={inLivingRoom || space === "bathroom"}>
            <SpaceDoor id="living-bathroom" palette={palette} />
          </group>
          <group visible={inLivingRoom || space === "parents"}>
            <SpaceDoor id="living-parents" palette={palette} />
          </group>
          {/*
            canvas 모드 미니게임(냉장고 아래칸의 앰플 집기)은 두 공간 그룹 밖에 선다.
            판은 그 물건 앞에 서 있을 때만 도니까 공간은 저절로 맞고, 글로우 루트 안이라
            집을 수 있는 물건이 기억처럼 빛난다.
          */}
          <CanvasMinigameHost />
        </group>
      </MemoryGlowRoot>
      {/*
        방 바깥: 받침 아래 고인 빛과 둘레를 떠도는 티끌.
        글로우 루트 밖이다: 만질 수 있는 것이 아니라 배경이라 아웃라인이 붙으면 안 된다.
      */}
      <RoomSurroundings palette={palette} />
      {/* 창빛·먼지는 방의 것이다. 방 밖에 있는 동안은 방과 함께 숨는다 */}
      <group visible={inRoom}>
        {/* 글로우 루트 밖: 빛·먼지는 아웃라인 선택 대상이 아니다 */}
        <WindowLight
          color={palette.sun}
          intensity={roomLightValue(ROOM_LIGHT_RAMP.windowLight, warm)}
          open={curtainOpenAmount}
        />
        {/* 먼지는 빛줄기 안의 반짝임이라 커튼이 젖혀진 만큼만 보인다. 어두울수록 손이 지나간 자리가 천천히 다시 쌓인다 */}
        <DustMotes
          color={palette.sun}
          opacity={roomLightValue(ROOM_LIGHT_RAMP.dust, warm) * curtainOpenAmount}
          settle={level}
        />
      </group>
      {/* 손 가까이의 등. 글로우 루트 밖: 빛이지 물건이 아니다. 공간을 가리지 않고 몸을 따라간다 */}
      {lanternEnabled && (
        <Lantern level={level} color={palette.linen} followCursor={followCursor} />
      )}
      {/* 바닥 클릭의 목적지 링. 글로우 루트 밖: 만질 수 있는 것이 아니라 표식이다 */}
      <WalkMarker color={palette.memory} />
      {/* 기억을 되찾는 순간 물건에서 솟는 티끌. 글로우 루트 밖: 빛이지 물건이 아니다 */}
      <MemoryBurst color={palette.memory} />
      <Player
        positionRef={playerPositionRef}
        movementInputRef={movementInputRef}
        curtainPull={curtainPull}
      />
      {/* 배트를 쥐면 카메라도 문 쪽으로 붙는다. 엔딩 영상의 첫 컷과 이어지는 구도 */}
      {/* 커서가 얹힌 오브젝트의 화면 자리. 캔버스 밖 커서가 그리로 빨려든다 */}
      <CursorTargetProjector />
      <CameraRig
        focusId={endingStarted ? "ending" : focusMemoryId}
        roomZoom={roomZoom}
        zoomScale={zoomScale}
        orbitAzimuth={orbitAzimuth}
        following={following}
        /*
         * 기본 카메라를 남이 쥐고 있는 구간: 1인칭(FirstPersonRig)과 건반 앞에
         * 붙박이로 서는 canvas 문제(피아노). 그동안 이 리그는 잠든다. 안 그러면
         * 두 카메라가 같은 프레임에서 서로를 밀어 화면이 떨린다.
         */
        firstPerson={viewpoint !== null || canvasPuzzle !== null}
        playerPositionRef={playerPositionRef}
      />
      {/* 1인칭 카메라. 마운트되면 기본 카메라를 쥐고, 내려오면 돌려놓는다 */}
      {viewpoint !== null && (
        <FirstPersonRig
          viewpoint={viewpoint}
          playerPositionRef={playerPositionRef}
          lookRef={lookRef}
        />
      )}
    </PlayerPositionProvider>
  );
}
