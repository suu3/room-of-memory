import type { MemoryId } from "@/data/memory-room";
import type { PuzzleId } from "@/data/room-clues";
import { sanitizeProgress, useMemoryRoomStore } from "@/store/memory-room";
import { cycleMemory } from "./admin-progress";

/** 어드민 패널이 한 번에 밀어 넣는 진행. 안 적은 항목은 지금 값을 그대로 둔다. */
export interface AdminPatch {
  collected?: MemoryId[];
  revisited?: MemoryId[];
  doorOpened?: boolean;
  solvedPuzzles?: PuzzleId[];
  endingStarted?: boolean;
  started?: boolean;
}

/**
 * 진행을 통째로 갈아 끼운다.
 *
 * 스토어 액션을 안 거치고 setState로 직접 쓰되, **저장본을 걸러내는 그 함수를
 * 먼저 통과시킨다**. persist 계층이 새로고침 때 어차피 같은 함수를 돌리므로,
 * 여기서 미리 걸러 두지 않으면 패널로 만든 상태가 새로고침 한 번에 되돌아간다 —
 * 화면에서 본 것과 다시 켰을 때의 것이 달라지는 게 개발 도구로서 제일 나쁘다.
 *
 * started는 저장 대상이 아니라 sanitizeProgress가 모르는 값이다. 걸러진 결과
 * 바깥에서 따로 얹는다.
 */
export function applyAdminPatch(patch: AdminPatch): void {
  const state = useMemoryRoomStore.getState();
  const { started, ...progress } = patch;

  const merged = {
    collected: state.collected,
    revisited: state.revisited,
    doorOpened: state.doorOpened,
    solvedPuzzles: state.solvedPuzzles,
    endingStarted: state.endingStarted,
    // 진행이 아니라 환경설정이지만, 걸러내는 함수가 통째로 받으므로 같이 넘겨야 안 지워진다
    soundMuted: state.soundMuted,
    lightsOn: state.lightsOn,
    difficulty: state.difficulty,
    ...progress,
  };

  useMemoryRoomStore.setState({
    ...sanitizeProgress(merged),
    ...(started === undefined ? {} : { started }),
  });
}

/** 기억 하나를 다음 단계로. 패널의 셀 클릭이 부른다. */
export function cycleAdminMemory(id: MemoryId): void {
  const { collected, revisited } = useMemoryRoomStore.getState();
  applyAdminPatch(cycleMemory({ collected, revisited }, id));
}
