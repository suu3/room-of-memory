import type { IconWeight } from "@phosphor-icons/react";
import type { ComponentType } from "react";

/** 기억 아이템 아이콘이 따르는 최소 프롭 규약: Phosphor 아이콘과 호환. */
export type MemoryIcon = ComponentType<{
  size?: number | string;
  weight?: IconWeight;
  className?: string;
}>;
