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
import { SUIT_GLYPH, SUITS, suitColor } from "@/minigames/card-odd/cards";
import { useMemoryRoomStore } from "@/store/memory-room";
import { CharacterModelViewer } from "./CharacterModelViewer";
import { BUTTON_QUIET, PANEL_PAPER } from "./ui-classes";
import { WorkbookClue } from "./WorkbookClue";

/** 서랍 속 쪽지에 적힌 줄. 아빠가 급히 적은 메모라 세 줄이 전부다. */
const NOTE_LINES = ["clue.drawerNote.l1", "clue.drawerNote.l2", "clue.drawerNote.l3"] as const;

/** 단서마다의 제목·본문 번역 키. 화면에도 쓰이고 키보드 목록의 이름도 여기서 온다. */
const CLUE_TEXT = {
  "drawer-note": { title: "clue.drawerNote.title", caption: "clue.drawerNote.caption" },
  "wall-calendar": { title: "clue.wallCalendar.title", caption: "clue.wallCalendar.caption" },
  "shelf-book": { title: "clue.shelfBook.title", caption: "clue.shelfBook.caption" },
  "desk-clock": { title: "clue.deskClock.title", caption: "clue.deskClock.caption" },
  workbook: { title: "clue.workbook.title", caption: "clue.workbook.caption" },
  mirror: { title: "clue.mirror.title", caption: "clue.mirror.caption" },
} as const satisfies Record<ClueId, { title: ParseKeys<"common">; caption: ParseKeys<"common"> }>;

/** 놀이책의 펼쳐진 쪽에 적힌 줄: 트럼프 항목의 앞부분만 보인다. */
const BOOK_LINES = ["clue.shelfBook.l1", "clue.shelfBook.l2"] as const;

/**
 * 화면에 안 보이는 조사 목록: 스크린리더와 키보드 전용.
 *
 * 3D 물건을 마우스로 집는 것 말고는 이 종이에 닿을 길이 없는데, 여기 적힌 것이
 * 컴퓨터 잠금을 여는 유일한 단서다. 방의 다른 곁가지(서랍·의자·커튼)와 달리
 * 못 만지면 콘텐츠가 통째로 막히므로 RoomInteractionPrompt와 같은 우회로를 둔다.
 *
 * 아직 열리면 안 되는 단서(조사 전의 달력)는 스토어가 막는다. 목록에는 늘 있고,
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
 * 미니게임이 아니다. 풀 것도, 성공/실패도, 진행에 남는 것도 없다. 컴퓨터
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
  // 종이(쪽지·책)와 들고 돌리는 물건(문제집)·거울은 좁게, 격자를 그리는 것(달력·시계)은 넓게 편다
  const narrow = isNote || clue === "shelf-book" || clue === "workbook" || clue === "mirror";

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center overflow-hidden p-4">
      <button
        type="button"
        aria-label={t("clue.close")}
        onClick={closeClue}
        className="absolute inset-0 cursor-pointer bg-scene-void/60 backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t(titleKey)}
        className={`relative w-full animate-fade-rise ${narrow ? "max-w-lg" : "max-w-xl"}`}
      >
        {/* 닫기는 종이 밖에 둔다. 종이 위에 UI 버튼이 얹히면 종이가 아니라 창이 된다 */}
        <button
          type="button"
          onClick={closeClue}
          aria-label={t("clue.close")}
          className={`${BUTTON_QUIET} absolute -top-12 right-0 px-3 py-1.5`}
        >
          <X size={14} weight="bold" />
          {t("clue.close")}
        </button>

        {isNote ? (
          <FoldedNote />
        ) : clue === "shelf-book" ? (
          <ShelfBook />
        ) : clue === "desk-clock" ? (
          <DeskClock />
        ) : clue === "workbook" ? (
          <WorkbookClue />
        ) : clue === "mirror" ? (
          /* 거울 속의 자기: 종이가 아니라 어두운 유리라 종이 판(PANEL_PAPER)을 두르지 않는다 */
          <CharacterModelViewer />
        ) : (
          <WallCalendar />
        )}

        <p className="monologue-text mt-4 break-ko text-pretty text-center text-sm leading-normal text-fog">
          {t(captionKey)}
        </p>
      </div>
    </div>
  );
}

