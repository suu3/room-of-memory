"use client";

import { X } from "@phosphor-icons/react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { selectHeroNameKnown, useMemoryRoomStore } from "@/store/memory-room";
import { BACKDROP, HUD_ICON_BUTTON_SOLID, PANEL_DARK } from "./ui-classes";

/**
 * 지나간 대사를 모아 보는 화면 (비주얼 노벨의 백로그).
 *
 * 쌓는 일은 대사창이 한다 (DialogueBox: 화면에 선 줄을 그대로 남긴다). 여기서는 그
 * 목록을 펼치기만 한다. 본문이 아니라 키가 쌓여 있어서, 이 화면을 열어 둔 채 언어를
 * 바꿔도 지나간 줄이 그 언어로 다시 읽힌다.
 *
 * 마지막 줄이 보이도록 열린다. 로그를 여는 이유는 대개 "방금 뭐라고 했지"라서,
 * 처음부터 펼치면 매번 끝까지 굴려야 한다.
 */
export function DialogueLog() {
  const { t } = useTranslation();
  const { t: tRoom } = useTranslation("memoryRoom");
  const open = useMemoryRoomStore((state) => state.dialogueLogOpen);
  const setOpen = useMemoryRoomStore((state) => state.setDialogueLogOpen);
  const setUiLock = useMemoryRoomStore((state) => state.setUiLock);
  const log = useMemoryRoomStore((state) => state.dialogueLog);
  const heroNameKnown = useMemoryRoomStore(selectHeroNameKnown);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setUiLock("dialogue-log", open);
    return () => setUiLock("dialogue-log", false);
  }, [open, setUiLock]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setOpen(false);
    };
    // 캡처로 받는다. 대사창이 화면 전역의 키를 먼저 가져가는 것과 같은 이유다
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, setOpen]);

  useEffect(() => {
    // jsdom에는 scrollIntoView가 없다. 없으면 그냥 위에서 열린다
    if (open) bottomRef.current?.scrollIntoView?.();
  }, [open]);

  if (!open) return null;

  return (
    // z-60: 대사창(z-50) 위에 선다. 대사 위에 얹히는 화면이라 그 아래로 가면 안 읽힌다
    <div className="absolute inset-0 z-[60] grid place-items-center p-4">
      <button
        type="button"
        aria-label={t("dialogue.logClose")}
        onClick={() => setOpen(false)}
        className={`absolute inset-0 cursor-pointer ${BACKDROP}`}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("dialogue.log")}
        className={`relative flex max-h-full w-full max-w-2xl animate-fade-rise flex-col ${PANEL_DARK}`}
      >
        <div className="flex flex-none items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <h2 className="text-sm font-medium text-ivory">{t("dialogue.log")}</h2>
          <button
            type="button"
            aria-label={t("dialogue.logClose")}
            onClick={() => setOpen(false)}
            className={HUD_ICON_BUTTON_SOLID}
          >
            <X size={20} weight="bold" />
          </button>
        </div>
        {/* overscroll-contain: 끝까지 굴린 스크롤이 뒤의 방으로 새어 나가지 않게 */}
        <div className="min-h-0 overflow-y-auto overscroll-contain px-5 py-4">
          {log.length === 0 ? (
            <p className="break-ko py-6 text-center text-sm text-fog">{t("dialogue.logEmpty")}</p>
          ) : (
            <ol className="flex flex-col gap-3.5">
              {log.map((entry, index) => (
                <li
                  // biome-ignore lint/suspicious/noArrayIndexKey: 같은 줄이 여러 번 흐를 수 있다. 자리가 곧 순서다
                  key={index}
                  className="border-l-2 border-line pl-3"
                >
                  <p className="text-xs font-medium text-memory/80">
                    {entry.speaker === "hero" && !heroNameKnown
                      ? t("speaker.unknownHero")
                      : tRoom(`characters.${entry.speaker}.name` as never)}
                  </p>
                  <p className="mt-1 break-ko text-pretty text-sm leading-relaxed text-ivory/90">
                    {tRoom(entry.textKey)}
                  </p>
                </li>
              ))}
            </ol>
          )}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}
