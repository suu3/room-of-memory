/**
 * 틸트 시프트: 방이 디오라마로 읽히게 하는 초점 띠의 수치 (docs/visual-experiments.md 6장,
 * 앉기 초점은 11장).
 *
 * 직교 아이소메트릭 카메라라 진짜 피사계 심도는 없다. 화면 공간의 띠 하나가 초점이고,
 * 띠 밖이 흐려진다. 1막은 띠가 좁고 흐림이 세다(닫힌 모형). 2막부터는 공간이 넷으로
 * 늘고 걸어 다니는 시간이 길어 띠를 넓히고 흐림을 낮춘다.
 *
 * 앉으면 띠가 앉은 눈높이로 내려오고 더 좁아진다. 앉아서 보는 방이다. 앉기는 진행에
 * 아무것도 남기지 않는 곁가지라 이게 유일한 시각 보상이다.
 */
import type { Act } from "@/store/memory-room";

export interface TiltFocus {
  /** 흐림의 양 (0~1). */
  blur: number;
  /** 띠의 가장자리에서 흐림이 번지는 폭 (0~1). */
  taper: number;
  /** 초점 띠의 시작과 끝 (화면 y, 0 = 아래, 1 = 위). */
  start: [number, number];
  end: [number, number];
}

/** 1막: 좁은 띠, 센 흐림. 2·3막: 넓은 띠, 옅은 흐림. */
const BY_ACT: Record<Act, Pick<TiltFocus, "blur" | "taper">> = {
  1: { blur: 0.28, taper: 0.55 },
  2: { blur: 0.14, taper: 0.7 },
  3: { blur: 0.14, taper: 0.7 },
};

/** 서 있을 때 띠의 중심(화면 높이 비율)과 반폭. 카메라가 플레이어를 따라오므로 가운데다. */
const STANDING = { center: 0.5, half: 0.2 } as const;
/** 앉았을 때: 눈높이가 내려온 만큼 띠도 내려오고, 반폭은 줄어든다. */
const SEATED = { center: 0.42, half: 0.11 } as const;

export function tiltFocus(act: Act, seated: boolean): TiltFocus {
  const band = seated ? SEATED : STANDING;
  const { blur, taper } = BY_ACT[act];
  return {
    blur: seated ? blur * 1.6 : blur,
    taper,
    start: [0, band.center - band.half],
    end: [0, band.center + band.half],
  };
}
