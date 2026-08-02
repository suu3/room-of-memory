"use client";

import { CaretDown } from "@phosphor-icons/react";
import type { ParseKeys } from "i18next";
import { useTranslation } from "react-i18next";
import { phaseConfigOf, SCRIPTS } from "@/data/memory-room";
import { useTypewriterState } from "@/lib/use-typewriter";
import { selectActiveInteraction, useMemoryRoomStore } from "@/store/memory-room";
import { CharacterPortrait } from "./CharacterPortrait";

/** 대사창은 인터랙션 대사가 재생 중일 때만 뜬다 — 평상시 화면에는 없다. */
export function DialogueBox() {
  const { t } = useTranslation();
  const { t: tRoom } = useTranslation("memoryRoom");
  const active = useMemoryRoomStore(selectActiveInteraction);
  const advanceDialogue = useMemoryRoomStore((state) => state.advanceDialogue);

  const interaction =
    active?.phase === "dialogue"
      ? phaseConfigOf(active.memoryId, active.gamePhase)?.interaction
      : undefined;
  const script = interaction?.scriptId ? SCRIPTS[interaction.scriptId] : undefined;
  const scriptLine = active ? script?.lines[active.lineIndex] : undefined;
  // 훅은 조건부로 호출할 수 없으므로 대사가 없을 때도 빈 문자열로 돌린다
  const text = scriptLine ? tRoom(scriptLine.textKey) : "";
  const { typed, done, skip } = useTypewriterState(text);

  if (active?.phase !== "dialogue" || !scriptLine) return null;

  const speakerName = tRoom(`characters.${scriptLine.speaker}.name` as ParseKeys<"memoryRoom">);
  const speakerTag = tRoom(`characters.${scriptLine.speaker}.tag` as ParseKeys<"memoryRoom">);

  return (
    <div className="absolute bottom-7 left-1/2 z-10 w-full max-w-2xl -translate-x-1/2 animate-fade-rise px-4">
      <div className="relative">
        <CharacterPortrait expression={scriptLine.expression ?? "neutral"} talking={!done} />
        <div className="absolute -top-4 left-4 z-10 flex -skew-x-6 items-baseline gap-2 rounded-sm bg-ember px-4 py-1 text-paper shadow-chip">
          <span className="skew-x-6 text-sm font-bold tracking-wide">{speakerName}</span>
          <span className="skew-x-6 text-xs tracking-widest opacity-85">{speakerTag}</span>
        </div>
        <button
          type="button"
          // 타자 연출 중 클릭은 대사를 건너뛰지 않고 먼저 다 채운다 (VN 관례)
          onClick={done ? advanceDialogue : skip}
          aria-label={done ? t("dialogue.advance") : t("dialogue.skipTyping")}
          className="relative block w-full cursor-pointer rounded-lg border-2 border-bone bg-paper px-6 pb-4 pt-7 text-left shadow-overlay"
        >
          <div
            aria-hidden
            className="absolute right-5 top-3 w-13 border-t-2 border-dashed border-ember opacity-60"
          />
          <p
            key={`${active.memoryId}-${active.lineIndex}`}
            className="min-h-14 text-pretty text-lg leading-dialogue text-ink"
          >
            {typed}
          </p>
          <div className="flex justify-end">
            <div
              aria-hidden
              className={`animate-bob-arrow text-ember transition-opacity ${
                done ? "opacity-100" : "opacity-0"
              }`}
            >
              <CaretDown size={16} weight="fill" />
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
