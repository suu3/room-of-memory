import { MEMORY_IDS, type MemoryId } from "@/data/memory-room";
import {
  DOORWAY_BETWEEN,
  DOORWAY_IDS,
  type DoorwayId,
  MEMORY_SPACE,
  type SpaceId,
} from "@/data/spaces";
import { packedForExit, storyPhaseOf } from "@/data/story-phase";
import {
  type HotspotStatus,
  hotspotStatus,
  type MemoryRoomState,
  selectDrawerCodeRead,
  selectSinkPlugReady,
} from "@/store/memory-room";

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

/**
 * 목록이 보는 진행. 3D 물건이 보는 것과 같아야 한다: 한 칸이라도 빠지면 페이즈가 앞 단계로
 * 계산돼, 눈으로는 열린 물건이 목록에서는 "조사 완료"나 "아직 조사할 수 없음"으로 읽힌다
 * (rechecked · openedDoorways를 빼먹어 안방과 떠나기 전 구간이 통째로 그랬다).
 * 그래서 칸을 선택이 아니라 필수로 받는다.
 */
export type PromptProgress = Pick<
  MemoryRoomState,
  | "collected"
  | "revisited"
  | "rechecked"
  | "doorOpened"
  | "openedDoorways"
  | "discoveries"
  | "introDone"
  | "sinkDrained"
  | "batTaken"
  | "endingStarted"
  | "solvedPuzzles"
  | "inventory"
>;

/** 기억마다의 상태: 버튼이 눌리는지와 이름 뒤에 붙는 이유가 여기서 나온다. */
export function memoryStatuses(state: PromptProgress): Record<MemoryId, HotspotStatus> {
  return Object.fromEntries(MEMORY_IDS.map((id) => [id, hotspotStatus(state, id)])) as Record<
    MemoryId,
    HotspotStatus
  >;
}

/** 기억도 문간도 아니지만 눌러야 이야기가 넘어가는 물건. */
export type PromptPropId =
  | "sink-plug"
  | "nightstand-drawer"
  | "piano-sheet"
  | "piano"
  | "bat"
  | "front-door";

export interface PromptProp {
  id: PromptPropId;
  /** 지금 눌러서 되는가. 안 되는 것도 이유를 붙여 목록에 남긴다 (기억과 같은 문법). */
  ready: boolean;
}

/**
 * 목록에 올릴 물건. 마개는 화장실에 닿은 뒤, 협탁 서랍은 처음부터, 악보 조각·피아노는 그 공간에
 * 닿은 뒤, 배트·현관문은 떠나기로 한 뒤
 * (resolve)에만 오른다: 그 전에는 배경이고, 이름을 먼저 읽으면 스포일러다. 할 일을 다 한
 * 물건(빠진 물, 열린 서랍, 쥔 배트)은 열린 문처럼 빠진다.
 */
export function listedProps(state: PromptProgress, reached: readonly SpaceId[]): PromptProp[] {
  if (state.endingStarted) return [];
  const props: PromptProp[] = [];
  if (reached.includes("bathroom") && !state.sinkDrained) {
    // 앰플을 보기 전의 마개는 "아직 할 수 없음"이다 (selectSinkPlugReady)
    props.push({ id: "sink-plug", ready: selectSinkPlugReady(state) });
  }
  // 협탁 서랍은 내 방에 처음부터 있다. 번호를 알기 전에는 "아직 할 수 없음"으로 읽힌다
  if (!state.solvedPuzzles.includes("drawer-dial")) {
    props.push({ id: "nightstand-drawer", ready: selectDrawerCodeRead(state) });
  }
  /*
   * 피아노는 액자 2차 앞의 자물쇠다 (room-clues의 VISIT_AFTER_PUZZLE). 조각을 집고 피아노를 쳐야
   * 4페이즈가 넘어가는데, 둘 다 기억이 아니라 여기 없으면 걷지 못하는 사람은 거기서 막힌다.
   * 조각은 안방에 닿은 뒤에, 피아노는 거실에 닿은 뒤에 오른다. 조각 없이도 피아노는 열리지만
   * 칠 수는 없어서 "아직 할 수 없음"으로 읽힌다.
   */
  if (!state.solvedPuzzles.includes("piano-melody")) {
    const hasSheet = state.inventory.includes("piano-sheet");
    if (reached.includes("parents") && !hasSheet) props.push({ id: "piano-sheet", ready: true });
    if (reached.includes("living")) props.push({ id: "piano", ready: hasSheet });
  }
  if (storyPhaseOf(state) === "resolve") {
    if (!state.batTaken) props.push({ id: "bat", ready: true });
    props.push({ id: "front-door", ready: packedForExit(state) });
  }
  return props;
}
