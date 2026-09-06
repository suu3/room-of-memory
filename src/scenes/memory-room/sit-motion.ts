/**
 * 앉고 일어서는 동안의 진행도.
 *
 * SitDown/StandUp 클립을 재생하지 않고 Idle↔Sit 가중치를 이 진행도로 넘긴다 — 두 클립은
 * 마지막 키프레임이 첫 포즈로 되돌아오게 내보내져 있어(선 자세로 튄다) 그대로는 못 쓴다.
 * 몸이 좌면으로 내려앉는 이동도 같은 진행도를 쓰므로, 자세와 자리가 항상 함께 간다.
 */

/** 앉기/일어서기에 걸리는 시간(초). 클립이 쓰던 0.83보다 짧게 — 앉는 건 기다릴 일이 아니다. */
export const SIT_SECONDS = 0.55;

export function advanceSitProgress(current: number, seated: boolean, delta: number): number {
  const step = Math.max(0, delta) / SIT_SECONDS;
  return Math.max(0, Math.min(1, current + (seated ? step : -step)));
}

/**
 * 자리까지 가는 걸음과 앉는 동작, 두 구간.
 *
 * 처음에는 앉기 하나로만 굴렸는데, 몸이 걷지 않고 의자까지 미끄러져 들어갔다 — 앉는
 * 자세보다 그 미끄러짐이 먼저 눈에 걸린다. 앉을 때는 **걸어가서 앉고**, 일어설 때는
 * **일어선 다음 걸어 돌아온다**. 두 구간이 겹치지 않는 것이 핵심이다: 걸으면서 접히거나
 * 앉은 채로 미끄러지면 원래 문제로 돌아간다.
 */
export interface SitPhases {
  /** 자리까지 간 정도 (0=출발한 자리, 1=자리 앞). 걷기 애니메이션이 이 구간에서 돈다. */
  travel: number;
  /** 앉은 정도 (0=서 있음, 1=앉음). */
  sit: number;
}

export function advanceSitPhases(
  current: SitPhases,
  seated: boolean,
  delta: number,
  /** 자리까지 걷는 데 걸리는 시간(초). 이미 그 자리면 0 — 걷는 구간을 건너뛴다. */
  travelSeconds: number,
  out: SitPhases,
): SitPhases {
  const step = Math.max(0, delta);
  let { travel, sit } = current;
  if (seated) {
    travel = travelSeconds <= 0 ? 1 : Math.min(1, travel + step / travelSeconds);
    if (travel >= 1) sit = Math.min(1, sit + step / SIT_SECONDS);
  } else {
    sit = Math.max(0, sit - step / SIT_SECONDS);
    if (sit <= 0) travel = travelSeconds <= 0 ? 0 : Math.max(0, travel - step / travelSeconds);
  }
  out.travel = travel;
  out.sit = sit;
  return out;
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
