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
): boolean {
  if (selectSceneInputLocked(state) || hotspotStatus(state, id) !== "available") return false;

  dispatch(id);
  return true;
}

interface RoomInteractionKeyOptions {
  nearbyMemoryId: MemoryId | null;
  inputLocked: boolean;
  interact: (id: MemoryId) => boolean;
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(INTERACTIVE_TARGET_SELECTOR) !== null;
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
