"use client";

import { CaretLeftIcon, CaretRightIcon, XIcon } from "@phosphor-icons/react";
import type { ParseKeys } from "i18next";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { InspectCapture } from "@/components/canvas/InspectTurntable";
import { shelfBookObject } from "@/components/canvas/inspect-objects";
import { CLUE_DISCOVERY, type ClueId, DRAWER_DIAL_CODE } from "@/data/room-clues";
import { reachableSpaces } from "@/data/spaces";
import { ASSETS } from "@/lib/assets";
import { playSound } from "@/lib/audio";
import {
  CALENDAR_YEAR,
  FIRST_MONTH,
  LAST_DATED_MONTH,
  NATIONALS_MONTH,
} from "@/minigames/calendar-flip/calendar";
import { MonthGrid } from "@/minigames/calendar-flip/MonthGrid";
import { CalendarPageImage, useCalendarPage } from "@/minigames/calendar-flip/PageImage";
import { openDoorwayIds, useMemoryRoomStore } from "@/store/memory-room";
import { useStillStore, WORKBOOK_STILL_KEY } from "@/store/stills";
import { BUTTON_QUIET, PANEL_PAPER } from "../shared/ui-classes";
import { CharacterModelViewer } from "./CharacterModelViewer";
import { listedClues } from "./clue-list";
import { InspectView } from "./InspectView";
import { WorkbookClue } from "./WorkbookClue";

/** 단서마다의 제목·본문 번역 키. 화면에도 쓰이고 키보드 목록의 이름도 여기서 온다. */
const CLUE_TEXT = {
  "wall-calendar": { title: "clue.wallCalendar.title", caption: "clue.wallCalendar.caption" },
  "shelf-book": { title: "clue.shelfBook.title", caption: "clue.shelfBook.caption" },
  workbook: { title: "clue.workbook.title", caption: "clue.workbook.caption" },
  mirror: { title: "clue.mirror.title", caption: "clue.mirror.caption" },
  "raon-badge": { title: "clue.raonBadge.title", caption: "clue.raonBadge.caption" },
} as const satisfies Record<ClueId, { title: ParseKeys<"common">; caption: ParseKeys<"common"> }>;

/** 놀이책의 펼쳐진 쪽에 적힌 줄: 트럼프 항목의 앞부분만 보인다. */

/**
 * 화면에 안 보이는 조사 목록: 스크린리더와 키보드 전용.
 *
 * 3D 물건을 마우스로 집는 것 말고는 이 종이에 닿을 길이 없는데, 여기 적힌 것이
 * 컴퓨터 잠금을 여는 유일한 단서다. 방의 다른 곁가지(서랍·의자·커튼)와 달리
 * 못 만지면 콘텐츠가 통째로 막히므로 RoomInteractionPrompt와 같은 우회로를 둔다.
 *
 * 아직 열리면 안 되는 단서(조사 전의 달력)는 스토어가 막는다. 목록에는 늘 있고,
 * 눌러도 아무 일이 없다. 목록에서 지웠다 나타나면 "여긴 아무것도 없다"로 읽힌다.
 * 다만 아직 못 가 본 공간의 단서는 올리지 않는다: 이름이 곧 스포일러다 (clue-list.ts).
 */
