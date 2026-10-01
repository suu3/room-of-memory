import type { MovementAxes } from "@/types/movement";

export const MOVEMENT_KEYS = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowLeft",
  "ArrowDown",
  "ArrowRight",
]);

export function captureMovementKeyDown(
  event: KeyboardEvent,
  keys: Set<string>,
  inputLocked: boolean,
): boolean {
  if (!MOVEMENT_KEYS.has(event.code)) return false;
  if (event.repeat || inputLocked) return false;
  event.preventDefault();
  keys.add(event.code);
  return true;
}

function isPressed(keys: Set<string>, primary: string, alternate: string) {
  return keys.has(primary) || keys.has(alternate);
}

export function resolveMovementInput(
  keys: Set<string>,
  analog: MovementAxes,
  target: MovementAxes,
): MovementAxes {
  target.horizontal =
    Number(isPressed(keys, "KeyD", "ArrowRight")) -
    Number(isPressed(keys, "KeyA", "ArrowLeft")) +
    analog.horizontal;
  target.vertical =
    Number(isPressed(keys, "KeyW", "ArrowUp")) -
    Number(isPressed(keys, "KeyS", "ArrowDown")) +
    analog.vertical;

  const length = Math.hypot(target.horizontal, target.vertical);
  if (length > 1) {
    target.horizontal /= length;
    target.vertical /= length;
  }
  return target;
}
