"use client";

import { PerformanceMonitor } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import {
  Component,
  type ErrorInfo,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { LookButtons } from "@/components/ui/hud/LookButtons";
import { MovementJoystick } from "@/components/ui/hud/MovementJoystick";
import {
  RoomInteractionPrompt,
  type RoomPromptAction,
} from "@/components/ui/hud/RoomInteractionPrompt";
import {
  listedDoorways,
  listedMemories,
  listedProps,
  memoryStatuses,
  type PromptPropId,
} from "@/components/ui/hud/room-prompt-list";
import { CanvasMinigameSkip } from "@/components/ui/minigame/MinigameHost";
import { MEMORY_IDS, type MemoryId } from "@/data/memory-room";
import { useControlHint, usePointerKind } from "@/i18n/control-hint";
import { playSound } from "@/lib/audio";
import {
  pressBat,
  pressDoor,
  pressFrontDoor,
  pressLightSwitch,
  pressNightstandDrawer,
  pressPiano,
  pressPianoSheet,
  pressSinkPlug,
} from "@/lib/room-press";
import { MemoryRoomScene } from "@/scenes/MemoryRoomScene";
import type { LookAngles } from "@/scenes/memory-room/camera/first-person";
import { PLAYER_START } from "@/scenes/memory-room/player/Player";
import {
  CURTAIN_CLOSED,
  type CurtainPull,
  type CurtainSide,
  isCurtainOpen,
  releaseProgress,
} from "@/scenes/memory-room/rooms/room/curtain-motion";
import { CAMERA_PRESETS, MEMORY_PLACEMENTS } from "@/scenes/memory-room/world/layout";
import { reachableSpaces, SPACES } from "@/scenes/memory-room/world/spaces";
import { findNearestMemory } from "@/scenes/memory-room/world/spatial";
import { useEffectsStore } from "@/store/effects";
import {
  doorwayReady,
  hotspotStatus,
  openDoorwayIds,
  selectActiveInteraction,
  selectDoorReady,
  selectSceneInputLocked,
  selectViewpoint,
  useMemoryRoomStore,
  viewpointOf,
} from "@/store/memory-room";
import type { MovementAxes } from "@/types/movement";
import { ResizeRepaint } from "./ResizeRepaint";
import { RoomLoadReporter } from "./RoomLoadReporter";
import {
  canInitializeWebGL,
  contextLossResponse,
  dispatchMemoryInteraction,
  handleRoomInteractionKeyDown,
  handleRoomOrbitKeyDown,
  handleRoomZoomKeyDown,
  isInteractiveTarget,
  ORBIT_DRAG_THRESHOLD,
  roomOrbitFromDrag,
  roomOverviewZoomForViewport,
  roomZoomForViewport,
  roomZoomScaleFromPinch,
  roomZoomScaleFromWheel,
} from "./room-canvas-runtime";
import { useFirstPersonLook } from "./use-first-person-look";
import { VisibleHitsOnly } from "./VisibleHitsOnly";

const PROXIMITY_POLL_MS = 100;
const DIRECT_FOCUS_MS = 900;
/**
 * 화면 배율의 상한. 프레임이 떨어지는 기기에서는 1로 내린다 (PerformanceMonitor).
 * 아래 1은 그대로다: 그 밑으로 내리면 글씨보다 먼저 아웃라인이 깨진다.
 */
const DPR_CAP = { high: 1.5, low: 1 } as const;
/*
 * drei의 SoftShadows(PCSS)는 쓰지 않는다. three r185에서 사라진 unpackRGBAToDepth를
 * 셰이더에 심어 그림자를 받는 재질 전부가 컴파일에 실패한다. 방이 통째로 검게 나왔다
 * (2026-09-16). 부드러운 그림자가 필요하면 three 자체의 VSM 그림자 맵으로 간다.
 */
const MEMORY_TARGETS = Object.values(MEMORY_PLACEMENTS);

/** 화면 밖 목록의 물건이 누르는 것: 씬의 3D 물건과 같은 길이다 (room-press.ts). */
const PROP_PRESS = {
  "sink-plug": pressSinkPlug,
  "nightstand-drawer": pressNightstandDrawer,
  "piano-sheet": pressPianoSheet,
  piano: pressPiano,
  bat: pressBat,
  "front-door": pressFrontDoor,
} as const satisfies Record<PromptPropId, () => void>;

interface CanvasErrorBoundaryProps {
  children: ReactNode;
  fallbackText: string;
}

interface CanvasErrorBoundaryState {
  hasError: boolean;
}

function WebGLFallback({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 grid place-items-center px-4 text-center text-xs text-fog">
      {children}
    </div>
  );
}

class CanvasErrorBoundary extends Component<CanvasErrorBoundaryProps, CanvasErrorBoundaryState> {
  state: CanvasErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): CanvasErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unable to render the memory room Canvas.", error, info);
  }

  render() {
    if (this.state.hasError) {
      return <WebGLFallback>{this.props.fallbackText}</WebGLFallback>;
    }

    return this.props.children;
  }
}

