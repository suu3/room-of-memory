import {
  packedForExit,
  SIGNAL_MEMORY,
  type StoryProgress,
  signalSilence,
  storyPhaseOf,
} from "./story-phase";

/**
 * 상단 독백의 구간 id. content/stages.yaml의 키와 같아야 한다
 * (scripts/content/schema.mjs의 STAGE_IDS가 그걸 검증한다).
 *
 * 페이즈(v4 설계서 1-1)로 갈리고, 1페이즈 안에서는 강도 단계로 한 번 더 갈린다.
 * 페이즈 독백(p2 "나흘 밤 안에 가야 해." 등)은 그 페이즈에 들어서는 순간 한 번 찍히고,
 * 페이즈가 이어지는 동안 그대로 걸려 있다. 방송부터 현관까지 하루 안의 일이라 날을 세지 않는다.
 */
export const MONOLOGUE_IDS = [
  "p0-dark",
  "p1-0",
  "p1-mid",
  "p1-late",
  "turn-silence",
  "turn-bottom",
  "turn-signal",
  "p2-enter",
  "p3-enter",
  "p4-enter",
  "resolve",
  "resolve-ready",
] as const;
export type MonologueId = (typeof MONOLOGUE_IDS)[number];

/** 1페이즈에서 강도 2에 들어섰다고 보는 수: 강도 0(성적표) 하나와 강도 1(게임기·공) 둘을 다 봤다. */
const P1_MID_AT = 3;
/** 강도 3에 들어섰다고 보는 수: 강도 2까지 다섯을 봤다. */
const P1_LATE_AT = 5;

/** 지금 화면 상단에 걸릴 독백. */
export function monologueIdFor(state: StoryProgress): MonologueId {
  const phase = storyPhaseOf(state);
  switch (phase) {
    case "intro":
      return "p0-dark";
    case "p1": {
      const collected = state.collected.length;
      if (collected >= P1_LATE_AT) return "p1-late";
      if (collected >= P1_MID_AT) return "p1-mid";
      return "p1-0";
    }
    case "turning":
      // 생존자 방송을 들었다(라디오 2차) = 문이 금빛이다
      if (state.revisited.includes(SIGNAL_MEMORY)) return "turn-signal";
      // 과거편에서 막 돌아와 신호가 잡히기 전: 라디오를 끄고 가라앉는 한 줄
      return signalSilence(state) ? "turn-silence" : "turn-bottom";
    case "p2":
      return "p2-enter";
    case "p3":
      return "p3-enter";
    case "p4":
      return "p4-enter";
    default:
      // 챙길 것 셋(가방·앰플·배트)을 다 챙기면 "…가자."로 바뀐다
      return packedForExit(state) ? "resolve-ready" : "resolve";
  }
}
