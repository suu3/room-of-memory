/**
 * 화장실 거울의 slit-scan (docs/visual-experiments.md 11장 "slit-scan (시계) → 화장실 거울").
 *
 * 거울의 반사를 매번 화면에 바로 내지 않고 링버퍼에 쌓아 두고, 유리의 세로줄마다 다른
 * 과거 프레임을 내보인다. 왼쪽 줄은 지금, 오른쪽으로 갈수록 오래된 프레임이라 앞에 선
 * 사람이 움직이면 얼굴이 시간 방향으로 번진다. 30일 만에 보는 자기 얼굴이 제 얼굴로
 * 안 읽히는 그림이다. 2막이 진행될수록(볕 warm이 오를수록) 줄이 맞아 들어 보통 거울이 된다.
 *
 * 여기는 그 셈만 둔다: 어느 줄이 링의 어느 칸을 읽는가, 진행도가 어느 폭을 주는가.
 * 셰이더가 같은 식을 GLSL로 다시 쓰므로, 식을 고치면 SlitScanMirror의 프래그먼트도 같이
 * 고쳐야 한다. 브라우저 없이 시험하기 위해 순수 함수로 뗐다 (film-look.ts와 같은 관례).
 */
export const SLIT_SCAN = {
  /**
   * 링버퍼에 쌓는 프레임 수. 반사를 3프레임에 1번 찍으므로 12칸이면 60fps에서 0.6초쯤의
   * 과거가 유리 폭에 펼쳐진다. 더 길면 프레임 하나가 3MB(256² 반정밀)라 메모리가 든다.
   */
  ringSize: 12,
  /**
   * 유리를 가르는 세로줄 수. 링보다 촘촘해서 최대 폭에서는 이웃한 두 줄이 같은 프레임을
   * 나눠 갖는다. 링과 같은 수로 두면 줄 하나가 손바닥 폭(7cm)이라 "줄"이 아니라 "판"으로 읽힌다.
   */
  columns: 24,
} as const;

/**
 * 지금 볕의 양에서 시간차의 폭 (0~1). 1막(warm 0)은 온폭, 2막 완주(warm 1)는 0.
 * 범위 밖은 끝값에 붙는다. 선형이다: 회복도 자체가 이미 이야기의 곡선이라 여기서 또 휘지 않는다.
 */
export function smearFromWarm(warm: number): number {
  return 1 - Math.min(1, Math.max(0, warm));
}

/**
 * 지금 프레임의 시간차 폭 목표. 세면대 앞에 서 있을 때만 어긋나고, 떨어져 있으면 보통 거울(0)이다.
 *
 * 이 거울은 늘 서 있는 왼쪽 벽에 걸려 있어 화장실에 있는 내내 화면에 든다. 방 저편에서
 * 보는 어긋난 반사는 "30일 만에 보는 제 얼굴"이 아니라 그냥 깨진 텍스처로 읽혔다.
 * 얼굴이 비칠 만큼 다가섰을 때만 어긋나야 그 그림이 된다. 전환은 SlitScanMirror의 damp가 맡는다.
 */
export function smearFor(warm: number, nearSink: boolean): number {
  return nearSink ? smearFromWarm(warm) : 0;
}

/**
 * 한 세로줄이 읽을 링의 칸 번호.
 *
 * - `column`: 왼쪽부터 0 .. columns-1
 * - `writeIndex`: 다음에 쓸 칸. 가장 최근 프레임은 그 앞 칸(writeIndex - 1)이다
 * - `smear`: 시간차 폭. 0이면 모든 줄이 최근 프레임이라 보통 거울, 1이면 오른쪽 끝 줄이
 *   링에서 가장 오래된 칸(ringSize - 1 프레임 전)을 읽는다
 *
 * 줄 위치를 0~1로 펴고 폭을 곱해 "몇 프레임 전"인지를 반올림으로 정한다. 반올림이라
 * 폭이 조금만 있어도 오른쪽 몇 줄은 한 프레임 전을 읽는다: 폭이 0에 닿기 직전까지
 * 줄이 남아 있다가 마지막에 맞아 든다.
 */
export function slitFrameIndex(
  column: number,
  columns: number,
  writeIndex: number,
  ringSize: number,
  smear: number,
): number {
  const clampedColumn = Math.min(Math.max(0, Math.floor(column)), columns - 1);
  const spread = columns <= 1 ? 0 : clampedColumn / (columns - 1);
  const width = Math.min(1, Math.max(0, smear));
  const delay = Math.round(spread * width * (ringSize - 1));
  return (((writeIndex - 1 - delay) % ringSize) + ringSize) % ringSize;
}