export function RoomCanvas() {
  const { t } = useTranslation();
  const { t: tRoom } = useTranslation("memoryRoom");
  // 키 안내는 기기를 따라간다. 폰에는 누를 E도 WASD도 없다.
  const hint = useControlHint();
  // 조이스틱은 손가락용이다. 마우스는 바닥을 눌러 걷고, 키보드는 그대로 남는다.
  const pointerKind = usePointerKind();
  const playerPositionRef = useRef(PLAYER_START.clone());
  const movementInputRef = useRef<MovementAxes>({ horizontal: 0, vertical: 0 });
  const nearbyMemoryIdRef = useRef<MemoryId | null>(null);
  const directFocusTimer = useRef<number | null>(null);
  const canvasElementRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hadActiveInteraction = useRef(false);
  const zoomScaleRef = useRef(1);
  const orbitRef = useRef(0);
  /** 1인칭의 시선. 끌기·키가 쓰고 FirstPersonRig가 프레임마다 읽는다. */
  const lookRef = useRef<LookAngles>({ yaw: 0, pitch: 0 });
  const [webGLFailed, setWebGLFailed] = useState(() => !canInitializeWebGL());
  /**
   * 캔버스의 세대. 컨텍스트를 잃으면 하나 올려 <Canvas>를 (오류 경계째) 다시 세운다.
   * 카메라·커튼·플레이어 자리는 이 컴포넌트의 상태와 ref에 있어 그대로 남는다.
   */
  const [canvasEpoch, setCanvasEpoch] = useState(0);
  const contextLossesRef = useRef(0);
  const [nearbyMemoryId, setNearbyMemoryId] = useState<MemoryId | null>(null);
  const [focusMemoryId, setFocusMemoryId] = useState<MemoryId | null>(null);
  /** 타이틀 구도(디오라마 전체)와 플레이 구도(플레이어 추적) 두 가지. */
  const [zoomByFraming, setZoomByFraming] = useState({ overview: 64, play: 96 });
  const [zoomScale, setZoomScale] = useState(1);
  const [orbitAzimuth, setOrbitAzimuth] = useState(0);
  /** 커튼은 쪽마다 따로 젖혀진다. 리셋하면 리비전이 어긋나 자동으로 닫힌 상태가 된다. */
  const [curtainState, setCurtainState] = useState<{ revision: number; pull: CurtainPull } | null>(
    null,
  );
  const activeInteraction = useMemoryRoomStore(selectActiveInteraction);
  const inputLocked = useMemoryRoomStore(selectSceneInputLocked);
  /** 시작 전에는 방 모형 전체를 보여주고, 시작하면 그 안으로 내려앉는다. */
  const started = useMemoryRoomStore((state) => state.started);
  const sceneCovered = useMemoryRoomStore((state) => state.sceneCovered);
  const roomZoom = started ? zoomByFraming.play : zoomByFraming.overview;
  /** 1인칭 구간(인트로·2막 도입). 그동안 회전·배율 입력은 잠기고 시선 입력이 대신 선다. */
  const viewpoint = useMemoryRoomStore(selectViewpoint);
  const firstPerson = viewpoint !== null;
  /** 둘러볼 수 있는 1인칭인가. 엔딩의 문턱(exit)은 카메라가 정해진 길을 걸어 시선을 쥐지 않는다. */
  const lookEnabled = firstPerson && viewpoint !== "exit";
  /*
   * 성능 안전장치. 프레임이 목표(주사율) 아래로 떨어지면 배율 상한을 내린다. **한 번 내리면
   * 돌려놓지 않는다.** 배율이 바뀌면 r3f가 캔버스 버퍼를 다시 잡아 한 프레임이 비는데(캔버스
   * 뒤의 어둠이 비쳐 검게 깜빡인다), 예전처럼 회복되면 올리고 떨어지면 내리기를 반복하면
   * 경계에 걸린 폰에서 그 깜빡임이 몇 초마다 났다. 게다가 drei의 flipflops는 오르는 쪽도
   * 세어서, 60fps로 멀쩡히 도는 폰이 10초 만에 폴백으로 떨어져 배율을 잃었다.
   * 배열을 새로 만들면 r3f가 렌더마다 배율을 다시 잡으므로 묶어 둔다.
   */
  const [dprCap, setDprCap] = useState<number>(DPR_CAP.high);
  const dpr = useMemo<[number, number]>(() => [1, dprCap], [dprCap]);
  // 효과 예산(effect-budget)도 같은 판정을 본다. 배율이 내려간 기기에서는 무거운 효과가 빠진다
  const setDegraded = useEffectsStore((state) => state.setDegraded);
  const degrade = useCallback(() => {
    setDprCap(DPR_CAP.low);
    setDegraded(true);
  }, [setDegraded]);

  /*
   * Canvas의 camera 프롭은 마운트 때 한 번만 쓴다. 여기에 살아 있는 zoom을 물리면
   * r3f가 프롭이 바뀔 때마다 camera.zoom을 즉시 덮어써서, CameraRig의 damp가
   * 시작하기도 전에 목표값에 도달해 버린다 (타이틀→플레이 줌인이 통째로 사라졌다).
   * 이후 zoom은 CameraRig 혼자 굴린다.
   */
  const initialCamera = useMemo(
    () => ({
      position: [...CAMERA_PRESETS.room.position] as [number, number, number],
      zoom: roomOverviewZoomForViewport(window.innerWidth, window.innerHeight),
      near: 0.1,
      far: 60,
    }),
    [],
  );
  const collected = useMemoryRoomStore((state) => state.collected);
  const revisited = useMemoryRoomStore((state) => state.revisited);
  // 2바퀴 재조사가 문 뒤에 있어서(hotspotStatus), 문이 열리는 순간 표식이 재점등된다
  const doorOpened = useMemoryRoomStore((state) => state.doorOpened);
  // 문제집을 보기 전에는 강도 1도 잠겨 있다 (onboardingStep). 스크린리더 이름도 그걸 따른다
  const discoveries = useMemoryRoomStore((state) => state.discoveries);
  const rechecked = useMemoryRoomStore((state) => state.rechecked);
  const introDone = useMemoryRoomStore((state) => state.introDone);
  const sinkDrained = useMemoryRoomStore((state) => state.sinkDrained);
  const batTaken = useMemoryRoomStore((state) => state.batTaken);
  const endingStarted = useMemoryRoomStore((state) => state.endingStarted);
  const solvedPuzzles = useMemoryRoomStore((state) => state.solvedPuzzles);
  const openedDoorways = useMemoryRoomStore((state) => state.openedDoorways);
  const inventory = useMemoryRoomStore((state) => state.inventory);
  const roomDoorReady = useMemoryRoomStore(selectDoorReady);
  const beginInteraction = useMemoryRoomStore((state) => state.beginInteraction);
  const resetRevision = useMemoryRoomStore((state) => state.resetRevision);
  const curtainPull = curtainState?.revision === resetRevision ? curtainState.pull : CURTAIN_CLOSED;
  const curtainsOpen = isCurtainOpen(curtainPull);

  const setPull = useCallback(
    (next: (current: CurtainPull) => CurtainPull) => {
      setCurtainState((state) => ({
        revision: resetRevision,
        pull: next(state?.revision === resetRevision ? state.pull : CURTAIN_CLOSED),
      }));
    },
    [resetRevision],
  );

  const handleCurtainPull = useCallback(
    (side: CurtainSide, progress: number) => setPull((pull) => ({ ...pull, [side]: progress })),
    [setPull],
  );

  const handleCurtainRelease = useCallback(
    // 진행도는 커튼이 준다. 몸이 창가에 닿기를 기다렸다가 끌기와 놓기가 같은 프레임에
    // 흘러들 수 있어서, 여기 상태를 읽으면 끌기 전 값을 본다.
    (side: CurtainSide, progress: number, tapped: boolean, velocity: number) => {
      // 손이 가던 속도까지 본다: 세게 튕기면 반쯤에서 놓아도 끝까지 간다 (관성)
      const settled = releaseProgress(progress, tapped, velocity);
      // 커튼이 실제로 자리를 옮길 때만 소리를 낸다. 끌다 말고 도로 붙는 건 아무 일도 아니다
      if (settled !== progress) playSound("wipe");
      setPull((pull) => ({ ...pull, [side]: settled }));
    },
    [setPull],
  );

  /** 키보드·프롬프트 버튼 경로: 드래그를 못 하는 사용자를 위해 양쪽을 한 번에 젖힌다. */
  const openBothCurtains = useCallback(() => setPull(() => ({ left: 1, right: 1 })), [setPull]);

  /** 컨텍스트를 아예 못 만든다: 이건 정말 기기 탓이다. */
  const handleWebGLFailure = useCallback((event: Event) => {
    if (event.cancelable) event.preventDefault();
    setWebGLFailed(true);
  }, []);

  /*
   * 컨텍스트를 잃었다. 폴백이 아니라 캔버스를 다시 세운다 (contextLossResponse 주석).
   * preventDefault는 브라우저에 "복구해도 된다"고 알리는 표준 절차라 그대로 둔다.
   * 다시 세워지며 버려지는 옛 캔버스의 손실(r3f가 언마운트 0.5초 뒤 강제로 잃게 한다)은
   * ref가 이미 떼어져 여기 닿지 않지만, 혹시 닿아도 지금 캔버스가 아니면 무시한다.
   */
  const handleContextLost = useCallback((event: Event) => {
    if (event.cancelable) event.preventDefault();
    if (event.target !== canvasElementRef.current) return;
    contextLossesRef.current += 1;
    if (contextLossResponse(contextLossesRef.current) === "fail") setWebGLFailed(true);
    else setCanvasEpoch((epoch) => epoch + 1);
  }, []);

  const attachCanvasRef = useCallback(
    (canvas: HTMLCanvasElement | null) => {
      const previousCanvas = canvasElementRef.current;
      if (previousCanvas === canvas) return;
      if (previousCanvas) {
        previousCanvas.removeEventListener("webglcontextcreationerror", handleWebGLFailure);
        previousCanvas.removeEventListener("webglcontextlost", handleContextLost);
      }

      canvasElementRef.current = canvas;
      if (canvas) {
        canvas.addEventListener("webglcontextcreationerror", handleWebGLFailure);
        canvas.addEventListener("webglcontextlost", handleContextLost);
      }
    },
    [handleWebGLFailure, handleContextLost],
  );

  const labels = useMemo<Record<MemoryId, string>>(
    () => ({
      console: tRoom("memories.console.name"),
      window: tRoom("memories.window.name"),
      frame: tRoom("memories.frame.name"),
      computer: tRoom("memories.computer.name"),
      radio: tRoom("memories.radio.name"),
      phone: tRoom("memories.phone.name"),
      calendar: tRoom("memories.calendar.name"),
      ball: tRoom("memories.ball.name"),
      fridge: tRoom("memories.fridge.name"),
      duffel: tRoom("memories.duffel.name"),
      shoes: tRoom("memories.shoes.name"),
      cards: tRoom("memories.cards.name"),
      ampoule: tRoom("memories.ampoule.name"),
      "report-card": tRoom("memories.report-card.name"),
      "research-note": tRoom("memories.research-note.name"),
      "id-card": tRoom("memories.id-card.name"),
    }),
    [tRoom],
  );

  // 3D 물건이 보는 것과 같은 진행을 본다. 한 칸이라도 빠지면 목록만 앞 페이즈에 머문다 (PromptProgress)
  const progress = useMemo(
    () => ({
      collected,
      revisited,
      rechecked,
      doorOpened,
      openedDoorways,
      discoveries,
      introDone,
      sinkDrained,
      batTaken,
      endingStarted,
      solvedPuzzles,
      inventory,
    }),
    [
      collected,
      revisited,
      rechecked,
      doorOpened,
      openedDoorways,
      discoveries,
      introDone,
      sinkDrained,
      batTaken,
      endingStarted,
      solvedPuzzles,
      inventory,
    ],
  );
  const statuses = useMemo(() => memoryStatuses(progress), [progress]);

  /**
   * 스크린리더가 읽을 이름. 조사할 수 없는 물건은 이유까지 붙인다. 목록에서 이름만
   * 읽히고 눌러도 아무 일이 없으면, 잠긴 것인지 이미 본 것인지 알 길이 없다.
   */
  const memoryButtonLabels = useMemo<Record<MemoryId, string>>(
    () =>
      Object.fromEntries(
        MEMORY_IDS.map((id) => [
          id,
          statuses[id] === "available"
            ? labels[id]
            : t(`scene.memoryState.${statuses[id]}`, { name: labels[id] }),
        ]),
      ) as Record<MemoryId, string>,
    [labels, statuses, t],
  );

  /*
   * 화면 밖 목록에 오르는 것: 지금 닿을 수 있는 공간의 기억과, 거기 붙은 닫힌 문
   * (room-prompt-list.ts). 문의 이름에는 열 수 있는지까지 담는다 (기억의 이름과 같은 이유).
   */
  const lightsOn = useMemoryRoomStore((state) => state.lightsOn);
  const atDoorway = useMemoryRoomStore(selectViewpoint) === "doorway";
  const { listedMemoryIds, promptActions } = useMemo(() => {
    const doorProgress = { collected, revisited, doorOpened, openedDoorways, inventory };
    const open = openDoorwayIds(doorProgress);
    const reached = reachableSpaces(open);
    const doors = listedDoorways(reached, open).map((id): RoomPromptAction => {
      const ready = id === "room-living" ? roomDoorReady : doorwayReady(doorProgress, id);
      return {
        id: `door-${id}`,
        label: t(`scene.doorState.${ready ? "ready" : "locked"}`, { name: t(`scene.door.${id}`) }),
        onPress: () => pressDoor(id),
      };
    });
    // 전등 스위치: 인트로에서는 이걸 켜는 것이 유일한 할 일이다
    const light: RoomPromptAction = {
      id: "light-switch",
      label: t(lightsOn ? "scene.light.off" : "scene.light.on"),
      onPress: pressLightSwitch,
    };
    // 방문이 열린 뒤의 1인칭: 걸어서 문턱을 넘어야 거실에 선다. 걷지 못하는 사람은
    // 수첩의 평면도가 옮겨 주는 자리(landing)로 바로 선다. 평면도는 이 구간에 잠겨 있다
    const stepOut: RoomPromptAction[] = atDoorway
      ? [
          {
            id: "step-out",
            label: t("scene.stepOut"),
            onPress: () => {
              const state = useMemoryRoomStore.getState();
              if (viewpointOf(state) !== "doorway" || selectSceneInputLocked(state)) return;
              playSound("open");
              state.warpPlayer(SPACES.living.landing.x, SPACES.living.landing.z);
            },
          },
        ]
      : [];
    // 기억도 문간도 아닌데 눌러야 넘어가는 물건: 마개 · 협탁 서랍 · 악보 조각 · 피아노 · 배트 · 현관문
    const props = listedProps(progress, reached).map(
      ({ id, ready }): RoomPromptAction => ({
        id: `prop-${id}`,
        label: t(`scene.propState.${ready ? "ready" : "locked"}`, { name: t(`scene.prop.${id}`) }),
        onPress: PROP_PRESS[id],
      }),
    );
    return {
      listedMemoryIds: listedMemories(reached),
      promptActions: [...stepOut, light, ...doors, ...props],
    };
  }, [
    collected,
    revisited,
    doorOpened,
    openedDoorways,
    inventory,
    progress,
    roomDoorReady,
    lightsOn,
    atDoorway,
    t,
  ]);

  const clearDirectFocusTimer = useCallback(() => {
    if (directFocusTimer.current === null) return;
    window.clearTimeout(directFocusTimer.current);
    directFocusTimer.current = null;
  }, []);

  const interact = useCallback(
    (id: MemoryId) => {
      // 1인칭에 있는 동안은 조사하지 않는다 (스토어도 막지만 소리까지 맞추려면 여기서 먼저)
      if (viewpointOf(useMemoryRoomStore.getState()) !== null) {
        playSound("deny");
        return false;
      }
      const accepted = dispatchMemoryInteraction(
        useMemoryRoomStore.getState(),
        id,
        () => {
          setFocusMemoryId(id);
          beginInteraction(id);
          clearDirectFocusTimer();
          if (useMemoryRoomStore.getState().activeInteraction === null) {
            directFocusTimer.current = window.setTimeout(
              () => setFocusMemoryId(null),
              DIRECT_FOCUS_MS,
            );
          }
        },
        {
          curtainsOpen,
          openCurtains: openBothCurtains,
        },
      );
      // 대사·미니게임이 떠 있어 입력이 잠긴 동안에는 아무 소리도 내지 않는다.
      // 그건 "안 되는 것"이 아니라 "지금 차례가 아닌 것"이다.
      if (accepted) playSound("select");
      else if (!selectSceneInputLocked(useMemoryRoomStore.getState())) playSound("deny");
      return accepted;
    },
    [beginInteraction, clearDirectFocusTimer, curtainsOpen, openBothCurtains],
  );

  useEffect(() => {
    if (activeInteraction) {
      clearDirectFocusTimer();
      setFocusMemoryId(activeInteraction.memoryId);
    } else if (hadActiveInteraction.current) {
      setFocusMemoryId(null);
    }
    hadActiveInteraction.current = activeInteraction !== null;
  }, [activeInteraction, clearDirectFocusTimer]);

  useEffect(() => clearDirectFocusTimer, [clearDirectFocusTimer]);

  useEffect(() => {
    let animationFrame: number | null = null;
    const applyViewportZoom = () => {
      animationFrame = null;
      setZoomByFraming({
        overview: roomOverviewZoomForViewport(window.innerWidth, window.innerHeight),
        play: roomZoomForViewport(window.innerWidth, window.innerHeight),
      });
    };
    const handleResize = () => {
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(applyViewportZoom);
    };

    applyViewportZoom();
    window.addEventListener("resize", handleResize, { passive: true });
    return () => {
      window.removeEventListener("resize", handleResize);
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  useEffect(() => {
    const updateNearbyMemory = () => {
      const position = playerPositionRef.current;
      const state = useMemoryRoomStore.getState();
      // 1인칭에 있는 동안은 아무것도 조사 대상이 아니다. 근접 안내와 글로우가 같이 꺼진다
      const nextNearbyMemoryId =
        viewpointOf(state) !== null
          ? null
          : findNearestMemory(
              position,
              MEMORY_TARGETS,
              (id) => hotspotStatus(useMemoryRoomStore.getState(), id) === "available",
            );
      if (nextNearbyMemoryId === nearbyMemoryIdRef.current) return;

      nearbyMemoryIdRef.current = nextNearbyMemoryId;
      setNearbyMemoryId(nextNearbyMemoryId);
    };

    updateNearbyMemory();
    const interval = window.setInterval(updateNearbyMemory, PROXIMITY_POLL_MS);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      handleRoomInteractionKeyDown(event, {
        nearbyMemoryId: nearbyMemoryIdRef.current,
        inputLocked: selectSceneInputLocked(useMemoryRoomStore.getState()),
        interact,
      });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [interact]);

  // 포커스 연출·대사·미니게임 중에는 구도가 깨지지 않게 뷰를 되돌리고 입력을 잠근다.
  // 1인칭 동안도 같다: 회전·배율은 직교 카메라의 것이고, 그 카메라는 잠들어 있다.
  const viewLocked = inputLocked || focusMemoryId !== null || firstPerson;
  useFirstPersonLook(containerRef, lookEnabled, lookRef);

  const applyZoomScale = useCallback((next: number) => {
    if (zoomScaleRef.current === next) return;
    zoomScaleRef.current = next;
    setZoomScale(next);
  }, []);

  const applyOrbit = useCallback((next: number) => {
    if (orbitRef.current === next) return;
    orbitRef.current = next;
    setOrbitAzimuth(next);
  }, []);

  /**
   * 잠기는 동안은 기본 구도로 돌아가고, 풀리면 **사용자가 잡아 둔 배율·각도로 돌아온다**.
   * 예전에는 되돌리기만 해서, 미니게임 하나 끝날 때마다 줌이 기본값으로 튕겼다.
   */
  const savedViewRef = useRef<{ zoom: number; orbit: number } | null>(null);
  useEffect(() => {
    if (viewLocked) {
      savedViewRef.current = { zoom: zoomScaleRef.current, orbit: orbitRef.current };
      applyZoomScale(1);
      applyOrbit(0);
      return;
    }
    const saved = savedViewRef.current;
    if (!saved) return;
    savedViewRef.current = null;
    applyZoomScale(saved.zoom);
    applyOrbit(saved.orbit);
  }, [viewLocked, applyZoomScale, applyOrbit]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || viewLocked) return;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      applyZoomScale(roomZoomScaleFromWheel(zoomScaleRef.current, event.deltaY));
    };

    // 좌클릭 드래그로 회전. 임계값을 넘긴 드래그는 뒤따르는 click을 캡처 단계에서 삼켜
    // 오브젝트가 잘못 선택되지 않게 한다.
    let drag: { pointerId: number; x: number; angle: number } | null = null;
    let swallowClick = false;
    const handlePointerDown = (event: PointerEvent) => {
      // 손가락으로 끈 뒤에는 click이 아예 오지 않는다. 삼키려고 세운 표시가 남아 있으면
      // 다음 탭(전혀 다른 물건을 누른 것)이 대신 삼켜진다. 새 누름은 늘 깨끗이 시작한다
      swallowClick = false;
      if (drag !== null || event.button !== 0 || isInteractiveTarget(event.target)) {
        drag = null;
        return;
      }
      drag = { pointerId: event.pointerId, x: event.clientX, angle: orbitRef.current };
    };
    const handlePointerMove = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      const travel = event.clientX - drag.x;
      if (!swallowClick && Math.abs(travel) < ORBIT_DRAG_THRESHOLD) return;
      swallowClick = true;
      applyOrbit(roomOrbitFromDrag(drag.angle, travel));
    };
    const endDrag = (event: PointerEvent) => {
      if (drag && event.pointerId !== drag.pointerId) return;
      drag = null;
    };
    const handleClickCapture = (event: MouseEvent) => {
      if (!swallowClick) return;
      swallowClick = false;
      event.stopPropagation();
      event.preventDefault();
    };

    let pinch: { distance: number; scale: number } | null = null;
    const pinchDistance = (touches: TouchList) =>
      Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
    const handleTouchStart = (event: TouchEvent) => {
      pinch =
        event.touches.length === 2
          ? { distance: pinchDistance(event.touches), scale: zoomScaleRef.current }
          : null;
    };
    const handleTouchMove = (event: TouchEvent) => {
      if (!pinch || event.touches.length !== 2) return;
      event.preventDefault();
      applyZoomScale(
        roomZoomScaleFromPinch(pinch.scale, pinch.distance, pinchDistance(event.touches)),
      );
    };
    const endPinch = () => {
      pinch = null;
      drag = null;
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      handleRoomZoomKeyDown(event, {
        locked: false,
        scale: zoomScaleRef.current,
        apply: applyZoomScale,
      });
      handleRoomOrbitKeyDown(event, {
        locked: false,
        angle: orbitRef.current,
        apply: applyOrbit,
      });
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    container.addEventListener("pointerdown", handlePointerDown);
    container.addEventListener("pointermove", handlePointerMove);
    container.addEventListener("pointerup", endDrag);
    container.addEventListener("pointercancel", endDrag);
    container.addEventListener("click", handleClickCapture, { capture: true });
    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchmove", handleTouchMove, { passive: false });
    container.addEventListener("touchend", endPinch, { passive: true });
    container.addEventListener("touchcancel", endPinch, { passive: true });
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      container.removeEventListener("wheel", handleWheel);
      container.removeEventListener("pointerdown", handlePointerDown);
      container.removeEventListener("pointermove", handlePointerMove);
      container.removeEventListener("pointerup", endDrag);
      container.removeEventListener("pointercancel", endDrag);
      container.removeEventListener("click", handleClickCapture, { capture: true });
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", endPinch);
      container.removeEventListener("touchcancel", endPinch);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [applyZoomScale, applyOrbit, viewLocked]);

  const nearbyLabel = nearbyMemoryId
    ? hint("scene.interactHint", { name: labels[nearbyMemoryId] })
    : "";

  return (
    <div ref={containerRef} className="absolute inset-0">
      {/* 모델이 얼마나 들어왔는지를 타이틀 화면에 알린다. 그리는 것은 없다 */}
      <RoomLoadReporter failed={webGLFailed} />
      {/* 창밖으로 새어나가는 빛: 캔버스보다 아래라 방을 절대 덮지 않는다 */}
      <div aria-hidden className="room-backdrop pointer-events-none absolute inset-0" />
      {/* 타이틀에서만 디오라마 뒤에 깔리는 빛 웅덩이: 모형을 무대 위에 올린다. 시작하면 물러난다 */}
      <div
        aria-hidden
        className="room-stage-pool pointer-events-none absolute inset-0 transition-opacity duration-1000"
        style={{ opacity: started ? 0 : 1 }}
      />
      {webGLFailed ? (
        <>
          <WebGLFallback>{t("scene.webglFallback")}</WebGLFallback>
          {/* 씬이 없으면 canvas 모드 미니게임이 설 자리도 없다. 건너뛰어 진행을 살린다 */}
          <CanvasMinigameSkip />
        </>
      ) : (
        // key: 컨텍스트를 잃으면 오류 경계째 새로 세운다. 잃은 컨텍스트로 그리다 난 오류가
        // 경계에 남아 있으면 새 캔버스가 서도 폴백 글만 보인다
        <CanvasErrorBoundary key={canvasEpoch} fallbackText={t("scene.webglFallback")}>
          <Canvas
            ref={attachCanvasRef}
            className="absolute inset-0 z-0"
            orthographic
            // three r185에서 PCFSoftShadowMap(= shadows 기본값)이 deprecated라 PCF로 명시한다
            shadows="percentage"
            dpr={dpr}
            // 엔딩 영상이 덮는 동안은 멈춘다. 마지막 프레임이 그대로 남아 페이드 뒤에 선다
            frameloop={sceneCovered ? "never" : "always"}
            camera={initialCamera}
            // alpha: true: 캔버스 뒤 DOM 워시가 비쳐야 한다 (창밖 번짐을 3D에 두면
            // three가 투명 오브젝트를 항상 불투명 뒤에 그려서 벽을 뚫고 덧칠된다)
            gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
          >
            {/* 내리기만 한다 (degrade 주석). 같은 값을 다시 놓는 건 React가 걸러 재렌더가 없다 */}
            <PerformanceMonitor onDecline={degrade} />
            {/* 크기·배율이 바뀐 직후 한 장을 바로 그린다. 빈 버퍼가 합성돼 검게 깜빡이지 않게 */}
            <ResizeRepaint />
            {/* 숨은 방의 물건은 클릭·호버를 받지 않는다 */}
            <VisibleHitsOnly />
            <MemoryRoomScene
              playerPositionRef={playerPositionRef}
              movementInputRef={movementInputRef}
              focusMemoryId={focusMemoryId}
              nearbyMemoryId={nearbyMemoryId}
              curtainsOpen={curtainsOpen}
              curtainPull={curtainPull}
              onCurtainPull={handleCurtainPull}
              onCurtainRelease={handleCurtainRelease}
              roomZoom={roomZoom * zoomScale}
              zoomScale={zoomScale}
              orbitAzimuth={orbitAzimuth}
              following={started}
              viewpoint={viewpoint}
              lookRef={lookRef}
              onInteract={interact}
            />
          </Canvas>
        </CanvasErrorBoundary>
      )}

      {/* 엔딩이 시작되면 방은 끝났다: 화면 밖 목록이 남으면 키보드·스크린리더가 엔딩 카드 뒤의 물건으로 간다 */}
      {!endingStarted && (
        // 걸음이 잠긴 동안(단서·대사·미니게임·메뉴)은 "E로 조사" 칩을 내린다. 위를 덮은
        // 판의 흐린 배경 아래로 뭉개진 칩만 비쳐 보였다
        <RoomInteractionPrompt
          nearbyMemoryId={inputLocked ? null : nearbyMemoryId}
          nearbyLabel={nearbyLabel}
          legend={t("hud.scattered")}
          labels={memoryButtonLabels}
          statuses={statuses}
          memoryIds={listedMemoryIds}
          onInteract={interact}
          actions={promptActions}
        />
      )}
      {pointerKind === "touch" && (
        <MovementJoystick
          inputRef={movementInputRef}
          disabled={inputLocked}
          label={hint("scene.moveHint")}
          caption={t("scene.moveCaption")}
        />
      )}
      {/* 1인칭에서만: 조이스틱의 짝. 끌기가 어려운 손에도 돌아볼 길을 준다 */}
      {pointerKind === "touch" && lookEnabled && (
        <LookButtons
          lookRef={lookRef}
          disabled={inputLocked}
          labels={{ left: t("scene.turnLeft"), right: t("scene.turnRight") }}
          caption={t("scene.lookCaption")}
        />
      )}
    </div>
  );
}
