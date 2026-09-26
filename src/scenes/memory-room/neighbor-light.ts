import { MathUtils } from "three";
import type { MemoryId } from "@/data/memory-room";

/**
 * 창밖 맞은편 동의 불 켜진 창 하나 (docs/visual-experiments.md 14장 "이창").
 *
 * 창밖은 하늘 그라디언트와 별뿐이다. 도시 실루엣을 세워 봤다가 창 하나가 그림이 되어
 * 뺐다 (WindowView 주석). 그 위에 얹는 것은 작은 색면 하나다: 생존자 방송을 듣고 나면
 * 맞은편 어둠 속에 창 하나가 켜진다. "누군가 살아 있다"를 대사 없이 말하는 그림이고,
 * 방송이 동네 안에서 오는 약한 FM이라는 설정(docs/story.md)과 같은 말이다.
 *
 * 창밖 붕괴도(outsideDecay)처럼 되돌아가지 않는다. 켜진 뒤에는 끝까지 켜져 있다.
 * 여기는 그 셈만 둔다: 언제 켜지는가, 어디에 서는가, 얼마나 천천히 차오르는가.
 */
export const NEIGHBOR_LIGHT = {
  /** 창 하나의 크기(월드 유닛). 별(0.012~0.026)보다 크되 창 개구부(2.84×2.4)의 한 뼘이다. 0.11×0.15로는 놀이 배율에서 별과 구분이 안 됐다. */
  size: [0.16, 0.22] as readonly [number, number],
  /** 창을 감싸는 번짐 판의 배율과 불투명도. 색면이 유리 너머의 빛으로 읽히게 하는 최소치. */
  halo: 2.8,
  haloOpacity: 0.16,
  /** 켜진 뒤 차오르는 속도(damp lambda). 0.45면 8초쯤에 거의 다 켜진다. 스위치가 아니라 저녁이 오듯. */
  lambda: 0.45,
} as const;

/**
 * 창 개구부 중심 기준 자리. 아이소메트릭 카메라가 창을 비스듬히 내려다봐서 개구부를 통해
 * 보이는 배경막의 지점이 왼쪽·아래로 밀린다 (WindowView의 MARGIN이 그쪽에 큰 이유).
 * 그 밀린 만큼 왼쪽·아래에 두어야 기본 시점에서 개구부 가운데쯤에 보인다. 지평선 띠(볕이
 * 남은 아래쪽 색)에 서야 "건너편 건물"로 읽힌다: 별 사이에 두면 별 하나가 더 큰 것뿐이다.
 */
export function neighborLightOffset(opening: {
  width: number;
  height: number;
}): readonly [x: number, y: number] {
  return [-opening.width * 0.16, -opening.height * 0.2];
}

/** 생존자 방송을 들었는가 (라디오 2차). 스토어의 selectHeardSurvivorBroadcast와 같은 판정이다. */
export function neighborLightVisible(state: { revisited: readonly MemoryId[] }): boolean {
  return state.revisited.includes("radio" as MemoryId);
}

/**
 * 프레임마다 불투명도를 한 걸음 옮긴다. 켜지면 1로 damp, 꺼져 있으면 0.
 * `instant`는 모션을 끈 사람의 몫: 차오르는 과정 없이 바로 켠다.
 */
export function neighborLightOpacity(
  current: number,
  lit: boolean,
  delta: number,
  instant = false,
): number {
  const goal = lit ? 1 : 0;
  if (instant) return goal;
  if (!Number.isFinite(delta) || delta < 0) return current;
  return MathUtils.clamp(MathUtils.damp(current, goal, NEIGHBOR_LIGHT.lambda, delta), 0, 1);
}
