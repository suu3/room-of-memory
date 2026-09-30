/**
 * 기억 오브젝트의 "손맛": 호버·클릭 반응의 순수 계산.
 *
 * 아웃라인 글로우만으로는 무엇을 눌렀는지 몸으로 안 느껴진다. 호버하면 살짝
 * 떠오르고, 누르는 순간 한 번 눌렸다 튀어오르게 한다. 값 계산을 여기 모아
 * 컴포넌트는 ref에 꽂기만 한다 (useFrame 안에서 setState 금지: r3f 규칙).
 */

/** 호버 시 떠오르는 높이(월드 단위). 크면 물건이 날아다니는 것처럼 보인다. */
export const HOVER_LIFT = 0.05;
/** 호버 시 커지는 비율. */
export const HOVER_SCALE = 0.045;
/** 호버 상태가 붙고 빠지는 damp lambda. */
export const HOVER_LAMBDA = 10;
/** 클릭 펀치가 완전히 사라지기까지 걸리는 시간(초). */
export const PUNCH_DURATION = 0.42;
/** 펀치가 눌러 들어가는 최대 깊이(스케일 비율). */
const PUNCH_DEPTH = 0.16;

/**
 * 클릭 펀치의 스케일 배수. 0에서 시작해 한 번 쑥 눌렸다가 살짝 넘겨 튀고 1로 돌아온다.
 *
 * 감쇠 사인파를 쓰면 "눌림 → 되튐 → 정지"가 한 식으로 나온다. 시간이 지나면
 * 값이 정확히 1로 수렴하므로 애니메이션이 끝났는지 따로 관리할 필요가 없다.
 *
 * @param elapsed 클릭 이후 경과 시간(초)
 */
export function punchScale(elapsed: number): number {
  if (elapsed <= 0 || elapsed >= PUNCH_DURATION) return 1;
  const progress = elapsed / PUNCH_DURATION;
  const decay = 1 - progress;
  return 1 - PUNCH_DEPTH * Math.sin(progress * Math.PI * 2) * decay * decay;
}

export interface MemoryMotion {
  /** 오브젝트에 곱할 스케일 배수. */
  scale: number;
  /** 오브젝트를 띄울 높이(월드 단위). */
  lift: number;
}

/**
 * 호버 강도(0~1)와 클릭 경과 시간으로 최종 변형을 만든다.
 *
 * 잠긴(available이 아닌) 오브젝트는 아예 반응하지 않는다. 반응하면 "누를 수 있다"는
 * 잘못된 신호가 된다.
 */
export function memoryMotion(
  hover: number,
  punchElapsed: number,
  // 프레임마다 부르는 쪽은 제 스크래치를 넘겨 새 객체를 만들지 않는다
  out: MemoryMotion = { scale: 1, lift: 0 },
): MemoryMotion {
  out.scale = (1 + HOVER_SCALE * hover) * punchScale(punchElapsed);
  out.lift = HOVER_LIFT * hover;
  return out;
}

/** damp 한 스텝. three의 MathUtils.damp와 같은 식이라 프레임레이트에 안 흔들린다. */
export function approach(current: number, target: number, lambda: number, delta: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * delta));
}
