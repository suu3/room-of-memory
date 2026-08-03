/**
 * BGM을 방 밝기에 물리기 위한 순수 함수들. 실제 오디오 노드는 music.ts가 만들고,
 * 여기 있는 건 전부 브라우저 없이 테스트할 수 있는 계산이다.
 *
 * 곡은 하나뿐이다. 기획의 V자 감정선(평범 → 어둠 → 희망)은 곡을 갈아끼워서가 아니라
 * 이 곡에 걸린 로우패스가 닫혔다 열리면서 표현된다 — 하강과 상승에 같은 선율이
 * 흐르는 게 "돌아왔다"는 인상을 만든다 (docs/content-design.md 3장).
 */

/**
 * 가장 어두운 지점의 컷오프(Hz). 벽 너머에서 새어 들어오는 정도.
 * 320까지 내렸더니 진입 구간(0.62)에서도 이미 웅웅거려 곡이 안 들렸다.
 */
const CUTOFF_FLOOR = 460;
/** 완전히 열린 컷오프(Hz). 사실상 필터가 없는 것과 같다. */
const CUTOFF_CEILING = 16_000;

/**
 * BGM 자체 음량 범위. 효과음(voices.ts)보다는 아래여야 하지만, 처음 잡았던
 * 0.16~0.34는 배경으로도 안 들릴 만큼 작았다.
 */
const VOLUME_FLOOR = 0.3;
const VOLUME_CEILING = 0.46;

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/**
 * 밝기(0~1) → 로우패스 컷오프(Hz).
 *
 * 사람 귀는 주파수를 로그로 듣기 때문에 선형 보간하면 밝은 구간에서만 변화가
 * 느껴진다. 지수 보간이라야 밝기가 고르게 열리는 것처럼 들린다.
 */
export function musicCutoff(level: number): number {
  const clamped = clamp01(level);
  return CUTOFF_FLOOR * (CUTOFF_CEILING / CUTOFF_FLOOR) ** clamped;
}

/** 밝기(0~1) → BGM 음량. 어두울 때 아주 꺼지지는 않는다 — 그건 덕킹이 할 일이다. */
export function musicVolume(level: number): number {
  const clamped = clamp01(level);
  return VOLUME_FLOOR + (VOLUME_CEILING - VOLUME_FLOOR) * clamped;
}

/**
 * 루프 이음새에 크로스페이드를 미리 구워 넣는다.
 *
 * 솔로 피아노는 마지막 화음이 해소되고 끝나기 때문에, 그냥 `loop = true`로 돌리면
 * 끝과 시작이 맞부딪혀 "뚝" 끊긴다. 재생 중에 두 소스를 겹치는 방법도 있지만
 * 스케줄링이 복잡하고 탭이 백그라운드로 가면 어긋난다. 대신 버퍼를 만들 때
 * 꼬리를 머리 위에 접어두면, 이후에는 브라우저의 네이티브 루프가 알아서 이어준다.
 *
 * 반환 길이는 `source.length - fade`다. 접힌 구간이 곧 새 루프의 시작점이 된다.
 */
export function foldLoopTail(source: Float32Array, fade: number): Float32Array<ArrayBuffer> {
  const width = Math.min(Math.max(Math.floor(fade), 0), Math.floor(source.length / 3));
  if (width <= 0) return Float32Array.from(source);

  const length = source.length - width;
  const folded = Float32Array.from(source.subarray(0, length));
  for (let index = 0; index < width; index += 1) {
    // 등출력(equal-power) 곡선 — 선형으로 섞으면 겹치는 구간의 음량이 파인다.
    const angle = ((index / width) * Math.PI) / 2;
    folded[index] = folded[index] * Math.sin(angle) + source[length + index] * Math.cos(angle);
  }
  return folded;
}
