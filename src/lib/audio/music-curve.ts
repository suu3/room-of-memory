/**
 * BGM을 방 밝기에 물리기 위한 순수 함수들. 실제 오디오 노드는 music.ts가 만들고,
 * 여기 있는 건 전부 브라우저 없이 테스트할 수 있는 계산이다.
 *
 * 바퀴마다 곡이 다르다. 1바퀴는 발랄한 곡 하나가 조사할수록 열화되고(컷오프가
 * 닫히고 볼륨이 빠지고 리버브가 늘어 멀어진다), 라디오 직전에는 거의 정적에
 * 닿는다. 그 정적 위에 전환 컷씬이 서고, 2바퀴는 **다른 따뜻한 곡**이 같은
 * 곡선을 거꾸로 타고 올라온다 (docs/story.md 6장).
 *
 * 곡을 가르는 이유는 컷씬의 정적이 사이에 있기 때문이다 — 같은 선율이 다시
 * 흐르면 "돌아왔다"가 되지만, 여기서 필요한 건 회복이 아니라 다른 데서 온
 * 온기라서 곡 자체가 바뀌는 편이 맞다. 곡 하나가 열화됐다 복원되는 예전 방식은
 * 정적을 건너뛰고 이어질 때만 값을 했다.
 *
 * 파일 자체는 절대 손대지 않는다 — 여기 있는 값은 전부 재생 시점 이펙트다.
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

/** 리버브에 보내는 비율. 가장 어두울 때(멀리) ↔ 가장 밝을 때(바로 앞). */
const REVERB_WET_MAX = 0.46;
const REVERB_WET_MIN = 0.08;

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

/**
 * 바닥 근처에서 곡을 마저 재우는 구간의 폭.
 *
 * 밝기 이 값 아래로는 볼륨이 급히 빠져 거의 정적에 닿는다. 1바퀴 마지막 관문
 * (라디오) 직전이 이 구간이다 — 여섯 개를 조사한 시점의 밝기가 0.09쯤이라
 * 그 자리에서 곡이 거의 들리지 않아야 재난방송의 정적이 산다.
 *
 * 구간 밖(0.25 위)은 손대지 않는다. 예전에 전 구간을 낮췄더니 배경으로도
 * 안 들렸다 — 조용해야 하는 건 바닥이지 중반이 아니다.
 */
const HUSH_BAND = 0.25;
/** 바닥에서 남기는 음량 비율. 0으로 두면 곡이 사라진 건지 꺼진 건지 모른다. */
const HUSH_FLOOR = 0.12;

/**
 * 밝기(0~1) → BGM 음량.
 *
 * 중반까지는 완만하게 빠지다가 바닥 근처(HUSH_BAND)에서 급히 재워진다.
 * 완전히 0이 되지는 않는다 — 그건 덕킹과 컷씬 정지가 할 일이다.
 */
export function musicVolume(level: number): number {
  const clamped = clamp01(level);
  const base = VOLUME_FLOOR + (VOLUME_CEILING - VOLUME_FLOOR) * clamped;
  const hush = HUSH_FLOOR + (1 - HUSH_FLOOR) * Math.min(1, clamped / HUSH_BAND);
  return base * hush;
}

/**
 * 밝기(0~1) → 리버브에 보내는 비율(0~1).
 *
 * 어두울수록 젖는다. 컷오프가 "벽 너머로 들린다"를 만든다면 이쪽은 "멀어진다"를
 * 만든다 — 둘을 같이 걸어야 곡이 작아지는 게 아니라 물러나는 것으로 들린다.
 * 밝을 때도 완전히 마르지는 않는다: 방 안에서 나는 소리라 잔향이 조금은 있다.
 */
export function musicReverb(level: number): number {
  const clamped = clamp01(level);
  return REVERB_WET_MAX + (REVERB_WET_MIN - REVERB_WET_MAX) * clamped;
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
