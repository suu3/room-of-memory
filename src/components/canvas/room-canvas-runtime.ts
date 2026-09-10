import type { MemoryId } from "@/data/memory-room";
import {
  hotspotStatus,
  selectSceneInputLocked,
  type useMemoryRoomStore,
} from "@/store/memory-room";

const INTERACTIVE_TARGET_SELECTOR =
  "button, a, input, select, textarea, summary, [contenteditable]:not([contenteditable='false']), [role='button'], [role='link']";

interface WebGLLoseContextExtension {
  loseContext: () => void;
}

interface WebGLProbeContext {
  getExtension: (name: string) => WebGLLoseContextExtension | null;
}

interface WebGLProbeCanvas {
  getContext: (contextId: "webgl2" | "webgl") => WebGLProbeContext | null;
}

type WebGLProbeCanvasFactory = () => WebGLProbeCanvas;

/*
 * 방 전체를 화면에 다 담던 구도(레퍼런스 19.4 x 12.3)를 버렸다.
 * 그 구도에서는 1440x900에서도 캐릭터 키가 80px밖에 안 돼서 방이 통째로 작아 보였다.
 * 이제는 "화면에 월드 유닛 몇 개를 담을지"로 잡고, 카메라가 플레이어를 따라간다.
 */

/**
 * 화면 세로에 담을 월드 유닛. 캐릭터 키가 1.1이라 이 값이 곧 캐릭터의 화면 비중이다.
 *
 * 방 전체가 한눈에 안 들어와야 "탐사"가 된다. 이 값이면 방 폭(17.4)의 절반쯤만
 * 보이므로, 반대편 벽에 뭐가 걸려 있는지는 걸어가거나 돌려 봐야 안다.
 */
const VIEW_HEIGHT_UNITS = 6;
/** 아무리 좁은 화면이라도 가로로 이만큼은 보인다. 세로로 긴 폰에서 시야가 바늘구멍이 되는 걸 막는다. */
const MIN_VIEW_WIDTH_UNITS = 5.6;
/**
 * 반대로 세로로는 이보다 더 담지 않는다.
 *
 * 세로로 긴 폰에서는 가로 하한이 구도를 정하는데, 그러면 세로로 14유닛이 잡혀서
 * 방(높이 약 11유닛)을 다 담고도 화면 아래쪽이 받침과 배경으로 남는다.
 * 세로를 되잡아 주면 캐릭터는 더 커지고 빈 배경은 줄어든다.
 */
const MAX_VIEW_HEIGHT_UNITS = 10;
const MIN_ROOM_ZOOM = 34;
const MAX_ROOM_ZOOM = 170;
const FALLBACK_ROOM_ZOOM = 96;

/**
 * 휠/핀치로 조절하는 사용자 배율.
 * 하한을 크게 열어 뒀다. 축소하면 예전처럼 방 전체를 내려다보는 구도가 된다.
 */
export const MIN_ROOM_ZOOM_SCALE = 0.45;
export const MAX_ROOM_ZOOM_SCALE = 1.8;
const WHEEL_ZOOM_SENSITIVITY = 0.0016;

export function roomZoomForViewport(width: number, height: number): number {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return FALLBACK_ROOM_ZOOM;
  }

  const heightLimitedZoom = height / VIEW_HEIGHT_UNITS;
  const widthLimitedZoom = width / MIN_VIEW_WIDTH_UNITS;
  const tallScreenFloor = height / MAX_VIEW_HEIGHT_UNITS;
  const framed = Math.max(tallScreenFloor, Math.min(heightLimitedZoom, widthLimitedZoom));
  return Math.min(MAX_ROOM_ZOOM, Math.max(MIN_ROOM_ZOOM, framed));
}

/*
 * 타이틀 화면 구도: 방 하나가 통째로 보이는 디오라마.
 *
 * 플레이 구도로 바로 시작하면 이 게임이 "방 모형"이라는 인상을 줄 기회가 없다.
 * 타이틀에서는 모형 전체를 보여주고, 시작 버튼을 누르면 카메라가 그 안으로 내려앉는다
 * (전환은 CameraRig의 damp가 알아서 한다. 목표값만 바뀌면 된다).
 *
 * 방 셸의 화면상 바운딩은 약 17.4 x 11.0 월드 유닛이다. 레퍼런스를 그보다 조금만
 * 크게 잡아 여백을 줄인다.
 */
