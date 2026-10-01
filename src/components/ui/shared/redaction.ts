/**
 * 지워지거나 깨진 글자 (docs/direction/visual-experiments.md 11장 "깨진 글리프").
 *
 * 안방 책상의 연구 서류는 몇 단어를 읽을 수 없다. hover로 되살리는 것도, 다시 보면
 * 나타나는 것도 없다: 읽을 수 없다는 것이 이야기다. 그래서 여기는 시간을 모르는
 * 순수 함수고, 같은 줄을 몇 번 그려도 같은 자리가 깨진다. Math.random은 없다.
 *
 * 규칙은 언어를 타지 않는다. 깨질 자리는 줄 길이에 대한 비율로 정하므로 ko/en/ja가
 * 글자 수가 달라도 같은 상대 위치에서 깨진다. 흩어진 낱글자가 아니라 2~5자 뭉치로
 * 깨뜨린다: 뭉치는 번진 단어로 읽히고 낱글자는 오타로 읽힌다. 공백은 깨뜨리지
 * 않는다. 줄바꿈 기회를 빼앗지 않기 위해서고, 지워진 단어 사이의 띄어쓰기가 남아
 * 있어야 "단어가 있었다"가 보인다.
 */

/** 한 줄을 그대로 이어 붙이면 원문 길이가 되는 조각. broken이면 text는 블록 문자다. */
export interface RedactedSegment {
  text: string;
  broken: boolean;
}

/** 깨진 글자 자리에 서는 유니코드 블록 문자. 셋이 섞이면 잉크가 고르지 않게 번진 것처럼 읽힌다. */
export const BROKEN_GLYPHS = ["▒", "░", "▓"] as const;

/** 한 뭉치의 글자 수. 이 아래는 오타로, 이 위는 검열로 읽힌다. */
export const RUN_MIN = 2;
export const RUN_MAX = 5;

/** 안방 연구 서류에 적용하는 비율. 문장을 못 읽을 만큼은 아니고 몇 단어를 잃을 만큼. */
export const RESEARCH_REDACTION_RATIO = 0.22;

/**
 * 뭉치 후보를 세우는 횟수의 여유. 후보는 줄 위에 고르게 흩어지지만 공백이나 이미 깨진
 * 자리에 떨어지면 버려지므로, 목표 글자 수의 몇 배는 시도해야 비율이 찬다.
 */
const CANDIDATE_SLACK = 4;

/**
 * 정수 몇 개를 32비트 해시 하나로 섞는다 (FNV로 흡수, murmur3 fmix32로 마무리).
 * 인접한 입력(줄 0과 1, 자리 3과 4)이 전혀 다른 값을 내야 깨진 자리가 줄마다 다르게 보인다.
 * 마무리 섞기가 약하면 윗비트가 안 흩어져 [0, 1)로 읽은 값이 0 근처에 몰린다.
 */
function mix(...values: number[]): number {
  let h = 0x811c9dc5;
  for (const value of values) {
    h = Math.imul(h ^ (value | 0), 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** 위 해시를 [0, 1)로. */
function hash01(...values: number[]): number {
  return mix(...values) / 0x100000000;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, Number.isNaN(value) ? 0 : value));
}

function isWhitespace(char: string): boolean {
  return /\s/u.test(char);
}

/**
 * 뭉치 k번째의 출발 위치(0~1). 줄마다 한 번 뽑은 시작점에서 황금비 걸음으로 나아가는
 * 저불일치 수열이라 후보가 줄 위에 고르게 흩어진다. 순수한 난수면 같은 자리를 여러 번
 * 치고 빈 자리를 오래 못 찾는다. 글자 수가 아니라 비율이라 언어를 타지 않는다.
 */
function anchorFraction(lineIndex: number, k: number): number {
  const origin = hash01(lineIndex, 0x5eed);
  return (origin + k * 0.618033988749895) % 1;
}

/**
 * 한 줄의 글자 일부를 깨뜨린다.
 *
 * `ratio`(0~1)는 깨질 글자의 비율. 실제로 깨지는 수는 목표를 넘지 않고, 공백 때문에
 * 뭉치가 잘리면 조금 모자랄 수 있다. 뭉치 사이에는 멀쩡한 글자가 적어도 하나 있어
 * 두 뭉치가 붙어 긴 검열 막대가 되지 않는다. 글자 수(코드 포인트)는 보존된다:
 * 깨진 글자는 하나당 블록 문자 하나로 바뀐다.
 *
 * 돌려주는 조각을 순서대로 이으면 원문 길이의 문자열이고, ratio 0이면 원문 그대로인
 * 조각 하나다.
 */
export function redactLine(text: string, lineIndex: number, ratio: number): RedactedSegment[] {
  const chars = Array.from(text);
  const count = chars.length;
  const target = Math.round(clamp01(ratio) * count);
  if (count === 0 || target < RUN_MIN) return [{ text, broken: false }];

  const broken = new Array<boolean>(count).fill(false);
  let brokenCount = 0;
  const attempts = target * CANDIDATE_SLACK + RUN_MAX * CANDIDATE_SLACK;

  for (let k = 0; k < attempts && target - brokenCount >= RUN_MIN; k += 1) {
    // 출발점이 공백이면 다음 글자로 미룬다: 공백만 깨진 뭉치는 안 생긴다
    let start = Math.floor(anchorFraction(lineIndex, k) * count);
    while (start < count && isWhitespace(chars[start])) start += 1;
    if (start >= count || broken[start]) continue;
    // 바로 앞이 깨져 있으면 이어 붙는 꼴이라 버린다
    if (start > 0 && broken[start - 1]) continue;

    const remaining = target - brokenCount;
    const wanted = Math.min(
      RUN_MIN + Math.floor(hash01(lineIndex, k, 1) * (RUN_MAX - RUN_MIN + 1)),
      remaining,
    );

    // 공백·이미 깨진 글자·다음 뭉치의 앞에서 멈춘다. 뭉치는 한 단어 안에 머문다
    let end = start;
    while (
      end < count &&
      end - start < wanted &&
      !isWhitespace(chars[end]) &&
      !broken[end] &&
      !(end + 1 < count && broken[end + 1])
    ) {
      end += 1;
    }
    if (end - start < RUN_MIN) continue;

    for (let i = start; i < end; i += 1) {
      broken[i] = true;
      chars[i] = BROKEN_GLYPHS[mix(lineIndex, i, 2) % BROKEN_GLYPHS.length];
    }
    brokenCount += end - start;
  }

  // 같은 상태의 글자를 조각 하나로 잇는다
  const segments: RedactedSegment[] = [];
  for (let i = 0; i < count; i += 1) {
    const last = segments[segments.length - 1];
    if (last && last.broken === broken[i]) last.text += chars[i];
    else segments.push({ text: chars[i], broken: broken[i] });
  }
  return segments;
}
