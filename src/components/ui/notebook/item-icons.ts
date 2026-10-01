import { KeyIcon, MusicNoteIcon } from "@phosphor-icons/react";
import type { ComponentType } from "react";
import type { ItemId } from "@/data/items";

/**
 * 물건마다 아이콘. 그림 파일이 아니라 아이콘 라이브러리다 (.claude/rules/assets.md).
 * HUD의 소지품 줄과 수첩의 소지품 페이지가 같은 표를 본다: 둘이 다른 그림을 쓰면
 * 같은 물건으로 안 읽힌다.
 */
export const ITEM_ICON: Record<
  ItemId,
  ComponentType<{ size?: string | number; weight?: "bold" | "fill" }>
> = {
  "parents-key": KeyIcon,
  "piano-sheet": MusicNoteIcon,
};
