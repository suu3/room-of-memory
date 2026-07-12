"use client";

import { useTranslation } from "react-i18next";
import type { MemoryItem } from "@/data/memory-room";
import { hotspotStatus, selectGamePhase, useMemoryRoomStore } from "@/store/memory-room";

export function MemoryHotspot({ memory }: { memory: MemoryItem }) {
  const { t } = useTranslation();
  const { t: tRoom } = useTranslation("memoryRoom");
  const status = useMemoryRoomStore((state) => hotspotStatus(state, memory.id));
  const gamePhase = useMemoryRoomStore(selectGamePhase);
  const inputLocked = useMemoryRoomStore((state) => state.activeInteraction !== null);
  const beginInteraction = useMemoryRoomStore((state) => state.beginInteraction);
  const name = tRoom(`memories.${memory.id}.name`);

  const ariaLabel =
    status === "done"
      ? t("hotspot.collectedLabel", { name })
      : status === "locked"
        ? t("hotspot.lockedLabel", { name })
        : gamePhase === 2
          ? t("hotspot.revisitLabel", { name })
          : t("hotspot.collectLabel", { name });

  return (
    <button
      type="button"
      onClick={() => beginInteraction(memory.id)}
      disabled={status !== "available" || inputLocked}
      aria-label={ariaLabel}
      className="group absolute flex -translate-x-1/2 -translate-y-1/2 cursor-pointer flex-col items-center gap-2 transition-opacity duration-500 disabled:cursor-default disabled:opacity-35"
      style={{ left: memory.x, top: memory.y }}
    >
      <span
        aria-hidden
        className={`size-4 rounded-full border-2 border-memory ${
          status === "available" ? "animate-hotspot-glow bg-memory/10" : "bg-memory"
        } ${status === "locked" ? "opacity-40" : ""}`}
      />
      <span className="whitespace-nowrap rounded-full border border-memory/30 bg-scene-deep/65 px-2 py-0.5 text-xs font-medium tracking-wide text-bone transition-colors group-hover:border-memory group-hover:text-memory group-focus-visible:border-memory group-focus-visible:text-memory">
        {status === "done" ? `✓ ${name}` : status === "locked" ? t("panel.unknownName") : name}
      </span>
    </button>
  );
}
