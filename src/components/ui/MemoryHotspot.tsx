"use client";

import type { MemoryItem } from "@/data/memory-room";
import { useMemoryRoomStore } from "@/store/memory-room";

export function MemoryHotspot({ memory }: { memory: MemoryItem }) {
  const collected = useMemoryRoomStore((state) => state.collected.includes(memory.id));
  const collect = useMemoryRoomStore((state) => state.collect);

  return (
    <button
      type="button"
      onClick={() => collect(memory.id)}
      disabled={collected}
      aria-label={collected ? `${memory.name} — 수집한 기억` : `${memory.name} — 기억 수집하기`}
      className="group absolute flex -translate-x-1/2 -translate-y-1/2 cursor-pointer flex-col items-center gap-2 transition-opacity duration-500 disabled:cursor-default disabled:opacity-35"
      style={{ left: memory.x, top: memory.y }}
    >
      <span
        aria-hidden
        className={`size-4 rounded-full border-2 border-memory ${
          collected ? "bg-memory" : "animate-hotspot-glow bg-memory/10"
        }`}
      />
      <span className="whitespace-nowrap rounded-full border border-memory/30 bg-scene-deep/65 px-2 py-0.5 text-xs font-medium tracking-wide text-bone transition-colors group-hover:border-memory group-hover:text-memory group-focus-visible:border-memory group-focus-visible:text-memory">
        {collected ? `✓ ${memory.name}` : memory.name}
      </span>
    </button>
  );
}
