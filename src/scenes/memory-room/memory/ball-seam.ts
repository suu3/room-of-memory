import { CatmullRomCurve3, TubeGeometry, Vector3 } from "three";

/*
 * 야구공 실밥이 지나갈 자리.
 *
 * ch1-baseball.glb 안에도 실밥 메쉬(BézierCurve, 진한 빨강)가 들어 있지만 그 메쉬를
 * 가리키는 node가 없어서 GLTFLoader가 씬 그래프에 올리지 않는다. node를 붙여 봐도
 * 정점의 평균 반지름이 0.57(공 반지름은 1)이라 대부분 공 속에 파묻힌다. 파일 안의
 * 실밥은 손볼 수 있는 상태가 아니다. 그래서 띠는 코드로 그린다.
 *
 * 다만 **자리는 파일이 정해 준다.** 구 표면에는 실밥이 지나갈 자리가 얕게 파여 있고
 * (홈 바닥 반지름 0.9894, 공 반지름 1), 그 홈의 정점을 뽑으면 64개가 한 줄로 이어진
 * 닫힌 고리다. 모양은 **반원 네 개**다. z = ±s 평면에 하나씩, y = ±s 평면에 하나씩,
 * 각각 반지름 s인 반원이 이어 붙는다 (s = 구 반지름 / √2). 실제 야구공의 8자 솔기가
 * 이렇게 생겼다.
 *
 * 예전에는 테니스공 솔기의 매끄러운 매개변수식
 *   x = a·cos t + b·cos 3t,  y = a·sin t − b·sin 3t,  z = 2√(ab)·sin 2t
 * 을 썼다. 이건 반원 네 개짜리 곡선과 아예 다른 곡선이라, 회전을 아무리 맞춰도 홈과
 * 겹치지 않는다. 최적 회전에서도 홈 정점까지 평균 0.059, 최대 0.168만큼 어긋난다
 * (공 반지름의 17%다). 그래서 빨간 띠가 파인 자리를 비껴 지나갔다.
 *
 * 반원의 끝 접선이 다음 반원의 시작 접선과 같아서 네 조각은 매끄럽게 붙는다.
 * 이어지는 자리에 모서리가 생기지 않는다.
 */

/** 공 표면에서 살짝 띄운다. 같은 반지름이면 면이 겹쳐 깜빡인다. */
export const SEAM_SURFACE_RADIUS = 1.012;
/** 반원 네 개가 놓이는 평면의 좌표. 곡선이 구면에 놓이려면 반지름/√2다. */
export const SEAM_PLANE = SEAM_SURFACE_RADIUS / Math.SQRT2;
export const SEAM_TUBE_RADIUS = 0.05;
/** 반원 하나당 표본 수. 네 조각이니 곡선 전체는 이 값의 네 배다. */
const SEAM_ARC_SAMPLES = 32;

/*
 * 네 반원. 조각마다 각이 0에서 π까지 돌고, 끝점은 다음 조각의 시작점과 같으므로
 * 표본에서 뺀다. 순서와 부호는 glb에서 뽑은 홈 정점 순서 그대로다.
 */
const SEAM_ARCS: ((angle: number, s: number) => Vector3)[] = [
  (angle, s) => new Vector3(s * Math.sin(angle), -s * Math.cos(angle), s),
  (angle, s) => new Vector3(-s * Math.sin(angle), s, s * Math.cos(angle)),
  (angle, s) => new Vector3(s * Math.sin(angle), s * Math.cos(angle), -s),
  (angle, s) => new Vector3(-s * Math.sin(angle), -s, -s * Math.cos(angle)),
];

/** 실밥 중심선 위의 점들. 닫힌 고리라 마지막 점 다음은 첫 점이다. */
export function ballSeamPoints(): Vector3[] {
  return SEAM_ARCS.flatMap((arc) =>
    Array.from({ length: SEAM_ARC_SAMPLES }, (_, index) =>
      arc((index / SEAM_ARC_SAMPLES) * Math.PI, SEAM_PLANE),
    ),
  );
}

export function ballSeamGeometry(): TubeGeometry {
  const points = ballSeamPoints();
  const curve = new CatmullRomCurve3(points, true, "catmullrom", 0.5);
  return new TubeGeometry(curve, points.length * 2, SEAM_TUBE_RADIUS, 6, true);
}
