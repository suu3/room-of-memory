import type { Vec2 } from "./spatial";
import type { Aabb2 } from "./types";

/*
 * 문간으로 빨려 들어가기.
 *
 * 문간은 몸 지름보다 조금 넓을 뿐이다. 방문을 예로 들면 문틀과 열린 문짝 사이에서
 * 몸 중심이 지날 수 있는 폭이 반 뼘 남짓이라, 조이스틱으로 그 선을 정확히 맞추지 못하면
 * 문틀에 막혀 서고, 비스듬히 밀면 문짝과 문틀 사이에 낀다. 클릭 이동은 길찾기가
 * 가운데로 데려가지만 손으로 미는 이동에는 그런 게 없었다.
 *
 * 그래서 문 앞에서 문을 지나는 쪽으로 밀고 있으면, 가로 방향을 통로 한가운데로 당긴다.
 * 문을 지나는 축은 문간 상자의 긴 쪽이다 (문간은 벽을 뚫고 양쪽 공간으로 뻗어 있다).
 */

/** 문간 상자 끝에서 이만큼 바깥까지 당기기 시작한다 (통과 축 방향, 월드 유닛). */
const APPROACH = 1.1;
/** 통로 폭 바깥으로 이만큼까지는 당긴다 (가로 방향). 문틀 모서리에 걸린 몸도 잡는다. */
const SIDE_MARGIN = 0.9;
/** 통과 축 입력이 전체 입력의 이 비율 이상일 때만 "문을 지나려 한다"로 본다. */
const MIN_ALONG_SHARE = 0.4;
/** 한 걸음에 가운데로 끌어오는 양의 상한 (그 걸음 길이 대비). */
const MAX_PULL = 0.6;
/** 가운데에서 벗어나는 쪽으로 미는 입력은 이만큼만 남긴다. 문짝 쪽으로 파고들지 않게. */
const AWAY_KEEP = 0.25;

/**
 * 이번 걸음(`delta`)을 문간 쪽으로 보정해 `out`에 쓴다. 해당하는 문간이 없으면 그대로 복사한다.
 * `out`은 `delta`와 같은 객체여도 된다.
 */
export function funnelIntoDoorway(
  position: Vec2,
  delta: Vec2,
  doorways: readonly Aabb2[],
  out: Vec2,
): Vec2 {
  const length = Math.hypot(delta.x, delta.z);
  let x = delta.x;
  let z = delta.z;

  if (length > 0) {
    for (const zone of doorways) {
      const alongX = zone.maxX - zone.minX >= zone.maxZ - zone.minZ;
      const pos = alongX ? position.x : position.z;
      const side = alongX ? position.z : position.x;
      const along = alongX ? x : z;
      const across = alongX ? z : x;
      const min = alongX ? zone.minX : zone.minZ;
      const max = alongX ? zone.maxX : zone.maxZ;
      const sideMin = alongX ? zone.minZ : zone.minX;
      const sideMax = alongX ? zone.maxZ : zone.maxX;

      if (pos < min - APPROACH || pos > max + APPROACH) continue;
      if (side < sideMin - SIDE_MARGIN || side > sideMax + SIDE_MARGIN) continue;
      if (Math.abs(along) < length * MIN_ALONG_SHARE) continue;
      // 문간 밖에서는 문 쪽으로 걸을 때만. 문을 등지고 걸어 나가는 몸은 놓아준다
      const inside = pos >= min && pos <= max;
      if (!inside && Math.sign(along) !== Math.sign((min + max) / 2 - pos)) continue;

      const offset = (sideMin + sideMax) / 2 - side;
      const pull = Math.sign(offset) * Math.min(Math.abs(offset), length * MAX_PULL);
      const kept = Math.sign(across) === -Math.sign(offset) ? across * AWAY_KEEP : across;
      const nextAcross = Math.max(-length, Math.min(length, kept + pull));
      if (alongX) z = nextAcross;
      else x = nextAcross;
      break;
    }
  }

  out.x = x;
  out.z = z;
  return out;
}
