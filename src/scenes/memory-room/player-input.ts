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
