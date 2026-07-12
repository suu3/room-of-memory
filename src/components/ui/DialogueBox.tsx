"use client";

import type { ParseKeys } from "i18next";
import { useTranslation } from "react-i18next";
import { phaseConfigOf, SCRIPTS } from "@/data/memory-room";
import { selectActiveInteraction, useMemoryRoomStore } from "@/store/memory-room";

/** 대사창은 인터랙션 대사가 재생 중일 때만 뜬다 — 평상시 화면에는 없다. */
export function DialogueBox() {
  const { t } = useTranslation();
  const { t: tRoom } = useTranslation("memoryRoom");
  const active = useMemoryRoomStore(selectActiveInteraction);
  const advanceDialogue = useMemoryRoomStore((state) => state.advanceDialogue);

  if (active?.phase !== "dialogue") return null;
  const interaction = phaseConfigOf(active.memoryId, active.gamePhase)?.interaction;
  const script = interaction?.scriptId ? SCRIPTS[interaction.scriptId] : undefined;
  const scriptLine = script?.lines[active.lineIndex];
  if (!scriptLine) return null;

  const text = tRoom(scriptLine.textKey);
  const speakerName = tRoom(`characters.${scriptLine.speaker}.name` as ParseKeys<"memoryRoom">);
  const speakerTag = tRoom(`characters.${scriptLine.speaker}.tag` as ParseKeys<"memoryRoom">);

  return (
    <div className="absolute bottom-7 left-1/2 w-full max-w-2xl -translate-x-1/2 animate-fade-rise px-4">
      <div className="relative">
        <div className="absolute -top-4 left-4 z-10 flex -skew-x-6 items-baseline gap-2 rounded-sm bg-ember px-4 py-1 text-paper shadow-chip">
          <span className="skew-x-6 text-sm font-bold tracking-wide">{speakerName}</span>
          <span className="skew-x-6 text-xs tracking-widest opacity-85">{speakerTag}</span>
        </div>
        <button
          type="button"
          onClick={advanceDialogue}
          aria-label={t("dialogue.advance")}
          className="relative block w-full cursor-pointer rounded-sm border border-bone/15 bg-ink/90 px-6 pb-4 pt-7 text-left shadow-overlay backdrop-blur-sm"
        >
          <div
            aria-hidden
            className="absolute right-5 top-3 w-13 border-t-2 border-dashed border-ember opacity-50"
          />
          <p
            key={`${active.memoryId}-${active.lineIndex}`}
            className="min-h-14 animate-fade-rise text-pretty text-lg leading-dialogue text-bone"
          >
            {text}
          </p>
          <div className="flex justify-end">
            <div aria-hidden className="animate-bob-arrow text-sm text-ember">
              ▼
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
