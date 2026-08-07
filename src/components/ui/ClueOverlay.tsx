"use client";

import { CaretLeft, CaretRight, X } from "@phosphor-icons/react";
import type { ParseKeys } from "i18next";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CLUE_IDS, type ClueId } from "@/data/room-clues";
import { ASSETS } from "@/lib/assets";
import { playSound } from "@/lib/audio";
import {
  CALENDAR_YEAR,
  FIRST_MONTH,
  LAST_DATED_MONTH,
  NATIONALS_MONTH,
} from "@/minigames/calendar-flip/calendar";
import { MonthGrid } from "@/minigames/calendar-flip/MonthGrid";
import { useMemoryRoomStore } from "@/store/memory-room";

/** 서랍 속 쪽지에 적힌 줄. 아빠가 급히 적은 메모라 세 줄이 전부다. */
const NOTE_LINES = ["clue.drawerNote.l1", "clue.drawerNote.l2", "clue.drawerNote.l3"] as const;

/** 단서마다의 제목·본문 번역 키. 화면에도 쓰이고 키보드 목록의 이름도 여기서 온다. */
const CLUE_TEXT = {
  "drawer-note": { title: "clue.drawerNote.title", caption: "clue.drawerNote.caption" },
  "wall-calendar": { title: "clue.wallCalendar.title", caption: "clue.wallCalendar.caption" },
} as const satisfies Record<ClueId, { title: ParseKeys<"common">; caption: ParseKeys<"common"> }>;

/**
 * 화면에 안 보이는 조사 목록 — 스크린리더와 키보드 전용.
 *
 * 3D 물건을 마우스로 집는 것 말고는 이 종이에 닿을 길이 없는데, 여기 적힌 것이
 * 컴퓨터 잠금을 여는 유일한 단서다. 방의 다른 곁가지(서랍·의자·커튼)와 달리
 * 못 만지면 콘텐츠가 통째로 막히므로 RoomInteractionPrompt와 같은 우회로를 둔다.
 *
 * 아직 열리면 안 되는 단서(조사 전의 달력)는 스토어가 막는다 — 목록에는 늘 있고,
 * 눌러도 아무 일이 없다. 목록에서 지웠다 나타나면 "여긴 아무것도 없다"로 읽힌다.
 */
function ClueKeyboardList() {
  const { t } = useTranslation();
  const openClue = useMemoryRoomStore((state) => state.openClue);

  return (
    <fieldset className="sr-only">
      {CLUE_IDS.map((id) => (
        <button key={id} type="button" onClick={() => openClue(id)}>
          {t("clue.read", { name: t(CLUE_TEXT[id].title) })}
        </button>
      ))}
    </fieldset>
  );
}

/**
 * 방에서 집어 든 것을 화면 가운데에 펼친다.
 *
 * 미니게임이 아니다 — 풀 것도, 성공/실패도, 진행에 남는 것도 없다. 컴퓨터
 * 비밀번호가 어디에도 통째로 적혀 있지 않기 때문에 존재하는 화면이고, 쪽지가
 * "달력을 봐라"라고 하고 달력이 날짜를 준다 (src/data/room-clues.ts).
 */
export function ClueOverlay() {
  const { t } = useTranslation();
  const clue = useMemoryRoomStore((state) => state.activeClue);
  const closeClue = useMemoryRoomStore((state) => state.closeClue);
  const setUiLock = useMemoryRoomStore((state) => state.setUiLock);
  const open = clue !== null;

  useEffect(() => {
    setUiLock("clue", open);
    return () => setUiLock("clue", false);
  }, [open, setUiLock]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeClue();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, closeClue]);

  if (clue === null) return <ClueKeyboardList />;

  const { title: titleKey, caption: captionKey } = CLUE_TEXT[clue];
  const isNote = clue === "drawer-note";

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center overflow-hidden p-4">
      <button
        type="button"
        aria-label={t("clue.close")}
        onClick={closeClue}
        className="absolute inset-0 cursor-pointer bg-scene-void/70 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t(titleKey)}
        className={`relative w-full animate-fade-rise ${isNote ? "max-w-lg" : "max-w-xl"}`}
      >
        {/* 닫기는 종이 밖에 둔다 — 종이 위에 UI 버튼이 얹히면 종이가 아니라 창이 된다 */}
        <button
          type="button"
          onClick={closeClue}
          aria-label={t("clue.close")}
          className="absolute -top-11 right-0 flex cursor-pointer items-center gap-1.5 rounded-full border border-bone/25 px-3.5 py-1.5 text-xs font-bold tracking-widest text-bone/70 transition-colors hover:border-bone/60 hover:text-paper"
        >
          <X size={14} weight="bold" />
          {t("clue.close")}
        </button>

        {isNote ? <FoldedNote /> : <WallCalendar />}

        <p className="mt-4 break-ko text-pretty text-center text-sm leading-relaxed text-bone/60">
          {t(captionKey)}
        </p>
      </div>
    </div>
  );
}

