/**
 * 가만히 서 있을 때 몸이 향할 방향 (Player ↔ 자리의 다리).
 *
 * 스토어를 거치지 않는다: 프레임마다 읽는 값이고, 바뀌는 건 자리에 들어서고 나설 때뿐이다.
 * 자리(지금은 화장실 세면대뿐)가 `yaw`를 놓고, Player가 걷지도 앉지도 않는 동안 몸을
 * 그쪽으로 돌린다. 걷기 시작하면 가는 쪽이 이긴다. null이면 아무것도 하지 않는다.
 *
 * yaw는 Player의 facing과 같은 축이다: atan2(dx, dz). -x를 보면 -π/2.
 */
export const idleFacing: { yaw: number | null } = { yaw: null };
