"use client";

import { useMemo } from "react";
import { usePointerKind } from "@/i18n/control-hint";
import { prefersReducedMotion } from "@/lib/reduced-motion";
import { useEffectsStore } from "@/store/effects";

/**
 * 시각 실험 효과의 예산 등급 (docs/visual-experiments.md 9장).
 *
 * 미니게임 스킵이 useSkipEligible 한 곳에서 갈리는 것과 같은 이유로, 효과를 켤지 끌지는
 * 여기 한 곳이 정한다. 효과 컴포넌트는 `enabled`·`intensity`를 prop으로 받고 스토어를
 * 직접 읽지 않는다. 흩어지면 하나쯤은 반드시 폰에서 켜진 채 남는다.
 *
 *   off   모션을 끈 사람. 움직이는 효과는 전부 빠지고 지금 화면 그대로가 폴백이다
 *   low   프레임이 떨어진 기기, 또는 손가락으로 노는 기기. 싼 효과만 켠다
 *   full  나머지
 */
export type EffectTier = "off" | "low" | "full";

/** 효과 하나의 값. cheap은 uniform 몇 개·CSS 한 줄, heavy는 렌더 타깃이나 패스가 든다. */
export type EffectCost = "cheap" | "heavy";

export interface EffectBudgetInput {
  reducedMotion: boolean;
  degraded: boolean;
  touch: boolean;
}

export function effectTier({ reducedMotion, degraded, touch }: EffectBudgetInput): EffectTier {
  if (reducedMotion) return "off";
  if (degraded || touch) return "low";
  return "full";
}

/** 이 등급에서 이 값의 효과를 켤 수 있는가. */
export function effectEnabled(tier: EffectTier, cost: EffectCost): boolean {
  if (tier === "off") return false;
  if (tier === "low") return cost === "cheap";
  return true;
}

/** 지금 기기의 등급. 첫 렌더는 항상 full이다 (미디어 쿼리는 브라우저에만 있다). */
export function useEffectTier(): EffectTier {
  const reducedMotion = useMemo(prefersReducedMotion, []);
  const degraded = useEffectsStore((state) => state.degraded);
  const touch = usePointerKind() === "touch";
  return effectTier({ reducedMotion, degraded, touch });
}

/** `useEffectTier`와 `effectEnabled`를 한 번에: 호출부가 가장 자주 묻는 질문이다. */
export function useEffectEnabled(cost: EffectCost): boolean {
  return effectEnabled(useEffectTier(), cost);
}
