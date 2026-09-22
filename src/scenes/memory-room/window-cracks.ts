/**
 * 창 유리의 실금 (docs/visual-experiments.md 4장 "창문+커튼").
 *
 * 창밖의 붕괴(outsideDecay)는 되돌아가지 않는다. 알게 된 사실은 없던 일이 되지 않으니까.
 * 유리의 금도 같은 축을 탄다: 조사할수록 금이 하나씩 더 나고 길어지며, 2막에서도 그대로
 * 남는다. 굴절은 넣지 않는다. 직교 아이소메트릭에서 창은 작아서 금 자체만 보이면 된다.
 *
 * 금은 난수가 아니라 해시로 뽑는다. 새로고침마다 다른 자리에 나면 유리가 아니라 노이즈다.
 */

export interface CrackSegment {
  from: [number, number];
  to: [number, number];
  /** 0~1: 굵기·불투명도의 몫. 충격점 가까이가 굵다. */
  weight: number;
}

/** 금이 처음 나는 붕괴도. 첫 조사(1/7 ≈ 0.14) 뒤부터 보인다. */
export const CRACK_ONSET = 0.1;
/** 금의 최대 개수. 붕괴도 1에서 이만큼. */
export const CRACK_MAX_RAYS = 7;

function hash01(index: number, salt: number): number {
  const value = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

/** 붕괴도(0~1)에서 보이는 금의 수. */
export function crackCount(decay: number): number {
  const clamped = Math.min(1, Math.max(0, Number.isNaN(decay) ? 0 : decay));
  if (clamped < CRACK_ONSET) return 0;
  return Math.max(1, Math.round(((clamped - CRACK_ONSET) / (1 - CRACK_ONSET)) * CRACK_MAX_RAYS));
}

/**
 * 금을 선분으로 푼다. 좌표는 유리의 정규화 좌표(0~1, 왼쪽 아래 원점).
 *
 * 충격점 하나에서 뻗는 방사선이다. 각 금은 몇 마디로 꺾이고, 마디마다 조금씩 튄다.
 * 길이는 붕괴도를 따른다: 방금 난 금은 짧고, 다 번진 금은 유리 끝까지 간다.
 */
export function crackSegments(decay: number): CrackSegment[] {
  const count = crackCount(decay);
  if (count === 0) return [];
  const clamped = Math.min(1, decay);
  const impact: [number, number] = [0.62, 0.36];
  const segments: CrackSegment[] = [];
  for (let ray = 0; ray < count; ray += 1) {
    const angle = (ray / CRACK_MAX_RAYS) * Math.PI * 2 + hash01(ray, 1) * 0.5;
    const reach = (0.18 + 0.5 * clamped) * (0.7 + hash01(ray, 2) * 0.6);
    const joints = 3;
    let from: [number, number] = impact;
    for (let joint = 1; joint <= joints; joint += 1) {
      const t = joint / joints;
      const wobble = (hash01(ray * 7 + joint, 3) - 0.5) * 0.35;
      const to: [number, number] = [
        impact[0] + Math.cos(angle + wobble) * reach * t,
        impact[1] + Math.sin(angle + wobble) * reach * t,
      ];
      segments.push({ from, to, weight: 1 - (t - 1 / joints) });
      from = to;
    }
  }
  return segments;
}
