/**
 * 조사 차수와 이야기의 페이즈 (v4 설계서 1장).
 *
 * 페이즈는 저장하지 않는다. 진행 상태(무엇을 몇 차까지 봤는가, 어느 문이 열렸는가)
 * 에서 매번 파생된다. 저장해 두면 콘텐츠가 바뀌었을 때 옛 저장본의 페이즈와 실제
 * 진행이 어긋나는데, 파생이면 그런 일이 없다.
 *
 *   intro    불을 켜기 전
 *   p1       1차 조사 (강도 1 → 2 → 3 → 라디오)
 *   turning  1차를 다 마친 뒤, 방문이 열리기 전 (빨간 라디오 → 생존자 방송)
 *   p2       방문을 연 뒤, 2페이즈 필수 조사를 다 마치기 전
 *   p3       2페이즈를 마친 뒤, 안방 문을 열기 전
 *   p4       안방 문을 연 뒤, 4페이즈 필수 조사(서류 셋 + 액자 2차)를 마치기 전
 *   resolve  정적 비트 뒤, 현관문을 열기 전
 *   ending   현관문을 연 순간
 *
 * "필수 조사"는 콘텐츠가 정한다: from이 그 페이즈이고 side가 아닌 조사 전부다
 * (content/memories.yaml). 코드는 목록을 손으로 적지 않는다.
 */
import type {
  FromPhase,
  MemoryPhaseConfig,
  StoryPhase,
  Visit,
  VisitRef,
} from "@/types/interaction";
import { STORY_PHASES } from "@/types/interaction";
import { MEMORIES, type MemoryId } from "./generated/content";

export type { StoryPhase, Visit, VisitRef };

/** 차수 → 콘텐츠 키. */
const VISIT_KEY = { 1: "phase1", 2: "phase2", 3: "phase3" } as const;
export const VISITS: readonly Visit[] = [1, 2, 3];

const BY_ID = Object.fromEntries(MEMORIES.map((memory) => [memory.id, memory])) as Record<
  MemoryId,
  (typeof MEMORIES)[number]
>;

/** 이 기억의 N차 조사 설정. 그 차수가 없으면 undefined. */
export function visitConfig(id: MemoryId, visit: Visit): MemoryPhaseConfig | undefined {
  return BY_ID[id]?.[VISIT_KEY[visit]];
}

/** 이 기억이 가진 차수들 (오름차순). */
export function visitsOf(id: MemoryId): Visit[] {
  return VISITS.filter((visit) => visitConfig(id, visit) !== undefined);
}

/** 진행 상태 중 차수를 판정하는 데 필요한 것. */
export interface VisitProgress {
  /** 1차 조사를 마친 기억 */
  collected: readonly MemoryId[];
  /** 2차 조사를 마친 기억 */
  revisited: readonly MemoryId[];
  /** 3차 조사를 마친 기억. 옛 저장본·테스트 스냅샷에는 없을 수 있다 */
  rechecked?: readonly MemoryId[];
}

/** 이 기억의 N차 조사를 마쳤는가. */
export function visitDone(state: VisitProgress, id: MemoryId, visit: Visit): boolean {
  if (visit === 1) return state.collected.includes(id);
  if (visit === 2) return state.revisited.includes(id);
  return (state.rechecked ?? []).includes(id);
}

/** 이 조사를 마쳤는가 (한 칸짜리 참조). */
export function refDone(state: VisitProgress, ref: VisitRef): boolean {
  return visitDone(state, ref.id, ref.visit);
}

/** 아직 안 한 가장 앞 차수. 다 했으면 undefined. */
export function nextVisit(state: VisitProgress, id: MemoryId): Visit | undefined {
  return visitsOf(id).find((visit) => !visitDone(state, id, visit));
}

/** 마친 차수 중 가장 뒤. 하나도 안 했으면 undefined. */
export function lastVisitDone(state: VisitProgress, id: MemoryId): Visit | undefined {
  return visitsOf(id)
    .filter((visit) => visitDone(state, id, visit))
    .at(-1);
}

/** 한 번이라도 봤는가. */
export function anyVisitDone(state: VisitProgress, id: MemoryId): boolean {
  return lastVisitDone(state, id) !== undefined;
}

/** 모든 조사 칸: 기억 × 차수. 콘텐츠 순서 그대로. */
export const ALL_VISITS: readonly VisitRef[] = MEMORIES.flatMap((memory) =>
  visitsOf(memory.id).map((visit) => ({ id: memory.id, visit })),
);

/** 1차 조사 목표: 1페이즈를 넘기는 데 필요한 수. */
export const PHASE1_GOAL = ALL_VISITS.filter((ref) => ref.visit === 1).length;

/**
 * 그 페이즈를 넘기는 데 필요한 조사: from이 그 페이즈이고 곁가지가 아닌 것.
 * 1차 조사(p1)는 from이 없으니 p1은 1차 전부다.
 */
export function requiredVisits(phase: FromPhase | "p1"): VisitRef[] {
  return ALL_VISITS.filter((ref) => {
    const config = visitConfig(ref.id, ref.visit);
    if (!config || config.side) return false;
    return phase === "p1" ? ref.visit === 1 : config.from === phase;
  });
}

/**
 * 밝기가 되살아나는 길: 분기점부터 결심까지의 필수 조사 전부. 곁가지는 안 센다.
 * 안 본 사람의 방이 덜 밝으면 곁가지가 곁가지가 아니게 된다.
 */
export const RECOVERY_VISITS: readonly VisitRef[] = ALL_VISITS.filter((ref) => {
  const config = visitConfig(ref.id, ref.visit);
  return ref.visit > 1 && config !== undefined && !config.side && config.from !== undefined;
});

