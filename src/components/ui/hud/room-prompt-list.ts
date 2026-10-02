import { MEMORY_IDS, type MemoryId } from "@/data/memory-room";
import {
  DOORWAY_BETWEEN,
  DOORWAY_IDS,
  type DoorwayId,
  MEMORY_SPACE,
  type SpaceId,
} from "@/data/spaces";

/*
 * 화면 밖 조사 목록(RoomInteractionPrompt)에 무엇을 올릴 것인가.
 *
 * 기준은 "지금 닿을 수 있는 공간에 있는가"다. 눈으로 보는 사람은 문이 열리기 전에 거실의
 * 냉장고도 안방의 연구 일지도 모른다. 목록이 처음부터 전부 읽어 주면 스크린리더로 듣는
 * 사람만 뒤에 나올 물건의 이름을 먼저 알게 된다.
 *
 * 닿은 공간 안에서는 지우지 않는다. 잠긴 물건도 다 본 물건도 이유를 붙여 남긴다
 * (RoomInteractionPrompt 주석).
 */

/** 닿을 수 있는 공간에 놓인 기억. */
export function listedMemories(reached: readonly SpaceId[]): MemoryId[] {
  return MEMORY_IDS.filter((id) => reached.includes(MEMORY_SPACE[id]));
}

/** 닿을 수 있는 공간에 붙어 있고 아직 닫혀 있는 문. 열린 문은 더 누를 일이 없어 빠진다. */
export function listedDoorways(
  reached: readonly SpaceId[],
  open: readonly DoorwayId[],
): DoorwayId[] {
  return DOORWAY_IDS.filter((id) => !open.includes(id) && reached.includes(DOORWAY_BETWEEN[id][0]));
}
