"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { NATIONALS_DATE } from "@/data/room-clues";
import { ASSETS } from "@/lib/assets";
import { blurBackdrop } from "@/lib/image-blur";
import {
  CALENDAR_YEAR,
  dayAnchor,
  isAftermath,
  leadingBlanks,
  notesOf,
  PAGE_IMAGE,
  survivedDays,
} from "./calendar";

/** 한 번 받아진 장 그림. 넘길 때마다 새로 서는 종이가 대체 장을 한 번 거쳐 튀지 않게 기억해 둔다. */
const loadedPages = new Set<string>();

function loadPage(source: string, onReady?: () => void): () => void {
  let cancelled = false;
  const image = new Image();
  const settle = () => {
    if (image.naturalWidth === 0) return;
    loadedPages.add(source);
    if (!cancelled) onReady?.();
  };
  image.onload = settle;
  image.src = source;
  // 캐시에 이미 있으면 onload가 안 울린다
  if (image.complete) settle();
  return () => {
    cancelled = true;
  };
}

/** 걸린 장 그림을 미리 받아 둔다. 달력이 열릴 때 한 번. */
export function preloadCalendarPages(): void {
  for (const source of Object.values(ASSETS.images.mgCalendarFlipPages)) {
    if (source && !loadedPages.has(source)) loadPage(source);
  }
}

/**
 * 그 달의 장 그림 주소. 아직 못 받았으면 undefined라 부르는 쪽이 대체 장을 세운다.
 *
 * 그림은 리포에 없어도 되므로(.claude/rules/assets.md) 404가 곧 고장이 되면 안 된다.
 * <img onError>로 떨어뜨리면 깨진 그림 자리가 한 번 보였다가 바뀌므로, 대체 장을 먼저
 * 세우고 그림이 실제로 받아졌을 때만 갈아 끼운다.
 */
export function useCalendarPage(month: number): string | undefined {
  const source = ASSETS.images.mgCalendarFlipPages[month];
  const [ready, setReady] = useState(() => source !== undefined && loadedPages.has(source));

  useEffect(() => {
    if (!source) {
      setReady(false);
      return;
    }
    if (loadedPages.has(source)) {
      setReady(true);
      return;
    }
    setReady(false);
    return loadPage(source, () => setReady(true));
  }, [source]);

  return ready ? source : undefined;
}

/*
 * 그림 위에 얹는 것들의 크기. 전부 그림 좌표(1080×1600)의 px로 적고 비율로 바꿔 쓴다.
 * 글씨 크기는 cqw(그림 폭 대비)라 판이 커지든 작아지든 그림과 같이 늘고 준다.
 */
const W = PAGE_IMAGE.width;
const H = PAGE_IMAGE.height;
/** 날짜 숫자를 두르는 금빛 동그라미의 지름. */
const RING_SIZE = 92;
/** 메모 글씨 크기. */
const MEMO_FONT = 34;
/**
 * 메모가 차지하는 폭: 한 칸 반 남짓. 칸 폭(134)에 가두면 "연습시합 vs 동성고"가 네 줄로
 * 쪼개진다. 손으로 쓴 메모가 옆 칸 아래로 조금 삐져나가는 건 실제 달력도 그렇다.
 * 메모가 있는 날 옆 칸에는 메모가 없다 (테스트가 지킨다).
 */
const MEMO_WIDTH = 230;
/** 칸 위쪽에서 메모 첫 줄까지. 숫자 밑이다. 금빛 동그라미가 있는 날은 동그라미 밑. */
const MEMO_TOP = 80;
const MEMO_TOP_RINGED = 102;
/** 11월 밑 여백에 적는 버틴 날 수의 자리. */
const TALLY_LABEL_Y = 1528;

const pct = (value: number, of: number) => `${((value / of) * 100).toFixed(3)}%`;
const cqw = (px: number) => `${((px / W) * 100).toFixed(3)}cqw`;

/**
 * 그 날 칸 밑에 적힌 메모 한 덩이의 자리.
 *
 * 가운데를 그 칸에 맞추되 격자 밖으로는 안 나간다. 월요일·일요일 칸은 한쪽으로
 * 넘칠 자리가 없으니, 칸의 바깥 가장자리에 붙여 안쪽(옆 칸)으로만 흘린다. 가운데
 * 정렬로 두면 글씨가 제 칸을 떠나 옆 칸 메모처럼 읽힌다.
 */
