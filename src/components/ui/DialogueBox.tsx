"use client";

import { useTranslation } from "react-i18next";
import type { StageId } from "@/data/memory-room";

export function DialogueBox({ stageId }: { stageId: StageId }) {
  const { t: tRoom } = useTranslation("memoryRoom");
  const text = tRoom(`stages.${stageId}.dialogue`);

  return (
    <div className="absolute bottom-7 left-1/2 w-full max-w-2xl -translate-x-1/2 px-4">
      <div className="relative">
        <div className="absolute -top-4 left-4 z-10 flex -skew-x-6 items-baseline gap-2 rounded-sm bg-ember px-4 py-1 text-paper shadow-chip">
          <span className="skew-x-6 text-sm font-bold tracking-wide">
            {tRoom("characters.hero.name")}
          </span>
          <span className="skew-x-6 text-xs tracking-widest opacity-85">
            {tRoom("characters.hero.tag")}
          </span>
        </div>
        <div className="relative rounded-sm border border-bone/15 bg-ink/90 px-6 pb-4 pt-7 shadow-overlay backdrop-blur-sm">
          <div
            aria-hidden
            className="absolute right-5 top-3 w-13 border-t-2 border-dashed border-ember opacity-50"
          />
          <p
            key={text}
            className="min-h-14 animate-fade-rise text-pretty text-lg leading-dialogue text-bone"
          >
            {text}
          </p>
          <div className="flex justify-end">
            <div aria-hidden className="animate-bob-arrow text-sm text-ember">
              ▼
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
