import { CLUE_IDS, CLUE_SPACE, type ClueId } from "@/data/room-clues";
import type { SpaceId } from "@/data/spaces";

/**
 * 화면 밖 조사 목록(ClueOverlay의 ClueKeyboardList)에 올릴 단서: 지금 닿을 수 있는 공간의 것만.
 *
 * 기억 목록과 같은 기준이다 (hud/room-prompt-list.ts). 화장실 세면대의 출입증 배지를
 * 방에서부터 읽어 주면 스크린리더로 듣는 사람만 뒤에 나올 물건을 먼저 안다.
 * 공간이 안 적힌 단서(거울)는 방의 것이다 (CLUE_SPACE 주석).
 */
export function listedClues(reached: readonly SpaceId[]): ClueId[] {
  return CLUE_IDS.filter((id) => (reached as readonly string[]).includes(CLUE_SPACE[id] ?? "room"));
}