function memoStyle(month: number, day: number, top: number): CSSProperties {
  const index = leadingBlanks(CALENDAR_YEAR, month) + day - 1;
  const column = index % 7;
  const cellLeft = PAGE_IMAGE.gridLeft + column * PAGE_IMAGE.cellWidth;
  const cellTop = PAGE_IMAGE.gridTop + Math.floor(index / 7) * PAGE_IMAGE.cellHeight;
  const inset = 12;

  const placement: CSSProperties =
    column === 0
      ? { left: pct(cellLeft + inset, W), textAlign: "left" }
      : column === 6
        ? { right: pct(W - (cellLeft + PAGE_IMAGE.cellWidth - inset), W), textAlign: "right" }
        : {
            left: pct(cellLeft + PAGE_IMAGE.cellWidth / 2 - MEMO_WIDTH / 2, W),
            textAlign: "center",
          };

  return {
    ...placement,
    top: pct(cellTop + top, H),
    width: pct(MEMO_WIDTH, W),
    fontSize: cqw(MEMO_FONT),
  };
}

/**
 * 장 그림 한 장과 그 위에 손으로 적힌 것들.
 *
 * 그림은 빈 달력이고(11월만 正자 낙서가 그려져 있다), 글씨와 표시는 코드가 얹는다.
 * 그림에 글씨를 굽지 않는 이유가 둘이다. 메모가 ko/en/ja를 따라 바뀌어야 하고,
 * 비밀번호의 숫자가 전국대회 날의 금빛 동그라미 하나에서 나오므로 그 자리가 대체 장
 * (MonthGrid)과 같은 데이터에서 나와야 한다.
 */
export function CalendarPageImage({ month, source }: { month: number; source: string }) {
  const { t } = useTranslation();
  const notes = notesOf(month);
  const isNationalsMonth = month === NATIONALS_DATE.month;
  const ring = isNationalsMonth ? dayAnchor(month, NATIONALS_DATE.day) : null;

  return (
    <div
      className="relative w-full [container-type:inline-size]"
      style={{ aspectRatio: `${W} / ${H}` }}
    >
      {/* biome-ignore lint/performance/noImgElement: 그림 한 장이 곧 이 장이고, 글씨를 같은 비율로 얹어야 한다. */}
      <img
        src={source}
        alt={t("minigame.calendarFlip.month", { value: month })}
        draggable={false}
        style={blurBackdrop(source, "fill")}
        className="absolute inset-0 size-full select-none"
      />

      {ring ? (
        <span
          aria-hidden
          className="absolute aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full bg-memory/15 ring-2 ring-memory"
          style={{ left: pct(ring.x * W, W), top: pct(ring.y * H, H), width: pct(RING_SIZE, W) }}
        />
      ) : null}

      {/* 연필 메모: 살짝 기울어 손으로 적은 티를 낸다 */}
      {notes.map((note) => (
        <p
          key={note.key}
          className="absolute -rotate-2 text-center font-medium leading-[1.1] break-keep text-graphite"
          style={memoStyle(month, note.day, MEMO_TOP)}
        >
          {t(`minigame.calendarFlip.note.${note.key}`)}
        </p>
      ))}
      {isNationalsMonth ? (
        <p
          className="absolute -rotate-2 text-center font-bold leading-[1.1] break-keep text-ink"
          style={memoStyle(month, NATIONALS_DATE.day, MEMO_TOP_RINGED)}
        >
          {t("minigame.calendarFlip.note.nationals")}
        </p>
      ) : null}

      {/* 사건 뒤의 장: 正자 밑 여백에 버틴 날 수 */}
      {isAftermath(month) ? (
        <p
          className="absolute inset-x-0 -translate-y-1/2 text-center tracking-widest text-ink/55"
          style={{ top: pct(TALLY_LABEL_Y, H), fontSize: cqw(MEMO_FONT) }}
        >
          {t("minigame.calendarFlip.survived", { value: survivedDays(CALENDAR_YEAR, month) })}
        </p>
      ) : null}
    </div>
  );
}
