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

// 방 셸의 화면상 바운딩은 약 17.4 x 11.0 월드 유닛이다. 레퍼런스를 그보다 조금만
// 크게 잡아 여백을 줄인다 — 전체 뷰가 화면을 더 꽉 채운다.
const ROOM_REFERENCE_WIDTH = 19.4;
const ROOM_REFERENCE_HEIGHT = 12.3;
const MIN_ROOM_ZOOM = 18;
const MAX_ROOM_ZOOM = 84;

/** 휠/핀치로 조절하는 사용자 배율. 하한은 열린 면이 크게 드러나지 않는 선. */
export const MIN_ROOM_ZOOM_SCALE = 0.85;
export const MAX_ROOM_ZOOM_SCALE = 1.7;
const WHEEL_ZOOM_SENSITIVITY = 0.0016;

export function roomZoomForViewport(width: number, height: number): number {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return 64;
  }

  const widthLimitedZoom = width / ROOM_REFERENCE_WIDTH;
  const heightLimitedZoom = height / ROOM_REFERENCE_HEIGHT;
  return Math.min(
    MAX_ROOM_ZOOM,
    Math.max(MIN_ROOM_ZOOM, Math.min(widthLimitedZoom, heightLimitedZoom)),
  );
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
 * 카메라는 +X/+Z 사분면(기준 약 43.4°) 안에 머물러야 한다 — 그 밖으로 나가면
 * 벽이 없는 앞/오른쪽 면이 "먼 쪽 벽"이 되면서 방이 뚫려 보인다.
 */
export const MAX_ROOM_ORBIT = 0.32;
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
