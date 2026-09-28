import { MEMORY_IDS, type MemoryId, phaseConfigOf } from "@/data/memory-room";
import { nextVisit } from "@/data/story-phase";
import { MEMORY_SPACE } from "@/scenes/memory-room/layout";
import { DOORWAY_IDS, DOORWAYS, type DoorwayId, type SpaceId } from "@/scenes/memory-room/spaces";
import {
  clueUnlocked,
  doorwayReady,
  hotspotStatus,
  type MemoryRoomState,
  selectSinkHintRead,
} from "./memory-room";

/**
 * 이지 모드의 "다음에 어디서 무엇을" (스토어의 Difficulty가 guided일 때 HUD 목표 줄이 읽는다).
 *
 * 보통 모드의 목표 줄은 무엇을 하는 화면인지만 말하고(빛나는 물건을 조사하세요), 어느
 * 물건인지는 물건의 글로우가 맡는다. 이지 모드는 거기서 한 걸음 더 가서 공간과 물건의
 * 이름을 짚는다. 여기는 그 "무엇"을 고르는 순수 함수다: 글자는 HudGuide가 만든다.
 *
 * 고르는 순서:
 *   1. 지금 조사할 수 있는 기억 (페이즈를 넘기는 필수 조사가 곁가지보다 먼저, 지금 서 있는
 *      공간이 먼저, 그다음 대본 순서)
 *   2. 열 수 있는데 아직 안 연 문
 *   3. 방탈출 축의 매듭 (조사할 기억이 없을 때 막히는 자리): 선반의 거꾸로 꽂힌 책 →
 *      세면대 하부장 → (열쇠로 안방 문 = 2) → 안방 책상의 악보 조각 → 거실 피아노
 *   4. 없음: 보통 모드의 목표 줄을 그대로 쓴다
 */
export type NextStep =
  | { kind: "memory"; memory: MemoryId; space: SpaceId }
  | { kind: "doorway"; doorway: DoorwayId; to: SpaceId }
  | { kind: "shelf-book" }
  | { kind: "sink-dial" }
  | { kind: "piano-sheet" }
  | { kind: "piano" };

type NextStepState = Pick<
  MemoryRoomState,
  | "collected"
  | "revisited"
  | "rechecked"
  | "doorOpened"
  | "openedDoorways"
  | "introDone"
  | "endingStarted"
  | "discoveries"
  | "notebookOpened"
  | "signalCaught"
  | "inventory"
  | "solvedPuzzles"
  | "space"
>;

/** 그 기억의 다음 조사가 곁가지인가. 곁가지는 페이즈를 넘기는 데 필요 없다. */
function isSide(state: NextStepState, id: MemoryId): boolean {
  const visit = nextVisit(state, id);
  return visit !== undefined && phaseConfigOf(id, visit)?.side === true;
}

export function nextStep(state: NextStepState): NextStep | null {
  const available = MEMORY_IDS.filter((id) => hotspotStatus(state, id) === "available");
  const rank = (id: MemoryId) =>
    (isSide(state, id) ? 2 : 0) + (MEMORY_SPACE[id] === state.space ? 0 : 1);
  const memory = [...available].sort((a, b) => rank(a) - rank(b))[0];
  // 곁가지만 남았으면 방탈출 축의 매듭이 먼저다: 이야기를 넘기는 쪽을 짚는다
  if (memory !== undefined && !isSide(state, memory)) {
    return { kind: "memory", memory, space: MEMORY_SPACE[memory] };
  }

  const doorway = DOORWAY_IDS.find(
    (id) => !state.openedDoorways.includes(id) && doorwayReady(state, id),
  );
  if (doorway !== undefined) return { kind: "doorway", doorway, to: DOORWAYS[doorway].between[1] };

  // 안방 열쇠: 아빠 메일("선반 정리 좀 해라.") → 거꾸로 꽂힌 책의 쪽지 → 세면대 하부장
  if (state.doorOpened && !state.inventory.includes("parents-key")) {
    if (!selectSinkHintRead(state) && clueUnlocked(state, "shelf-book")) {
      return { kind: "shelf-book" };
    }
    if (selectSinkHintRead(state) && !state.solvedPuzzles.includes("sink-dial")) {
      return { kind: "sink-dial" };
    }
  }

  if (memory !== undefined) return { kind: "memory", memory, space: MEMORY_SPACE[memory] };

  // 곁가지 피아노: 안방이 열린 뒤에만 짚는다. 그 전에는 조각을 가지러 갈 수 없다
  if (
    state.openedDoorways.includes("living-parents") &&
    !state.solvedPuzzles.includes("piano-melody")
  ) {
    return state.inventory.includes("piano-sheet") ? { kind: "piano" } : { kind: "piano-sheet" };
  }

  return null;
}
