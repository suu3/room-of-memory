import type { ItemId } from "@/data/items";
import { MEMORY_IDS } from "@/data/memory-room";
import type { DiscoveryId } from "@/data/room-clues";
import type { DoorwayId } from "@/data/spaces";
import { type VisitProgress, visitDone, visitsOf } from "@/data/story-phase";

/** 수첩의 페이지(위쪽 종이 인덱스 탭). 순서가 곧 탭 순서다. */
const NOTEBOOK_TABS = ["profile", "lore", "map", "items"] as const;
export type NotebookTabId = (typeof NOTEBOOK_TABS)[number];

/**
 * 프로필 페이지의 칸. `revealAt`은 이 칸이 열리는 데 필요한 수집 개수,
 * `discovery`는 방에서 알아내면 열리는 칸 (CharacterSheetModal 주석).
 */
export const PROFILE_ROWS = [
  { index: 0, discovery: "hero-name" },
  { index: 1, revealAt: 3 },
  { index: 2, revealAt: 5 },
  { index: 3, revealAt: 7 },
] as const satisfies readonly (
  | { index: number; revealAt: number }
  | { index: number; discovery: DiscoveryId }
)[];

/** 수첩에 무엇이 적혔는지 판정하는 데 필요한 진행. */
export interface NotebookSource extends VisitProgress {
  discoveries: readonly DiscoveryId[];
  inventory: readonly ItemId[];
  doorOpened: boolean;
  openedDoorways: readonly DoorwayId[];
}

/**
 * 지금 수첩의 각 페이지에 적혀 있는 것을 하나씩 부르는 이름.
 *
 * "안 읽은 알림"은 이 목록과 이미 펼쳐 본 목록(store의 notebookRead)의 차이다. 개수가
 * 아니라 이름으로 세는 이유는, 기록 한 칸이 2차 조사에서 다른 문장으로 갈아끼워질 때도
 * 새 글로 쳐야 해서다 (`lore:<id>@<차수>`).
 */
export function notebookEntries(state: NotebookSource): Record<NotebookTabId, string[]> {
  return {
    profile: PROFILE_ROWS.filter((row) =>
      "revealAt" in row
        ? state.collected.length >= row.revealAt
        : state.discoveries.includes(row.discovery),
    ).map((row) => `profile:${row.index}`),
    lore: MEMORY_IDS.flatMap((id) =>
      visitsOf(id)
        .filter((visit) => visitDone(state, id, visit))
        .map((visit) => `lore:${id}@${visit}`),
    ),
    // 평면도는 방문이 열린 순간 한 장이 늘어난다. 그 뒤로는 문이 하나 열릴 때마다 새 칸
    map: state.doorOpened ? ["map", ...state.openedDoorways.map((id) => `door:${id}`)] : [],
    items: state.inventory.map((id) => `item:${id}`),
  };
}

/** 적혀 있지만 아직 펼쳐 보지 않은 것이 있는 페이지. 탭 순서대로. */
export function unreadNotebookTabs(
  state: NotebookSource & { notebookRead: readonly string[] },
): NotebookTabId[] {
  const entries = notebookEntries(state);
  return NOTEBOOK_TABS.filter((tab) =>
    entries[tab].some((entry) => !state.notebookRead.includes(entry)),
  );
}
