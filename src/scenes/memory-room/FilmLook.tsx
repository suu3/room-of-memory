"use client";

import { useFrame } from "@react-three/fiber";
import { BlendFunction, ChromaticAberrationEffect, NoiseEffect } from "postprocessing";
import { useEffect, useMemo, useRef } from "react";
import { MathUtils, Vector2 } from "three";
import { selectRadioSignaling, useMemoryRoomStore } from "@/store/memory-room";
import {
  ABERRATION,
  ABERRATION_PULSE,
  aberrationAmount,
  decayPulse,
  FILM_GRAIN_OPACITY,
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
/** 모션을 끈 사람인가. 테스트 환경(jsdom)에는 matchMedia가 없어 false로 본다. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

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
 * 색수차의 양을 프레임마다 굴린다. 컴포저 밖 어디에 있어도 된다: 그리는 것이 없다.
 *
 * @param dim 어둠의 양 (0 = 밝은 방, 1 = 가장 어두운 지점). 비네트와 같은 축이다.
 */
export function FilmAberrationDriver({
  effect,
  dim,
  reducedMotion,
}: {
  effect: ChromaticAberrationEffect;
  dim: number;
  reducedMotion: boolean;
}) {
  const motion = useRef({ resting: restingAberration(dim), pulse: 0 });

  // 사건은 스토어 변화에서 듣는다. 호출부마다 심는 대신 한곳에서 (audio의 collect와 같은 자리).
  useEffect(() => {
    if (reducedMotion) return;
    return useMemoryRoomStore.subscribe((state, previous) => {
      const current = motion.current;
      if (state.collected.length > previous.collected.length) {
        current.pulse = Math.max(current.pulse, ABERRATION_PULSE.collect);
      }
      if (selectRadioSignaling(state) && !selectRadioSignaling(previous)) {
        current.pulse = Math.max(current.pulse, ABERRATION_PULSE.radioWake);
      }
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
    const amount = aberrationAmount(current.resting, current.pulse);
    effect.offset.set(amount, amount * ABERRATION.aspect);
  });

  return null;
}
