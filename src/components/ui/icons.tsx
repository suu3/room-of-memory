import type { IconWeight } from "@phosphor-icons/react";
import type { ComponentType } from "react";

/** 기억 아이템 아이콘이 따르는 최소 프롭 규약 — Phosphor 아이콘과 호환. */
export type MemoryIcon = ComponentType<{
  size?: number | string;
  weight?: IconWeight;
  className?: string;
}>;

/** Phosphor에 야구 배트가 없어 직접 그린 아이콘. 같은 프롭 규약을 따른다. */
export function BatIcon({
  size = 24,
  weight = "regular",
  className,
}: {
  size?: number | string;
  weight?: IconWeight;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      role="presentation"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={weight === "bold" || weight === "fill" ? 2.2 : 1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M4.5 19.5 14.5 9.5M14.5 9.5 19 3.8 20.4 5.2 14.5 9.5M3.6 17.2 6.8 20.4" />
    </svg>
  );
}
