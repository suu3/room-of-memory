"use client";

import { useTranslation } from "react-i18next";
import { useMemoryRoomStore } from "@/store/memory-room";
import { ITEM_ICON } from "./item-icons";

/**
 * 가진 물건 한 줄 (v3 방탈출 축). 헤더의 진행 바 밑, 목표 줄 아래에 선다.
 *
 * 인벤토리 화면을 따로 열지 않는다. 물건은 몇 개 안 되고, 쓰는 자리(문)에 가면 문이
 * 알아서 열린다. 여기서는 "지금 뭘 들고 있는가"만 보인다. 빈손이면 아예 안 그린다:
 * 빈 칸이 서 있으면 채워야 할 목록으로 읽힌다.
 */
export function InventoryStrip() {
  const { t } = useTranslation();
  const inventory = useMemoryRoomStore((state) => state.inventory);
  if (inventory.length === 0) return null;

  return (
    <ul
      aria-label={t("hud.inventory")}
      className="flex flex-wrap items-center gap-[0.5em] text-[0.75em] font-medium text-fog"
    >
      {inventory.map((id) => {
        const Icon = ITEM_ICON[id];
        return (
          <li
            key={id}
            className="inline-flex animate-fade-rise items-center gap-[0.35em] rounded-sm border border-line bg-surface px-[0.6em] py-[0.25em]"
          >
            <Icon size="1.15em" weight="bold" aria-hidden />
            <span className="break-ko">{t(`items.${id}.name` as const)}</span>
          </li>
        );
      })}
    </ul>
  );
}
