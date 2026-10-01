/**
 * 저 혼자 깨어난 라디오가 깜빡이는 세기(0~1).
 *
 * 규칙적인 맥박으로 만들면 "표시등"이 되어 버린다. 여기서 필요한 건 도해가
 * 만지지도 않았는데 기계가 신호를 물고 있다는 이질감이라, 대부분 꺼져 있다가
 * 가끔 튀는 모양이어야 한다. 느린 파와 빠른 파를 겹쳐 음수 구간을 잘라내면
 * 값의 대부분이 0 근처에 눌리고 봉우리만 남는다.
 *
 * 시간의 순수 함수라 useFrame 밖에서도 검증할 수 있다 (.claude/rules/r3f.md).
 */
export function radioSignalLevel(time: number): number {
  const slow = Math.sin(time * 2.3);
  const fast = Math.sin(time * 11.7 + 1.3);
  const raw = slow * 0.6 + fast * 0.4;
  const gated = Math.max(0, raw);
  return gated * gated;
}

/** 깨어난 뒤 깜빡임이 제 세기에 닿기까지(초). 소리(radioWake)가 부풀어 오르는 길이와 맞춘다. */
const RADIO_WAKE_RAMP_S = 1.4;

/**
 * 깨어난 지 `elapsed`초 된 라디오의 깜빡임 배율(0~1). 정적 끝에 불빛이 탁 켜지면
 * 스위치를 켠 것처럼 보인다. 신호가 멀리서 잡혀 들어오듯 부드럽게 차오른다.
 */
export function radioWakeRamp(elapsed: number): number {
  const t = Math.min(1, Math.max(0, elapsed / RADIO_WAKE_RAMP_S));
  return t * t * (3 - 2 * t);
}