function ClueKeyboardList() {
  const { t } = useTranslation();
  const openClue = useMemoryRoomStore((state) => state.openClue);
  const doorOpened = useMemoryRoomStore((state) => state.doorOpened);
  const openedDoorways = useMemoryRoomStore((state) => state.openedDoorways);
  const clues = useMemo(
    () => listedClues(reachableSpaces(openDoorwayIds({ doorOpened, openedDoorways }))),
    [doorOpened, openedDoorways],
  );

  // sr-only를 감싼 div에 거는 것도 RoomInteractionPrompt와 같은 이유다: fieldset은
  // 1px로 눌러지지 않아서, 자르는 일은 바깥 div가 해야 한다
  return (
    <div className="sr-only">
      <fieldset>
        {clues.map((id) => (
          <button key={id} type="button" onClick={() => openClue(id)}>
            {t("clue.read", { name: t(CLUE_TEXT[id].title) })}
          </button>
        ))}
      </fieldset>
    </div>
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
  const storeCloseClue = useMemoryRoomStore((state) => state.closeClue);
  const setUiLock = useMemoryRoomStore((state) => state.setUiLock);
  const open = clue !== null;
  const captureRef = useRef<InspectCapture | null>(null);

  /*
   * 문제집에서 이름을 찾고 내려놓으면 이름 대사가 이어진다. 그 대사는 방금 본 뒤표지 위에
   * 흘러야 "무엇을 보고 한 말인지"가 이어진다: 판이 걷히기 전에 한 장을 찍어 둔다
   * (PlaybackScene이 그 컷씬 동안 세운다). 이름 대사가 안 이어지는 닫기는 찍지 않는다.
   */
  const closeClue = useCallback(() => {
    if (clue === "workbook" && useMemoryRoomStore.getState().nameIntroPending) {
      const still = captureRef.current?.();
      if (still) useStillStore.getState().putStill(WORKBOOK_STILL_KEY, still);
    }
    storeCloseClue();
  }, [clue, storeCloseClue]);

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
  // 종이(쪽지·책)와 들고 돌리는 물건(문제집)·거울은 좁게, 격자를 그리는 것(달력)은 넓게 편다
  const narrow =
    clue === "shelf-book" || clue === "workbook" || clue === "mirror" || clue === "raon-badge";

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
          <XIcon size={14} weight="bold" />
          {t("clue.close")}
        </button>

        {clue === "shelf-book" ? (
          <ShelfBookInspect />
        ) : clue === "workbook" ? (
          <WorkbookClue captureRef={captureRef} />
        ) : clue === "mirror" ? (
          /* 거울 속의 자기: 종이가 아니라 어두운 유리라 종이 판(PANEL_PAPER)을 두르지 않는다 */
          <CharacterModelViewer />
        ) : clue === "raon-badge" ? (
          <RaonBadgeZoom />
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
 * 선반에서 뽑아 든 거꾸로 꽂힌 책 (3D 인스펙트, v4.1 3장). 아빠 메일 "선반 정리 좀
 * 해라."를 읽은 뒤에만 만질 수 있다. 장을 넘기면 귀 접힌 쪽에 쪽지가 끼워져 있고,
 * 손으로 적은 세 자리 번호: 협탁 서랍의 자물쇠 번호다 (room-clues의 DRAWER_DIAL_CODE).
 */
function ShelfBookInspect() {
  const { t } = useTranslation();
  const discover = useMemoryRoomStore((state) => state.discover);
  const object = useMemo(
    () => shelfBookObject(t("clue.shelfBook.bookTitle"), DRAWER_DIAL_CODE),
    [t],
  );
  const onFound = useCallback(() => {
    const code = CLUE_DISCOVERY["shelf-book"];
    if (useMemoryRoomStore.getState().discoveries.includes(code)) return;
    playSound("flip", { variation: 0.05 });
    discover(code);
  }, [discover]);
  return (
    <InspectView
      object={object}
      alt={t("clue.shelfBook.alt")}
      hint={t("clue.shelfBook.hint")}
      onFound={onFound}
    />
  );
}

/**
 * 세면대 바닥에서 건진 출입증 배지의 확대 화면.
 *
 * 뒤집을 면도 넘길 장도 없다. 물을 빼는 손이 이미 뒤집기였고, 여기서 보여줄 것은 로고와
 * 그 아래 적힌 이름 하나다. 로고는 앰플 라벨·컴퓨터의 저장된 그림과 같은 그림 파일
 * (ui-raon-logo.svg)이라, 컴퓨터 3차에서 넷 중 이것을 고를 수 있게 된다. 발견(discoveries)은
 * 펼치는 순간 스토어가 적고, 내려놓으면 한 줄이 흐른다 (store의 openClue · closeClue).
 */
function RaonBadgeZoom() {
  const { t } = useTranslation();
  return (
    <div className={`flex flex-col items-center gap-5 px-6 py-8 sm:py-10 ${PANEL_PAPER}`}>
      {/* 목걸이 끈: 배지가 줄에 달려 있던 물건이라는 것만 말한다 */}
      <div aria-hidden className="h-10 w-3 rounded-b-sm bg-ink/70" />
      <div className="flex size-44 items-center justify-center rounded-full border-4 border-ink/15 bg-paper shadow-panel sm:size-52">
        {/* SVG는 최적화 파이프라인을 안 탄다 (next/image의 svg 금지): 그대로 내려 그린다 */}
        <Image
          src={ASSETS.images.raonLogo}
          alt={t("clue.raonBadge.alt")}
          width={256}
          height={256}
          unoptimized
          className="size-3/4"
        />
      </div>
      <p className="break-ko text-center text-lg font-bold tracking-[0.12em] text-ink">
        {t("clue.raonBadge.name")}
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
  const page = useCalendarPage(month);

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
          <CaretLeftIcon size={20} weight="bold" />
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
          <CaretRightIcon size={20} weight="bold" />
        </button>
      </div>
      {/* 넘기는 미니게임과 같은 장 그림. 판이 넓어도 세로로 너무 길어지지 않게 폭을 묶는다 */}
      <div className="mx-auto w-full max-w-[22rem] pt-4">
        {page ? <CalendarPageImage month={month} source={page} /> : <MonthGrid month={month} />}
      </div>
    </div>
  );
}
