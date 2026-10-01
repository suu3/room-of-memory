import type { MovementAxes } from "@/types/movement";

const JOYSTICK_DEAD_ZONE = 0.12;

export function joystickVectorFromOffset(
  offsetX: number,
  offsetY: number,
  maxDistance: number,
): MovementAxes {
  if (maxDistance <= 0) return { horizontal: 0, vertical: 0 };

  const horizontal = offsetX / maxDistance;
  const vertical = -offsetY / maxDistance;
  const length = Math.hypot(horizontal, vertical);
  if (length <= JOYSTICK_DEAD_ZONE) return { horizontal: 0, vertical: 0 };

  const clampedLength = Math.min(length, 1);
  const scaledLength = (clampedLength - JOYSTICK_DEAD_ZONE) / (1 - JOYSTICK_DEAD_ZONE);
  return {
    horizontal: (horizontal / length) * scaledLength,
    vertical: (vertical / length) * scaledLength,
  };
}
