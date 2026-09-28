"use client";

import { X } from "@phosphor-icons/react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { selectHeroNameKnown, useMemoryRoomStore } from "@/store/memory-room";
import { FOCUS_RING } from "./ui-classes";

/**
 * 지나간 대사를 모아 보는 화면 (비주얼 노벨의 백로그).
 *
 * 쌓는 일은 대사창이 한다 (DialogueBox: 화면에 선 줄을 그대로 남긴다). 여기서는 그
 * 목록을 펼치기만 한다. 본문이 아니라 키가 쌓여 있어서, 이 화면을 열어 둔 채 언어를
 * 바꿔도 지나간 줄이 그 언어로 다시 읽힌다.
 *
 * **판이 아니라 겹이다.** 처음엔 테두리와 제목줄이 있는 패널이었는데, 그러면 설정창과
 * 같은 무게로 읽혀서 대사 흐름이 끊긴다. 비주얼 노벨의 백로그는 방 위에 어둠을 한 겹
 * 덮고 글자만 얹는다. 여기도 그렇게 한다: 전면을 덮되 틀은 없다.
 *
 * **어디를 눌러도 닫힌다.** 대사 한 줄을 확인하려고 잠깐 여는 겹이라 닫기 X 하나를
 * 조준하게 만들 이유가 없다. 그래도 닫는 법이 안 보여 헤맨다는 피드백이 있어, 제목줄
 * 오른쪽에 X를 하나 둔다. 누르는 자리가 늘 뿐 닫는 방식은 같다. 굴리기는 살아 있다:
 * 휠과 손가락 쓸기는 click을 만들지 않으므로 목록 위에서 굴려도 닫히지 않는다 (그래서
 * pointerdown이 아니라 click으로 받는다). 키보드는 Escape다.
 *
 * 최근 것만 보여준다. 로그를 여는 이유는 대개 "방금 뭐라고 했지"라서, 스무 줄 위의
 * 대사는 찾는 물건이 아니다. 오래된 줄일수록 옅어져 어디가 최신인지 눈으로 읽힌다.
 */
const VISIBLE_LINES = 14;
/** 가장 오래된 줄의 불투명도. 1까지 올라오며 최신 줄이 가장 진하다. */
const FADE_FLOOR = 0.42;

export function DialogueLog() {
  const { t } = useTranslation();
  const { t: tRoom } = useTranslation("memoryRoom");
  const open = useMemoryRoomStore((state) => state.dialogueLogOpen);
  const setOpen = useMemoryRoomStore((state) => state.setDialogueLogOpen);
  const setUiLock = useMemoryRoomStore((state) => state.setUiLock);
  const log = useMemoryRoomStore((state) => state.dialogueLog);
  const heroNameKnown = useMemoryRoomStore(selectHeroNameKnown);
  const scrollerRef = useRef<HTMLDivElement>(null);

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
    if (!open) return;
    /*
     * 맨 아래(최신 줄)에서 열린다. 굴리는 상자를 **직접** 굴려야 한다:
     * scrollIntoView는 조상까지 같이 굴리는데, 방을 담은 h-dvh 상자는 overflow-hidden
     * 이어도 프로그램으로는 굴러간다. 한 번 밀리면 스크롤바가 없어 되돌릴 길이 없어서,
     * 로그를 닫은 뒤에도 HUD가 그만큼 위로 올라간 채 남았다.
     */
    const scroller = scrollerRef.current;
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  }, [open]);

  if (!open) return null;

  const recent = log.slice(-VISIBLE_LINES);

  return (
    // z-60: 대사창(z-50) 위에 선다. 대사 위에 얹히는 화면이라 그 아래로 가면 안 읽힌다
    // biome-ignore lint/a11y/useKeyWithClickEvents: 키보드 몫은 위의 Escape 리스너(캡처)가 맡는다. 이 겹은 포커스를 받지 않으므로 요소에 건 키 이벤트는 아무 데도 닿지 않는다
    <section
      aria-label={t("dialogue.log")}
      className="absolute inset-0 z-[60] flex animate-fade-rise cursor-pointer flex-col bg-scene-void/85 backdrop-blur-[2px]"
      // 어디를 눌러도 닫힌다. 굴리기(휠·손가락 쓸기)는 click이 아니라 그대로 살아 있다
      onClick={() => setOpen(false)}
    >
      <div className="flex flex-none items-center justify-between gap-4 px-5 pt-4 sm:px-8 sm:pt-6">
        <h2 className="font-pixel text-[0.7rem] tracking-[0.3em] text-bone/60">
          {t("dialogue.log")}
        </h2>
        {/* 닫기는 겹을 누른 것과 같다. click이 겹까지 올라가 닫으므로 따로 할 일이 없다 */}
        <button
          type="button"
          aria-label={t("dialogue.logClose")}
          className={`cursor-pointer text-fog transition-colors hover:text-ivory active:text-ivory/80 ${FOCUS_RING}`}
        >
          <X size={18} weight="bold" />
        </button>
      </div>

      {/* overscroll-contain: 끝까지 굴린 스크롤이 뒤의 방으로 새어 나가지 않게 */}
      <div
        ref={scrollerRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-8 pt-4 sm:px-8"
      >
        {recent.length === 0 ? (
          <p className="break-ko pt-10 text-center text-sm text-fog">{t("dialogue.logEmpty")}</p>
        ) : (
          <ol className="mx-auto flex w-full max-w-2xl flex-col gap-5">
            {recent.map((entry, index) => (
              <li
                // biome-ignore lint/suspicious/noArrayIndexKey: 같은 줄이 여러 번 흐를 수 있다. 자리가 곧 순서다
                key={index}
                style={{
                  opacity: FADE_FLOOR + (1 - FADE_FLOOR) * ((index + 1) / recent.length),
                }}
              >
                <p className="font-pixel text-[0.6rem] tracking-[0.25em] text-memory/75">
                  {entry.speaker === "hero" && !heroNameKnown
                    ? t("speaker.unknownHero")
                    : tRoom(`characters.${entry.speaker}.name` as never)}
                </p>
                <p className="mt-1.5 break-ko text-pretty leading-relaxed text-ivory">
                  {tRoom(entry.textKey)}
                </p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
