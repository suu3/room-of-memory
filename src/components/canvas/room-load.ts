/**
 * 3D 에셋 로딩 진행률을 숫자 하나로 접는다.
 *
 * three의 로딩 매니저는 항목이 마운트될 때마다 큐에 붙기 때문에 total이 도중에
 * 늘어난다. 그래서 이 함수는 "지금 이 순간의 비율"만 내고, 뒤로 물러나지 않게
 * 붙드는 일은 스토어가 한다(setRoomLoadProgress는 값을 올리기만 한다). 바가
 * 되감기면 다 됐다고 생각한 사람이 다시 기다리게 된다.
 */
export function roomLoadFraction({
  loaded,
  total,
  active,
}: {
  loaded: number;
  total: number;
  /** 큐에 아직 받는 중인 항목이 있는가. */
  active: boolean;
}): number {
  // 큐가 비었는데 받은 게 있다 = 이번 묶음은 끝났다. loaded/total이 반올림 때문에
  // 0.999에 멈추는 일이 있어 완료는 따로 못을 박는다.
  if (!active && loaded > 0) return 1;
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, loaded / total));
}