/**
 * 서랍 속 접힌 쪽지.
 *
 * 종이는 그림(clue-note-paper.svg)이 그린다. 찢긴 윗변과 접힌 자국까지 CSS로
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
        글은 찢긴 윗변 바로 아래에서 시작한다. 가운데 정렬하면 접힌 자국(그림의
        y=253/400)이 글줄 한가운데를 가른다. 아래는 비워 둔다: 급히 적고 만 메모라
        종이가 남는 게 자연스럽다.
      */}
      <div className="absolute left-[13%] right-[8%] top-[17%] flex flex-col gap-3.5">
        {NOTE_LINES.map((key, index) => (
          <p
            key={key}
            className={`break-ko text-pretty leading-relaxed ${
              index === 0
                ? "text-lg font-medium text-ink"
                : index === NOTE_LINES.length - 1
                  ? "self-end text-sm text-graphite"
                  : "text-base text-ink"
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
 * 선반에서 뽑아 든 놀이책의 펼친 쪽: 게임기 2바퀴 카드 미궁의 규칙이 여기 있다.
 *
 * 규칙책으로 읽혀야지 문제 풀이로 읽히면 안 된다. 그래서 문양을 제 색으로 늘어놓기만
 * 하고, "이 중 틀린 것을 찾아라" 같은 말은 한 줄도 없다. 무엇에 쓰는 규칙인지는
 * 문제를 만난 사람이 알아본다 (src/data/room-clues.ts의 PUZZLE_CLUES).
 */
function ShelfBook() {
  const { t } = useTranslation();

  return (
    <div className={`p-6 sm:p-8 ${PANEL_PAPER}`}>
      <p className="border-b border-ink/10 pb-3 text-sm font-medium text-graphite">
        {t("clue.shelfBook.heading")}
      </p>
      {/* 색은 글로 적지 않고 문양을 제 색으로 찍어서 보여준다. 보면 아는 것을 설명하지 않는다 */}
      <ul className="flex items-center justify-center gap-6 py-6 sm:gap-9">
        {SUITS.map((suit) => (
          <li
            key={suit}
            className={`text-4xl leading-none sm:text-5xl ${
              suitColor(suit) === "red" ? "text-ember" : "text-ink"
            }`}
          >
            {SUIT_GLYPH[suit]}
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-2 border-t border-ink/10 pt-4">
        {BOOK_LINES.map((key) => (
          <p key={key} className="break-ko text-pretty text-base leading-relaxed text-ink">
            {t(key)}
          </p>
        ))}
      </div>
    </div>
  );
}

/** 각도 눈금을 매길 자리: 시계 방향 45° 간격. */
const CLOCK_TICKS = [0, 45, 90, 135, 180, 225, 270, 315] as const;
const CLOCK_RADIUS = 78;
const CLOCK_LABEL_RADIUS = 60;

/**
 * 캐비닛 위 탁상시계: 사인볼 2바퀴 회전 미궁의 단서.
 *
 * 방에 놓인 시계는 멈춘 시각(20:47)을 가리키는 소품이지만, 집어 들면 누군가 연필로
 * 눈금마다 각도를 적어 둔 게 보인다. 그림이 "시계 방향으로 몇 도"라는 읽는 법만
 * 주고, 문제에 어떤 각이 쓰였는지는 말하지 않는다.
 */
function DeskClock() {
  const { t } = useTranslation();

  return (
    <div className={`p-6 sm:p-8 ${PANEL_PAPER}`}>
      <p className="border-b border-ink/10 pb-3 text-sm font-medium text-graphite">
        {t("clue.deskClock.heading")}
      </p>
      <svg
        viewBox="-100 -100 200 200"
        role="img"
        aria-label={t("clue.deskClock.figure")}
        className="mx-auto my-4 w-full max-w-[16rem]"
      >
        <circle r={CLOCK_RADIUS} fill="none" stroke="currentColor" className="text-ink/15" />
        {CLOCK_TICKS.map((degrees) => {
          // SVG는 x축에서 시작해 시계 방향으로 돈다. 12시(위)에서 출발하도록 90도 뺀다
          const radians = ((degrees - 90) * Math.PI) / 180;
          return (
            <g key={degrees}>
              <line
                x1={Math.cos(radians) * (CLOCK_RADIUS - 9)}
                y1={Math.sin(radians) * (CLOCK_RADIUS - 9)}
                x2={Math.cos(radians) * CLOCK_RADIUS}
                y2={Math.sin(radians) * CLOCK_RADIUS}
                stroke="currentColor"
                strokeWidth={2}
                className="text-ink/35"
              />
              <text
                x={Math.cos(radians) * CLOCK_LABEL_RADIUS}
                y={Math.sin(radians) * CLOCK_LABEL_RADIUS}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={15}
                className="fill-ink/55 font-bold"
              >
                {degrees}
              </text>
            </g>
          );
        })}
        {/* 도는 방향을 화살표 하나로 못박는다. 반시계로 읽으면 답이 전부 뒤집힌다 */}
        <path
          d="M 0 -34 A 34 34 0 0 1 29 17"
          fill="none"
          stroke="currentColor"
          strokeWidth={3}
          strokeLinecap="round"
          className="text-memory"
        />
        <path d="M 29 17 l -11 -1 l 6 10 z" className="fill-memory" />
      </svg>
      <p className="break-ko text-pretty border-t border-ink/10 pt-4 text-base leading-relaxed text-ink">
        {t("clue.deskClock.l1")}
      </p>
    </div>
  );
}

/**
 * 조사를 마친 뒤의 달력: 이제는 벽에 걸린 배경 오브젝트다.
 *
 * 넘기는 미니게임과 달리 아무것도 완료하지 않고 애니메이션도 없다. 그냥 달을
 * 오가며 표시된 날을 확인하는 자리라, 비밀번호를 잊었을 때 다시 와서 볼 수 있다.
 * 처음 펼치는 달은 전국대회가 있던 달이다. 여기 오는 이유가 그것뿐이라서.
 */
function WallCalendar() {
  const { t } = useTranslation();
  const [month, setMonth] = useState<number>(NATIONALS_MONTH);

  /*
   * 正자 장(11월)까지는 안 간다. 거기엔 날짜 격자가 없어서 이 화면이 그릴 게
   * 없다. 그 장은 조사 미니게임이 보여주는 몫이다.
   */
  const turn = (step: -1 | 1) => {
    const next = Math.min(LAST_DATED_MONTH, Math.max(FIRST_MONTH, month + step));
    if (next === month) return;
    playSound("flip", { variation: 0.05 });
    setMonth(next);
  };

  return (
    <div className={`p-5 sm:p-6 ${PANEL_PAPER}`}>
      <div className="flex items-center justify-between gap-3 border-b border-ink/10 pb-3">
        <button
          type="button"
          aria-label={t("minigame.calendarFlip.prev")}
          onClick={() => turn(-1)}
          disabled={month === FIRST_MONTH}
          className="cursor-pointer rounded-full p-1.5 text-graphite transition-colors hover:bg-ink/5 hover:text-ink disabled:cursor-default disabled:opacity-25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-memory"
        >
          <CaretLeft size={20} weight="bold" />
        </button>
        <p className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-graphite">{CALENDAR_YEAR}</span>
          <span className="font-pixel text-2xl text-ink">
            {t("minigame.calendarFlip.month", { value: month })}
          </span>
        </p>
        <button
          type="button"
          aria-label={t("minigame.calendarFlip.next")}
          onClick={() => turn(1)}
          disabled={month === LAST_DATED_MONTH}
          className="cursor-pointer rounded-full p-1.5 text-graphite transition-colors hover:bg-ink/5 hover:text-ink disabled:cursor-default disabled:opacity-25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-memory"
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