/** 페이즈 순서. a가 b보다 뒤이거나 같은가. */
export function phaseAtLeast(a: StoryPhase, b: StoryPhase): boolean {
  return STORY_PHASES.indexOf(a) >= STORY_PHASES.indexOf(b);
}

/** 페이즈를 가르는 데 필요한 진행 상태. */
export interface StoryProgress extends VisitProgress {
  introDone?: boolean;
  doorOpened: boolean;
  openedDoorways?: readonly string[];
  endingStarted?: boolean;
}

/** 이 조사들을 다 마쳤는가. */
function allDone(state: VisitProgress, refs: readonly VisitRef[]): boolean {
  return refs.every((ref) => refDone(state, ref));
}

const P1_REQUIRED = requiredVisits("p1");
const P2_REQUIRED = requiredVisits("p2");
const P4_REQUIRED = requiredVisits("p4");

/** 안방 문: 이 문이 열리는 순간이 4페이즈의 시작이다 (v4 1-2). */
export const PARENTS_DOORWAY = "living-parents";

/** 지금 이야기의 어느 페이즈인가. */
export function storyPhaseOf(state: StoryProgress): StoryPhase {
  if (state.endingStarted) return "ending";
  // 불을 켜기 전. introDone을 모르는 옛 스냅샷, 그리고 이미 뭔가를 본 진행은 인트로를
  // 지난 것으로 본다 (불을 켜지 않고는 아무것도 볼 수 없다)
  if (state.introDone === false && state.collected.length === 0) return "intro";
  if (!allDone(state, P1_REQUIRED)) return "p1";
  if (!state.doorOpened) return "turning";
  if (!allDone(state, P2_REQUIRED)) return "p2";
  if (!(state.openedDoorways ?? []).includes(PARENTS_DOORWAY)) return "p3";
  if (!allDone(state, P4_REQUIRED)) return "p4";
  return "resolve";
}

/**
 * 남은 밤 (v4 1-3의 deadline). 생존자 방송이 "나흘 밤 지나면 이동한다"고 한 뒤부터 4.
 * 방송부터 현관까지가 전부 하루 안의 일이라 페이즈가 넘어가도 줄지 않는다. 방송 전에는 없다.
 */
export function deadlineOf(phase: StoryPhase): 4 | null {
  return phaseAtLeast(phase, "p2") ? 4 : null;
}

/**
 * 이 조사가 지금 열려 있는가 (그 차수의 문턱: 페이즈와 해금 조건).
 *
 * 1차 조사는 p1에서만 연다. 2차 이후는 from 페이즈부터이고, 같은 기억의 앞 차수를
 * 마쳤어야 한다. 해금 조건(unlockAfter)은 차수까지 확정된 참조라 그대로 본다.
 */
export function visitOpen(state: StoryProgress, id: MemoryId, visit: Visit): boolean {
  const config = visitConfig(id, visit);
  if (!config) return false;
  const phase = storyPhaseOf(state);
  if (visit === 1) {
    // 인트로 동안에도 1차 조사는 열려 있다. 만지지 못하게 막는 것은 1인칭 시점이다
    // (store의 viewpointOf). 불을 켜는 순간 방이 그대로 이어진다
    if (phase !== "p1" && phase !== "intro") return false;
  } else {
    if (!config.from || !phaseAtLeast(phase, config.from)) return false;
    // 결말이 시작되면 방은 끝났다
    if (phase === "ending") return false;
    const earlier = visitsOf(id).filter((other) => other < visit);
    if (!earlier.every((other) => visitDone(state, id, other))) return false;
  }
  return (config.unlockAfter ?? []).every((ref) => refDone(state, ref));
}

/** progressAt이 만들 수 있는 페이즈: 그 페이즈에 막 들어선 순간. */
export type EnterablePhase = "p1" | "turning" | "p2" | "p3" | "p4" | "resolve";
const ENTER_ORDER: readonly EnterablePhase[] = ["p1", "turning", "p2", "p3", "p4", "resolve"];

/**
 * 그 페이즈에 막 들어선 순간의 진행: 앞 페이즈들의 필수 조사 전부와, 페이즈를 가르는
 * 문·열쇠·하부장까지. 곁가지는 안 채운다. 개발 도구(어드민의 페이즈 건너뛰기)와
 * 테스트가 같은 상태를 쓰도록 한곳에 둔다.
 */
export function progressAt(phase: EnterablePhase) {
  const at = ENTER_ORDER.indexOf(phase);
  const passed = (target: EnterablePhase) => at > ENTER_ORDER.indexOf(target);
  const refs = [
    ...(passed("p1") ? requiredVisits("p1") : []),
    ...(passed("turning") ? requiredVisits("turning") : []),
    ...(passed("p2") ? requiredVisits("p2") : []),
    ...(passed("p3") ? requiredVisits("p3") : []),
    ...(passed("p4") ? requiredVisits("p4") : []),
  ];
  const pick = (visit: Visit) => refs.filter((ref) => ref.visit === visit).map((ref) => ref.id);
  return {
    collected: pick(1),
    revisited: pick(2),
    rechecked: pick(3),
    introDone: true,
    doorOpened: passed("turning"),
    openedDoorways: passed("p3")
      ? ["living-bathroom", PARENTS_DOORWAY]
      : passed("turning")
        ? ["living-bathroom"]
        : [],
    inventory: passed("p3") ? ["parents-key"] : [],
    solvedPuzzles: passed("p3") ? ["sink-dial"] : [],
  };
}