/**
 * 서랍 속 접힌 쪽지.
 *
 * 종이는 그림(clue-note-paper.svg)이 그린다 — 찢긴 윗변과 접힌 자국까지 CSS로
 * 흉내 내면 값싼 사각형이 된다. 글씨만 그 위에 얹으므로 ko/en/ja가 그대로 산다.
 * 왼쪽 여백선이 그림에 인쇄돼 있어(x=66/640) 글은 그 오른쪽에서 시작한다.
 */
function FoldedNote() {
  const { t } = useTranslation();

  return (
    <div
      className="relative aspect-[640/400] w-full bg-contain bg-center bg-no-repeat"
      style={{ backgroundImage: `url(${ASSETS.images.clueNotePaper})` }}
    >
      {/*
        글은 찢긴 윗변 바로 아래에서 시작한다 — 가운데 정렬하면 접힌 자국(그림의
        y=253/400)이 글줄 한가운데를 가른다. 아래는 비워 둔다: 급히 적고 만 메모라
        종이가 남는 게 자연스럽다.
      */}
      <div className="absolute left-[13%] right-[8%] top-[17%] flex flex-col gap-3.5">
        {NOTE_LINES.map((key, index) => (
          <p
            key={key}
            className={`break-ko text-pretty leading-relaxed ${
              index === 0
                ? "text-lg font-bold tracking-wide text-ink"
                : index === NOTE_LINES.length - 1
                  ? "self-end text-sm text-ink/45"
                  : "text-base text-ink/80"
            }`}
          >
            {t(key)}
          </p>
        ))}
      </div>
    </div>
  );
}

/**
 * 조사를 마친 뒤의 달력 — 이제는 벽에 걸린 배경 오브젝트다.
 *
 * 넘기는 미니게임과 달리 아무것도 완료하지 않고 애니메이션도 없다. 그냥 달을
 * 오가며 표시된 날을 확인하는 자리라, 비밀번호를 잊었을 때 다시 와서 볼 수 있다.
 * 처음 펼치는 달은 전국대회가 있던 달이다 — 여기 오는 이유가 그것뿐이라서.
 */
function WallCalendar() {
  const { t } = useTranslation();
  const [month, setMonth] = useState<number>(NATIONALS_MONTH);

  /*
   * 正자 장(11월)까지는 안 간다 — 거기엔 날짜 격자가 없어서 이 화면이 그릴 게
   * 없다. 그 장은 조사 미니게임이 보여주는 몫이다.
   */
  const turn = (step: -1 | 1) => {
    const next = Math.min(LAST_DATED_MONTH, Math.max(FIRST_MONTH, month + step));
    if (next === month) return;
    playSound("flip", { variation: 0.05 });
    setMonth(next);
  };

  return (
    <div className="rounded-xl border border-bone bg-paper p-5 shadow-panel sm:p-6">
      <div className="flex items-center justify-between gap-3 border-b border-ink/10 pb-3">
        <button
          type="button"
          aria-label={t("minigame.calendarFlip.prev")}
          onClick={() => turn(-1)}
          disabled={month === FIRST_MONTH}
          className="cursor-pointer rounded-full p-1.5 text-ink/50 transition-colors hover:bg-ink/5 hover:text-ink disabled:cursor-default disabled:opacity-25"
        >
          <CaretLeft size={20} weight="bold" />
        </button>
        <p className="flex items-baseline gap-2">
          <span className="text-sm font-bold tracking-widest text-ink/45">{CALENDAR_YEAR}</span>
          <span className="font-pixel text-2xl font-bold text-ink">
            {t("minigame.calendarFlip.month", { value: month })}
          </span>
        </p>
        <button
          type="button"
          aria-label={t("minigame.calendarFlip.next")}
          onClick={() => turn(1)}
          disabled={month === LAST_DATED_MONTH}
          className="cursor-pointer rounded-full p-1.5 text-ink/50 transition-colors hover:bg-ink/5 hover:text-ink disabled:cursor-default disabled:opacity-25"
        >
          <CaretRight size={20} weight="bold" />
        </button>
      </div>
      <div className="pt-4">
        <MonthGrid month={month} />
      </div>
    </div>
  );
}
