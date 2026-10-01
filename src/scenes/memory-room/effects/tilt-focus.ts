/**
 * 틸트 시프트: 방이 디오라마로 읽히게 하는 초점 띠의 수치 (docs/direction/visual-experiments.md 6장,
 * 앉기 초점은 11장).
 *
 * 직교 아이소메트릭 카메라라 진짜 피사계 심도는 없다. 화면 공간의 가로 띠 하나가 초점이고,
 * 띠 밖이 흐려진다. 1막은 띠가 좁고 흐림이 세다(닫힌 모형). 2막부터는 공간이 넷으로
 * 늘고 걸어 다니는 시간이 길어 띠를 넓히고 흐림을 낮춘다.
 *
 * 앉으면 띠가 앉은 눈높이로 내려오고 더 좁아진다. 앉아서 보는 방이다. 앉기는 진행에
 * 아무것도 남기지 않는 곁가지라 이게 유일한 시각 보상이다.
 *
 * 값은 postprocessing의 TiltShiftEffect가 받는 그대로다. 그 이펙트의 세로축은 화면 가운데가
 * 0, 위가 +1, 아래가 -1이다: `offset`이 띠의 중심, `focusArea`가 띠의 반폭, `feather`가 그
 * 안쪽에서 흐림이 번지기 시작하는 폭이다 (완전히 또렷한 심은 focusArea − feather).
 * 예전에는 래퍼(TiltShift2)의 `start`·`end`에 띠의 위아래를 넣었는데, 거기서 그 둘은 초점선의
 * 두 **점**이라 `[0, 0.3]→[0, 0.7]`은 왼쪽 가장자리를 지나는 세로선이 됐다. 화면 전체가
 * 오른쪽으로 갈수록 흐려지던 증상이 그것이다.
 */
import type { Act } from "@/store/memory-room";

export interface TiltFocus {
  /** 초점 띠의 중심 (화면 세로, −1 = 아래, 1 = 위). */
  offset: number;
  /** 띠의 반폭 (같은 축). 이 밖은 완전히 흐리다. */
  focusArea: number;
  /** 띠 안쪽에서 흐림이 번지기 시작하는 폭. 심(focusArea − feather)까지는 또렷하다. */
  feather: number;
  /** 흐림의 세기: 블러 패스의 scale (1 = 커널 그대로). */
  blurScale: number;
}

/**
 * 막마다의 흐림(0~1)과 번짐 비율. `taper`는 띠 반폭 중 흐림이 번지는 몫이다: 0.55면 띠의
 * 바깥 55%가 번지는 구간이고 안쪽 45%가 또렷한 심이다.
 */
const BY_ACT: Record<Act, { blur: number; taper: number }> = {
  1: { blur: 0.14, taper: 0.55 },
  2: { blur: 0.07, taper: 0.7 },
  3: { blur: 0.07, taper: 0.7 },
};

/**
 * 서 있을 때 띠의 중심(화면 높이 비율, 0 = 아래)과 반폭. 카메라가 플레이어를 따라오므로 가운데다.
 *
 * 처음 화면에서 본 값(반폭 0.2, 흐림 0.28)은 캐릭터 둘레만 남고 책상·침대가 다 뭉개져
 * "왜 캐릭터 빼고 다 흐리냐"로 읽혔다 (2026-09-27). 띠를 화면의 6할로 넓히고 흐림을 절반으로
 * 낮춰, 모형 느낌은 가장자리에만 남기고 방은 다 보이게 한다.
 */
const STANDING = { center: 0.5, half: 0.3 } as const;
/** 앉았을 때: 눈높이가 내려온 만큼 띠도 내려오고, 반폭은 줄어든다. */
const SEATED = { center: 0.42, half: 0.18 } as const;

/**
 * 흐림(0~1)을 블러 scale로 옮기는 배율. 커널 MEDIUM·반해상도에서 scale 0.28(1막)이면 화면
 * 위아래 가장자리가 부드럽게 물러나고, 0.14(2막)이면 흐린 걸 알아볼 만큼만 남는다.
 */
const BLUR_SCALE = 2;

export function tiltFocus(act: Act, seated: boolean): TiltFocus {
  const band = seated ? SEATED : STANDING;
  const { blur, taper } = BY_ACT[act];
  // 화면 비율(0~1)을 이펙트의 축(−1~1)으로: 중심은 2c−1, 폭은 두 배
  const focusArea = band.half * 2;
  return {
    offset: band.center * 2 - 1,
    focusArea,
    feather: focusArea * taper,
    blurScale: (seated ? blur * 1.6 : blur) * BLUR_SCALE,
  };
}
