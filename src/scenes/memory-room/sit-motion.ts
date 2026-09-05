/**
 * 앉고 일어서는 동안의 진행도.
 *
 * SitDown/StandUp 클립을 재생하지 않고 Idle↔Sit 가중치를 이 진행도로 넘긴다 — 두 클립은
 * 마지막 키프레임이 첫 포즈로 되돌아오게 내보내져 있어(선 자세로 튄다) 그대로는 못 쓴다.
 * 몸이 좌면으로 미끄러지는 이동도 같은 진행도를 쓰므로, 자세와 자리가 항상 함께 간다.
 */

/** 앉기/일어서기에 걸리는 시간(초). 클립이 쓰던 0.83보다 짧게 — 앉는 건 기다릴 일이 아니다. */
export const SIT_SECONDS = 0.55;

export function advanceSitProgress(current: number, seated: boolean, delta: number): number {
  const step = Math.max(0, delta) / SIT_SECONDS;
  return Math.max(0, Math.min(1, current + (seated ? step : -step)));
}

/** 시작과 끝을 무르게 — 선형으로 섞으면 앉는 순간 몸이 툭 떨어진다. */
export function sitEase(progress: number): number {
  const clamped = Math.max(0, Math.min(1, progress));
  return clamped * clamped * (3 - 2 * clamped);
}

export function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

/** 최단 회전 방향으로 섞는다 — -π/π 경계에서 한 바퀴 도는 걸 막는다 (Player의 dampAngle과 같은 이유). */
export function lerpAngle(from: number, to: number, t: number): number {
  const shortest =
    ((((to - from + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI;
  return from + shortest * t;
}
