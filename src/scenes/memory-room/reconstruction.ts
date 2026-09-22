/**
 * 재구성 전환의 시간표 (docs/visual-experiments.md 7장·11장 "와이어프레임 재구성").
 *
 * 공간이 선으로 풀렸다가 다시 면으로 채워진다. 자리는 둘이다: 전환 컷씬이 끝나 3D로
 * 돌아오는 순간(라디오 재점화)과, 화장실·안방에 처음 들어서는 순간. 기억에서 다시
 * 세워지는 집이다.
 *
 * 두 구간이다. 앞은 모든 머티리얼이 와이어프레임으로 서 있는 시간, 뒤는 면으로 돌아온
 * 화면 위에 노이즈 결이 잦아드는 시간(ScreenTransition의 settle). 둘을 합쳐 1초 안이다.
 */

/** 선으로 서 있는 시간(초). */
export const WIREFRAME_S = 0.45;
/** 면으로 돌아온 뒤 결이 잦아드는 시간(초). */
export const SETTLE_S = 0.55;

export interface ReconstructionFrame {
  /** 지금 와이어프레임인가. */
  wireframe: boolean;
  /** 노이즈 결의 양 (0~1). 면으로 돌아오는 순간 1에서 0으로. */
  settle: number;
  /** 끝났는가. */
  done: boolean;
}

/** 시작 뒤 흐른 시간 → 이 프레임의 상태. 아직 시작 전(음수)이나 끝난 뒤는 done. */
export function reconstructionAt(elapsedS: number): ReconstructionFrame {
  if (!Number.isFinite(elapsedS) || elapsedS < 0)
    return { wireframe: false, settle: 0, done: true };
  if (elapsedS < WIREFRAME_S) return { wireframe: true, settle: 1, done: false };
  const t = (elapsedS - WIREFRAME_S) / SETTLE_S;
  if (t >= 1) return { wireframe: false, settle: 0, done: true };
  // 부드럽게 잦아든다. 선형이면 마지막에 툭 끊긴다
  const settle = 1 - t * t * (3 - 2 * t);
  return { wireframe: false, settle, done: false };
}
