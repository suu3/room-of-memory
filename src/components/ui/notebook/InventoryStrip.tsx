"use client";

import { useTranslation } from "react-i18next";
import { playSound } from "@/lib/audio";
import { itemSpent, selectNotebookTabTucked, useMemoryRoomStore } from "@/store/memory-room";
import { FOCUS_RING } from "../shared/ui-classes";
import { ITEM_ICON } from "./item-icons";

/**
 * 가진 물건 한 줄 (v3 방탈출 축). 헤더의 진행 바 밑, 목표 줄 아래에 선다.
 *
 * 인벤토리 화면을 따로 두지 않는다. 물건은 몇 개 안 되고, 쓰는 자리(문)에 가면 문이
 * 알아서 열린다. 여기서는 "지금 뭘 들고 있는가"만 보인다. 다 쓴 물건은 내린다 (itemSpent).
 * 칩을 누르면 수첩의 소지품 장이 펴진다: 테두리 선 칩은 버튼으로 읽히는데 눌러도 아무 일이
 * 없어서 고장으로 읽혔다. 어디서 주웠는지는 그 장에 적혀 있다 (NotebookItems).
 * 빈손이면 아예 안 그린다:
 * 빈 칸이 서 있으면 채워야 할 목록으로 읽힌다.
 */
export function InventoryStrip() {
  const { t } = useTranslation();
  const inventory = useMemoryRoomStore((state) => state.inventory);
  const openedDoorways = useMemoryRoomStore((state) => state.openedDoorways);
  const solvedPuzzles = useMemoryRoomStore((state) => state.solvedPuzzles);
  // 다 쓴 물건(열린 문의 열쇠, 푼 문제의 악보)은 내린다
  const held = inventory.filter((id) => !itemSpent({ openedDoorways, solvedPuzzles }, id));
  const setCharacterSheetOpen = useMemoryRoomStore((state) => state.setCharacterSheetOpen);
  // 대사·미니게임·컷씬 중에는 수첩 손잡이와 같이 물러난다. 그때 펴면 대사창 위에 겹친다
  const tucked = useMemoryRoomStore(selectNotebookTabTucked);
  if (held.length === 0) return null;

  return (
    <ul
      aria-label={t("hud.inventory")}
      className="flex flex-wrap items-center gap-[0.5em] text-[0.75em] font-medium text-fog"
    >
      {held.map((id) => {
        const Icon = ITEM_ICON[id];
        return (
          <li key={id} className="animate-fade-rise">
            <button
              type="button"
              disabled={tucked}
              aria-label={t("hud.inventoryOpen", { name: t(`items.${id}.name` as const) })}
              onClick={() => {
                playSound("open");
                setCharacterSheetOpen(true, "items");
              }}
              className={`inline-flex cursor-pointer items-center gap-[0.35em] rounded-sm border border-line bg-surface px-[0.6em] py-[0.25em] transition-colors duration-150 hover:bg-surface-strong hover:text-ivory active:bg-surface-strong disabled:cursor-default ${FOCUS_RING}`}
            >
              <Icon size="1.15em" weight="bold" aria-hidden />
              <span className="break-ko">{t(`items.${id}.name` as const)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
