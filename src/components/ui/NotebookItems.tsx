"use client";

import { useTranslation } from "react-i18next";
import { ITEM_IDS } from "@/data/items";
import { useMemoryRoomStore } from "@/store/memory-room";
import { ITEM_ICON } from "./item-icons";

/**
 * 수첩의 소지품 페이지.
 *
 * HUD의 소지품 줄(InventoryStrip)과 역할이 갈린다. 저쪽은 잠긴 문 앞에서 수첩을 안 열고도
 * "열쇠 있나"를 보는 자리라 이름만 스친다. 여기는 **무엇을 어디서 주웠는지**가 남는 자리다.
 * 방을 몇 바퀴 돌고 나면 손에 든 것이 어디서 나온 건지부터 흐려지는데, 그걸 플레이어의
 * 기억에 맡기면 퍼즐이 아니라 암기가 된다.
 *
 * 격자로 칸을 미리 깔지 않는다. 빈 칸이 줄지어 서 있으면 "이만큼 채워야 한다"로 읽혀서,
 * 물건 서넛짜리 이야기에 없는 수집 목표를 만든다. 주운 것만 한 장씩 늘어난다.
 *
 * 쓰는 법은 적지 않는다. 물건은 쓰는 자리에 가면 저절로 쓰인다 (문 규칙: src/data/doors.ts).
 */
export function NotebookItems() {
  const { t } = useTranslation();
  const inventory = useMemoryRoomStore((state) => state.inventory);
  /* 목록 순서는 주운 순서가 아니라 표(ITEM_IDS) 순서다. 열 때마다 카드가 자리를 바꾸지 않게 */
  const carried = ITEM_IDS.filter((id) => inventory.includes(id));

  if (carried.length === 0) {
    return (
      <div className="mx-auto max-w-2xl py-10 text-center">
        <p className="break-ko text-sm text-graphite">{t("characterSheet.itemsEmpty")}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl py-1">
      <ul className="flex flex-col gap-3">
        {carried.map((id) => {
          const Icon = ITEM_ICON[id];
          return (
            <li
              key={id}
              className="flex animate-fade-rise items-start gap-3.5 rounded-md border border-ink/10 bg-bone/30 px-4 py-3.5"
            >
              <span
                aria-hidden
                className="mt-0.5 grid size-9 flex-none place-items-center rounded-sm bg-paper text-ink/70"
              >
                <Icon size={20} weight="fill" />
              </span>
              <div className="min-w-0">
                <p className="break-ko text-sm font-medium text-ink">
                  {t(`items.${id}.name` as const)}
                </p>
                <p className="mt-1 break-ko text-pretty text-xs leading-normal text-graphite">
                  {t(`items.${id}.note` as const)}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-5 break-ko text-center text-xs text-graphite/80">
        {t("characterSheet.itemsHint")}
      </p>
    </div>
  );
}
