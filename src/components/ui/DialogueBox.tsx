"use client";

import { CaretDown } from "@phosphor-icons/react";
import type { ParseKeys } from "i18next";
import { useTranslation } from "react-i18next";
import { SCRIPTS } from "@/data/memory-room";
import { useTypewriterState } from "@/lib/use-typewriter";
import { selectActiveInteraction, useMemoryRoomStore } from "@/store/memory-room";
import { CharacterPortrait } from "./CharacterPortrait";

/** 대사창은 인터랙션 대사가 재생 중일 때만 뜬다 — 평상시 화면에는 없다. */
export function DialogueBox() {
  const { t } = useTranslation();
  const { t: tRoom } = useTranslation("memoryRoom");
  const active = useMemoryRoomStore(selectActiveInteraction);
  const advanceDialogue = useMemoryRoomStore((state) => state.advanceDialogue);

  // 인트로 대사와 미니게임 결과 대사가 같은 창을 쓴다 — 어느 쪽인지는 스토어가 들고 있다
  const script =
    active?.phase === "dialogue" && active.scriptId ? SCRIPTS[active.scriptId] : undefined;
  const scriptLine = active ? script?.lines[active.lineIndex] : undefined;
  // 훅은 조건부로 호출할 수 없으므로 대사가 없을 때도 빈 문자열로 돌린다
  const text = scriptLine ? tRoom(scriptLine.textKey) : "";
  const { typed, done, skip } = useTypewriterState(text);

  if (active?.phase !== "dialogue" || !scriptLine) return null;

  const speakerName = tRoom(`characters.${scriptLine.speaker}.name` as ParseKeys<"memoryRoom">);

  return (
    // z-50: 미니게임 결과 대사일 때 미니게임 오버레이(z-40) 위로 올라와야 한다
    <div className="absolute bottom-8 left-1/2 z-50 w-full max-w-4xl -translate-x-1/2 animate-fade-rise px-4">
      <div className="relative">
        <CharacterPortrait expression={scriptLine.expression ?? "neutral"} talking={!done} />
        <button
          type="button"
          // 타자 연출 중 클릭은 대사를 건너뛰지 않고 먼저 다 채운다 (VN 관례)
          onClick={done ? advanceDialogue : skip}
          aria-label={done ? t("dialogue.advance") : t("dialogue.skipTyping")}
          className="relative block w-full cursor-pointer rounded-xl border border-bone bg-paper px-8 pb-6 pt-5 text-left shadow-overlay"
        >
          {/* 화자 이름은 패널 안 라벨로 — 초상이 있어 별도 칩이나 소개 문구는 군더더기다 */}
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-bold tracking-wide text-ink">{speakerName}</span>
            <span aria-hidden className="h-px flex-1 bg-ink/12" />
          </div>
          <p
            key={`${active.memoryId}-${active.lineIndex}`}
            className="mt-4 min-h-20 text-pretty text-lg leading-dialogue text-ink"
          >
            {typed}
          </p>
          <div className="flex justify-end">
            <div
              aria-hidden
              className={`animate-bob-arrow text-memory transition-opacity ${
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