const OVERVIEW_REFERENCE_WIDTH = 19.4;
const OVERVIEW_REFERENCE_HEIGHT = 12.3;
const MIN_OVERVIEW_ZOOM = 18;
const MAX_OVERVIEW_ZOOM = 84;

export function roomOverviewZoomForViewport(width: number, height: number): number {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return 64;
  }

  return Math.min(
    MAX_OVERVIEW_ZOOM,
    Math.max(
      MIN_OVERVIEW_ZOOM,
      Math.min(width / OVERVIEW_REFERENCE_WIDTH, height / OVERVIEW_REFERENCE_HEIGHT),
    ),
  );
}

/**
 * 오브젝트를 조사할 때 얼마나 더 당길지. 카메라가 직교(orthographic)라
 * 위치를 타깃 쪽으로 옮겨도 크기는 그대로다. 확대는 zoom으로만 된다.
 */
export const FOCUS_ZOOM_SCALE = 1.45;

export function focusZoomFor(baseZoom: number, focused: boolean): number {
  if (!Number.isFinite(baseZoom)) return baseZoom;
  return focused ? baseZoom * FOCUS_ZOOM_SCALE : baseZoom;
}

export function clampRoomZoomScale(scale: number): number {
  if (!Number.isFinite(scale)) return 1;
  return Math.min(MAX_ROOM_ZOOM_SCALE, Math.max(MIN_ROOM_ZOOM_SCALE, scale));
}

/**
 * 휠 델타를 배율 변화로 바꾼다. 위로 굴리면(deltaY < 0) 확대.
 * 지수 스텝이라 확대/축소 한 칸의 체감이 배율과 무관하게 일정하다.
 */
export function roomZoomScaleFromWheel(scale: number, deltaY: number): number {
  if (!Number.isFinite(deltaY)) return clampRoomZoomScale(scale);
  return clampRoomZoomScale(scale * Math.exp(-deltaY * WHEEL_ZOOM_SENSITIVITY));
}

/** 핀치: 시작 시점의 배율과 손가락 간격 대비 현재 간격 비율. */
export function roomZoomScaleFromPinch(
  startScale: number,
  startDistance: number,
  distance: number,
): number {
  if (!Number.isFinite(startDistance) || startDistance <= 0 || !Number.isFinite(distance)) {
    return clampRoomZoomScale(startScale);
  }
  return clampRoomZoomScale(startScale * (distance / startDistance));
}

/**
 * 기준 방위각에서 좌우로 돌릴 수 있는 최대 각도.
 *
 * 예전에는 0.32rad로 묶여 있었다. 벽이 두 면뿐이라 그 밖으로 나가면 열린 앞/오른쪽
 * 면이 "먼 쪽 벽"이 되면서 방이 뚫려 보였기 때문이다. 사면벽이 되면서 그 이유가
 * 사라졌고, 돌려야 나머지 두 벽을 볼 수 있으므로 오히려 넓혀야 탐사가 된다.
 *
 * 그래도 0.5(±29°)에서 멈춘다. 두 가지가 이 값을 정한다.
 *
 * 하나, 기준 방위각이 46.7°라 이 범위에서 카메라는 +X/+Z 사분면(17.7°~75.7°)을
 * 벗어나지 않는다. 그래서 뒷벽과 왼쪽 벽은 늘 서 있고, 거기 걸린 포스터·달력·창밖
 * 풍경이 벽 없이 허공에 뜨는 일이 없다. 더 키우려면 그것들을 전부 해당 벽의
 * CulledWall 안으로 옮겨야 한다.
 *
 * 둘, 0.75까지 열어 봤더니 한쪽 끝에서 시선이 축과 거의 나란해지면서(89.7°)
 * 직교 투영 특유의 납작한 정면도가 됐다. 아이소메트릭 특유의 입체감은 45° 근처에서만
 * 나온다. 돌리는 재미보다 구도가 무너지는 손해가 컸다.
 */
export const MAX_ROOM_ORBIT = 0.5;
const ORBIT_DRAG_SENSITIVITY = 0.004;
const ORBIT_KEY_STEP = 0.08;
/** 이 픽셀 이상 끌면 회전으로 보고, 그 포인터의 클릭은 삼킨다. */
export const ORBIT_DRAG_THRESHOLD = 6;

