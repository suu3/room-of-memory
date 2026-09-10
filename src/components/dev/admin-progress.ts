import { MEMORY_BY_ID, type MemoryId } from "@/data/memory-room";

/** 기억 하나가 놓일 수 있는 진행 단계. */
export type MemoryStage = "none" | "collected" | "revisited";

/** 어드민 패널이 만지는 진행의 최소 단위: 기억 두 벌. */
export interface AdminMemoryState {
  collected: MemoryId[];
  revisited: MemoryId[];
}

/**
 * 이 기억이 지날 수 있는 단계들.
 *
 * 기억마다 1바퀴·2바퀴 유무가 다르다 (컴퓨터는 1바퀴가 없다). 없는 단계를 목록에서
 * 빼 두면, 순환이 곧 불변식이 된다. "1바퀴 없이 2바퀴만"인 상태를 만들 방법이
 * UI에도 로직에도 남지 않는다.
 */
export function stagesOf(id: MemoryId): readonly MemoryStage[] {
  const memory = MEMORY_BY_ID[id];
  const stages: MemoryStage[] = ["none"];
  if (memory.phase1) stages.push("collected");
  if (memory.phase2) stages.push("revisited");
  return stages;
}

export function memoryStage(state: AdminMemoryState, id: MemoryId): MemoryStage {
  if (state.revisited.includes(id)) return "revisited";
  if (state.collected.includes(id)) return "collected";
  return "none";
}

/** 목록에서 빼고 다시 넣는 걸 반복하지 않도록, 단계 하나를 두 배열에 한 번에 반영한다. */
function withStage(state: AdminMemoryState, id: MemoryId, stage: MemoryStage): AdminMemoryState {
  const collected = state.collected.filter((each) => each !== id);
  const revisited = state.revisited.filter((each) => each !== id);

  // 2바퀴는 1바퀴를 포함한다. 1바퀴가 있는 기억이라면 collected에도 남아야 한다
  if (stage === "revisited") {
    if (MEMORY_BY_ID[id].phase1) collected.push(id);
    revisited.push(id);
  } else if (stage === "collected") {
    collected.push(id);
  }

  return { collected, revisited };
}

/** 다음 단계로 한 칸. 마지막 단계에서 누르면 처음(미수집)으로 돌아온다. */
export function cycleMemory(state: AdminMemoryState, id: MemoryId): AdminMemoryState {
  const stages = stagesOf(id);
  const current = stages.indexOf(memoryStage(state, id));
  const next = stages[(current + 1) % stages.length];
  return withStage(state, id, next);
}
