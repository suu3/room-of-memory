import type { OnboardingStep, Viewpoint } from "@/store/memory-room";

/** 목표 줄을 고르는 데 드는 진행 상태. 전부 스토어 셀렉터가 낸 파생값이다. */
export type GuideState = {
  viewpoint: Viewpoint;
  exitReady: boolean;
  packing: boolean;
  doorOpened: boolean;
  doorReady: boolean;
  onboarding: OnboardingStep | null;
};

/** 아무 규칙에도 안 걸릴 때의 목표: 빛나는 물건을 조사한다. */
const FALLBACK_KEY = "hud.guide.examine";

/**
 * 목표 줄의 우선순위 표. 위에서부터 보고 처음 맞는 줄이 이긴다.
 *
 * 순서가 곧 규칙이다. 1인칭 구간(스위치·문간)이 무엇보다 앞서고, 그 뒤는 이야기의
 * 끝에서부터 거슬러 온다: 뒤 단계의 조건이 서면 앞 단계의 조건도 대개 같이 서 있어서
 * (현관이 열렸으면 방문도 열려 있다) 늦은 쪽을 먼저 봐야 한다.
 */
const GUIDE_RULES = [
  { key: "hud.guide.lights", when: (state) => state.viewpoint === "intro" },
  { key: "hud.guide.doorway", when: (state) => state.viewpoint === "doorway" },
  { key: "hud.guide.exit", when: (state) => state.exitReady },
  { key: "hud.guide.pack", when: (state) => state.packing },
  { key: "hud.guide.revisit", when: (state) => state.doorOpened },
  { key: "hud.guide.door", when: (state) => state.doorReady },
  { key: "hud.guide.workbook", when: (state) => state.onboarding === "workbook" },
  { key: "hud.guide.notebook", when: (state) => state.onboarding === "notebook" },
] as const satisfies readonly { key: string; when: (state: GuideState) => boolean }[];

export type GuideKey = (typeof GUIDE_RULES)[number]["key"] | typeof FALLBACK_KEY;

/** 지금 띄울 목표 줄의 i18n 키. */
export function guideKeyOf(state: GuideState): GuideKey {
  return GUIDE_RULES.find((rule) => rule.when(state))?.key ?? FALLBACK_KEY;
}

/**
 * 뭉뚱그린 목표인가. 이지 모드는 이런 줄만 "어디의 무엇"으로 갈아 끼운다. 스위치·문간·
 * 배트·현관·방문·첫 두 걸음은 이미 한 가지를 짚고 있어 그대로 둔다.
 */
export function isGenericGuide(key: GuideKey): boolean {
  return key === "hud.guide.examine" || key === "hud.guide.revisit";
}