export function clampRoomOrbit(angle: number): number {
  if (!Number.isFinite(angle)) return 0;
  return Math.min(MAX_ROOM_ORBIT, Math.max(-MAX_ROOM_ORBIT, angle));
}

/** 오른쪽으로 끌면 방도 오른쪽으로 도는 방향(카메라는 반대로). */
export function roomOrbitFromDrag(startAngle: number, deltaX: number): number {
  if (!Number.isFinite(deltaX)) return clampRoomOrbit(startAngle);
  return clampRoomOrbit(startAngle - deltaX * ORBIT_DRAG_SENSITIVITY);
}

interface RoomOrbitKeyOptions {
  locked: boolean;
  angle: number;
  apply: (next: number) => void;
}

/** `,`/`.`로 좌우 회전. 이동(WASD·화살표)과 상호작용(E) 키를 피한 배치다. */
export function handleRoomOrbitKeyDown(
  event: KeyboardEvent,
  { locked, angle, apply }: RoomOrbitKeyOptions,
): boolean {
  if (locked || event.repeat || isInteractiveTarget(event.target)) return false;

  let next: number | null = null;
  if (event.key === "," || event.key === "<") next = angle + ORBIT_KEY_STEP;
  else if (event.key === "." || event.key === ">") next = angle - ORBIT_KEY_STEP;
  else if (event.key === "0") next = 0;
  if (next === null) return false;

  apply(clampRoomOrbit(next));
  event.preventDefault();
  return true;
}

function createBrowserProbeCanvas(): WebGLProbeCanvas {
  return document.createElement("canvas") as unknown as WebGLProbeCanvas;
}

export function canInitializeWebGL(
  createCanvas: WebGLProbeCanvasFactory = createBrowserProbeCanvas,
): boolean {
  if (typeof document === "undefined" && createCanvas === createBrowserProbeCanvas) return false;

  try {
    const canvas = createCanvas();
    const context = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (!context) return false;

    context.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

type MemoryRoomState = ReturnType<typeof useMemoryRoomStore.getState>;

export function dispatchMemoryInteraction(
  state: MemoryRoomState,
  id: MemoryId,
  dispatch: (id: MemoryId) => void,
  curtain?: {
    curtainsOpen: boolean;
    openCurtains: () => void;
  },
): boolean {
  if (selectSceneInputLocked(state) || hotspotStatus(state, id) !== "available") return false;

  if (id === "window" && curtain && !curtain.curtainsOpen) {
    curtain.openCurtains();
    return true;
  }

  dispatch(id);
  return true;
}

interface RoomInteractionKeyOptions {
  nearbyMemoryId: MemoryId | null;
  inputLocked: boolean;
  interact: (id: MemoryId) => boolean;
}

export function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(INTERACTIVE_TARGET_SELECTOR) !== null;
}

const ZOOM_KEY_STEP = 1.15;

interface RoomZoomKeyOptions {
  locked: boolean;
  scale: number;
  apply: (next: number) => void;
}

/** `+`/`-`로 확대·축소, `0`으로 기본 배율 복귀. 키보드만으로도 뷰를 조절할 수 있어야 한다. */
export function handleRoomZoomKeyDown(
  event: KeyboardEvent,
  { locked, scale, apply }: RoomZoomKeyOptions,
): boolean {
  if (locked || event.repeat || isInteractiveTarget(event.target)) return false;

  let next: number | null = null;
  if (event.key === "+" || event.key === "=") next = scale * ZOOM_KEY_STEP;
  else if (event.key === "-" || event.key === "_") next = scale / ZOOM_KEY_STEP;
  else if (event.key === "0") next = 1;
  if (next === null) return false;

  apply(clampRoomZoomScale(next));
  event.preventDefault();
  return true;
}

export function handleRoomInteractionKeyDown(
  event: KeyboardEvent,
  { nearbyMemoryId, inputLocked, interact }: RoomInteractionKeyOptions,
): boolean {
  if (event.code !== "KeyE" && event.key !== "Enter") return false;
  if (event.repeat || isInteractiveTarget(event.target) || inputLocked || !nearbyMemoryId) {
    return false;
  }
  if (!interact(nearbyMemoryId)) return false;

  event.preventDefault();
  return true;
}
