"use client";

import { useFrame } from "@react-three/fiber";
import { BlendFunction, ChromaticAberrationEffect, NoiseEffect } from "postprocessing";
import { useEffect, useMemo, useRef } from "react";
import { MathUtils, Vector2 } from "three";
import { useMemoryRoomStore } from "@/store/memory-room";
import { subscribeEventPulse } from "./event-pulse";
import {
  ABERRATION,
  aberrationAmount,
  CLEAN_LAMBDA,
  decayPulse,
  FILM_GRAIN_OPACITY,
  grainOpacity,
  restingAberration,
} from "./film-look";

/**
 * 필름 룩: 화면 전체에 얹히는 그레인과 가장자리의 색수차 (DESIGN.md > Texture).
 *
 * 예전에는 그레인이 DOM(.film-grain)이었다. SVG 노이즈 타일 한 장을 overlay로 얹은
 * 것이라 결이 움직이지 않았고, 정지된 노이즈는 필름이 아니라 때 탄 유리로 읽혔다.
 * 셰이더 그레인은 프레임마다 다시 뿌려져서 필름의 결로 읽힌다. 캔버스 안의 패스라
 * 캔버스 밖 UI(대사창·HUD)에는 닿지 않는다: DESIGN.md의 "UI 패널 위에는 얹지
 * 않는다"를 구조로 지킨다.
 *
 * 색수차는 상태에 묶인다. 방이 어두울수록 조금 더 어긋나고, 라디오가 깨어나거나
 * 기억을 줍는 순간 잠깐 튀었다가 잦아든다. 상시 펄스는 두지 않는다 (DESIGN.md >
 * Motion: 반복적인 glow 금지).
 *
 * 컴포저에는 이 함수가 만든 인스턴스를 `<primitive>`로 넣는다. 래퍼 컴포넌트는 프롭을
 * JSON으로 비교해 인스턴스를 다시 만드는데, 프레임마다 바뀌는 값을 프롭으로 흘리면
 * 그 비교가 매 렌더 돌고, ref로 잡으면 순환 구조를 직렬화하려 든다. 인스턴스를
 * 직접 들고 uniform만 만지는 편이 r3f 규칙(useFrame에서 setState 금지)과도 맞다.
 */
export { prefersReducedMotion } from "@/lib/reduced-motion";

export function useFilmLookEffects(reducedMotion: boolean) {
  const effects = useMemo(() => {
    const aberration = new ChromaticAberrationEffect({
      offset: new Vector2(ABERRATION.base, ABERRATION.base * ABERRATION.aspect),
      radialModulation: true,
      modulationOffset: ABERRATION.modulationOffset,
    });
    // 모션을 끈 사람에게는 정지 그레인(.film-grain, motion-reduce에서만 보인다)이 남는다.
    // 프레임마다 뿌려지는 노이즈는 낮은 세기라도 깜빡임이다. SKIP은 셰이더에서 빠진다.
    const grain = new NoiseEffect({
      blendFunction: reducedMotion ? BlendFunction.SKIP : BlendFunction.OVERLAY,
    });
    grain.blendMode.opacity.value = FILM_GRAIN_OPACITY;
    return { aberration, grain };
  }, [reducedMotion]);

  useEffect(
    () => () => {
      effects.aberration.dispose();
      effects.grain.dispose();
    },
    [effects],
  );

  return effects;
}

/**
 * 색수차와 그레인의 양을 프레임마다 굴린다. 컴포저 밖 어디에 있어도 된다: 그리는 것이 없다.
 *
 * @param dim 어둠의 양 (0 = 밝은 방, 1 = 가장 어두운 지점). 비네트와 같은 축이다.
 */
export function FilmLookDriver({
  effects,
  dim,
  reducedMotion,
}: {
  effects: { aberration: ChromaticAberrationEffect; grain: NoiseEffect };
  dim: number;
  reducedMotion: boolean;
}) {
  const motion = useRef({ resting: restingAberration(dim), pulse: 0, clean: 0 });
  /*
   * 엔딩: 문이 열리는 동안 색수차와 그레인이 0으로 수렴한다. 게임 내내 얹혀 있던
   * 필름의 결이 처음으로 걷히는 순간이다 (docs/direction/visual-experiments.md 4장 배트).
   */
  const endingStarted = useMemoryRoomStore((state) => state.endingStarted);

  // 사건은 한곳(event-pulse)에서 듣는다. 카메라도 같은 펄스를 받는다.
  useEffect(() => {
    if (reducedMotion) return;
    return subscribeEventPulse((strength) => {
      motion.current.pulse = Math.max(motion.current.pulse, strength);
    });
  }, [reducedMotion]);

  useFrame((_, delta) => {
    const current = motion.current;
    // 쉬는 값은 조명처럼 천천히 따라가고, 튄 값은 곧바로 붙었다가 잦아든다
    current.resting = MathUtils.damp(
      current.resting,
      restingAberration(dim),
      ABERRATION.followLambda,
      delta,
    );
    current.pulse = decayPulse(current.pulse, delta);
    current.clean = MathUtils.damp(current.clean, endingStarted ? 1 : 0, CLEAN_LAMBDA, delta);
    const amount = aberrationAmount(current.resting, current.pulse, current.clean);
    effects.aberration.offset.set(amount, amount * ABERRATION.aspect);
    // 그레인도 같은 순간 잠깐 거칠어진다. 모션을 끈 판에서는 펄스가 없어 그대로다
    effects.grain.blendMode.opacity.value = grainOpacity(current.pulse, current.clean);
  });

  return null;
}
