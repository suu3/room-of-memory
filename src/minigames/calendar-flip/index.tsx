"use client";

import { CaretLeft, CaretRight, Check } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ASSETS } from "@/lib/assets";
import { playSound } from "@/lib/audio";
import type { MinigameProps } from "@/types/minigame";
import {
  CALENDAR_MONTHS,
  CALENDAR_YEAR,
  FIRST_MONTH,
  type FlipDirection,
  flipMonth,
  isAftermath,
  isLastPage,
  LAST_MONTH,
  START_MONTH,
  survivedDays,
  tallyGroups,
} from "./calendar";
import { MonthGrid } from "./MonthGrid";

/** 넘기는 애니메이션 길이. globals.css의 calendar-flip-*과 맞춘다. */
const FLIP_MS = 380;

/** 사건 이후 장 — 날짜 대신 버틴 날을 세는 正자만 남는다. */
function TallySheet({ days, label }: { days: number; label: string }) {
  const { full, remainder } = tallyGroups(days);
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-4">
      <div className="flex max-w-[16rem] flex-wrap items-center justify-center gap-x-2 gap-y-1">
        {Array.from({ length: full }, (_, index) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: 같은 글자의 반복이라 인덱스 말고 구분할 값이 없다.
            key={`mark-${index}`}
            className="font-pixel text-2xl leading-none text-ink/80"
          >
            正
          </span>
        ))}
        {remainder > 0 ? (
          <span className="flex items-end gap-[3px]" aria-hidden>
            {Array.from({ length: remainder }, (_, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: 획 하나하나에 이름이 없다.
              <span key={`stroke-${index}`} className="h-5 w-[2px] bg-ink/70" />
            ))}
          </span>
        ) : null}
      </div>
      <p className="text-xs tracking-widest text-ink/45">{label}</p>
    </div>
  );
}

/** 평범했던 달 — 날짜 격자. 표시된 날은 MonthGrid가 그린다. */
function MonthSheet({ month }: { month: number }) {
  return (
    <div className="h-64 overflow-hidden">
      <MonthGrid month={month} />
    </div>
  );
}

/**
 * 달력 한 장의 내용.
 *
 * 그림이 있으면 그림 한 장이 곧 그 달이고, 없으면 코드가 그리는 격자·正자 장이
 * 그대로 선다. 그림은 아직 리포에 없어도 되므로(.claude/rules/assets.md) 404가
 * 곧 고장이 되면 안 된다 — 못 받으면 조용히 대체 장이 그 자리를 지킨다.
 *
 * <img onError>로 떨어뜨리지 않는 이유는, 그러면 파일이 없을 때 깨진 그림 자리가
 * 한 번 보였다가 대체 장으로 바뀌기 때문이다. 대체 장을 먼저 세우고 그림이 실제로
 * 받아졌을 때만 갈아 끼운다 (fighter-duel/sprites.ts가 시트에 쓰는 방식과 같다).
 */
function useImageReady(source: string | undefined): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    if (!source) return;

    let cancelled = false;
    const image = new Image();
    const settle = (ok: boolean) => {
      if (!cancelled && ok) setReady(true);
    };
    image.onload = () => settle(image.naturalWidth > 0);
    image.onerror = () => settle(false);
    image.src = source;
    // 캐시에 이미 있으면 onload가 안 울린다
    if (image.complete) settle(image.naturalWidth > 0);

    return () => {
      cancelled = true;
    };
  }, [source]);

  return ready;
}

function PageContent({ month }: { month: number }) {
  const { t } = useTranslation();
  const source = ASSETS.images.mgCalendarFlipPages[month];
  const ready = useImageReady(source);

  if (source && ready) {
    return (
      // biome-ignore lint/performance/noImgElement: 그림 한 장이 곧 이 장이라 원본 비율 그대로 쓴다.
      <img
        src={source}
        alt={t("minigame.calendarFlip.month", { value: month })}
        draggable={false}
        className="block h-64 w-full select-none object-contain"
      />
    );
  }

  return isAftermath(month) ? (
    <TallySheet
      days={survivedDays(CALENDAR_YEAR, month)}
      label={t("minigame.calendarFlip.survived", { value: survivedDays(CALENDAR_YEAR, month) })}
    />
  ) : (
    <MonthSheet month={month} />
  );
}

/** 달력 한 장 — 머리글(해·월)과 내용. 넘어가는 종이와 밑장이 같은 걸 쓴다. */
function CalendarSheet({ month }: { month: number }) {
  const { t } = useTranslation();

  return (
    <div className="h-full rounded-md bg-paper p-4 shadow-panel">
      <div className="flex items-baseline justify-between border-b border-ink/10 pb-2">
        <p className="text-sm font-bold tracking-widest text-ink/45">{CALENDAR_YEAR}</p>
        <p className="font-pixel text-3xl font-bold text-ink">
          {t("minigame.calendarFlip.month", { value: month })}
        </p>
      </div>
      <div className="pt-3">
        <PageContent month={month} />
      </div>
    </div>
  );
}

interface Flip {
  direction: FlipDirection;
  /** 넘어가는 종이에 인쇄된 달. next면 떠나는 달, prev면 되돌아오는 달이다. */
  sheet: number;
  /** 넘김이 끝난 뒤 밑에 남는 달. */
  under: number;
  key: number;
}

/**
 * 벽에 걸린 달력을 한 장씩 넘겨본다.
 *
 * 이기고 지는 게임이 아니다 — 앞쪽은 평범한 달력이고, 사건이 있던 달을 지나면
 * 날짜가 사라지고 버틴 날을 세는 正자만 남는다. 마지막 장까지 넘기면 다 본 것으로
 * 친다. 도중에 닫으면 아무 일도 없었던 것처럼 다시 열 수 있다 (방탈출 탐색).
 *
 * 넘김은 종이 한 장이 위쪽 스프링을 축으로 보는 쪽으로 들려 넘어가는 3D 회전이다.
 * 그 밑에 다음 장이 미리 깔려 있어 젖혀지는 동안 드러난다.
 */
export function CalendarFlipMinigame({ onComplete }: MinigameProps) {
  const { t } = useTranslation();
  const [month, setMonth] = useState(START_MONTH);
  const [flip, setFlip] = useState<Flip | null>(null);
  const flipTimer = useRef<number | null>(null);
  const doneRef = useRef(false);

  /*
   * 넘김마다 올라가는 번호. 종이 엘리먼트의 key로 써서 매번 새로 마운트시킨다 —
   * 달 조합(7→8)을 key로 삼으면 같은 넘김을 연달아 할 때 key가 겹쳐 애니메이션이
   * 처음부터 다시 돌지 않는다.
   */
  const flipSeq = useRef(0);

  const turn = useCallback(
    (direction: FlipDirection) => {
      const next = flipMonth(month, direction);
      if (next === month) return;

      // 사건 이후 장에는 날짜가 없고 正자만 있다. 넘기는 소리도 종이가 아니라
      // 연필이어야 그 장이 "달력"이 아니라 "기록"이라는 게 귀로 먼저 온다.
      playSound(isAftermath(next) ? "pencilStroke" : "flip", { variation: 0.05 });
      flipSeq.current += 1;
      setFlip({
        direction,
        // 앞으로 넘기면 지금 장이 젖혀지고, 되돌리면 이전 장이 도로 내려온다
        sheet: direction === "next" ? month : next,
        under: direction === "next" ? next : month,
        key: flipSeq.current,
      });
      setMonth(next);
    },
    [month],
  );

  // 넘김이 끝나면 종이를 걷어낸다 — 그 자리엔 이미 같은 장이 밑장으로 서 있다.
  useEffect(() => {
    if (!flip) return;
    flipTimer.current = window.setTimeout(() => setFlip(null), FLIP_MS);
    return () => {
      if (flipTimer.current !== null) window.clearTimeout(flipTimer.current);
    };
  }, [flip]);

  useEffect(
    () => () => {
      if (flipTimer.current !== null) window.clearTimeout(flipTimer.current);
    },
    [],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code === "ArrowLeft") {
        event.preventDefault();
        turn("prev");
      } else if (event.code === "ArrowRight") {
        event.preventDefault();
        turn("next");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [turn]);

  /*
   * 되돌리기는 넘김을 거꾸로 돌린 것이다. 키프레임을 한 벌 더 만드는 대신 방향만
   * 뒤집으면, 그늘·그림자까지 저절로 짝이 맞는다 — 두 벌을 손으로 맞추다 어긋나는
   * 자리를 아예 없앤다.
   */
  const reversed = flip?.direction === "prev" ? "[animation-direction:reverse]" : "";

  return (
    <div className="flex animate-fade-rise flex-col items-center gap-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={t("minigame.calendarFlip.prev")}
          onClick={() => turn("prev")}
          disabled={month === FIRST_MONTH}
          className="cursor-pointer rounded-full border border-bone/25 p-2 text-bone/70 transition-all hover:border-bone/60 hover:text-paper disabled:cursor-default disabled:opacity-20"
        >
          <CaretLeft size={22} weight="bold" />
        </button>

        {/* 벽걸이 달력 한 장 */}
        <div className="w-[19rem] max-w-[80vw]">
          {/* 스프링 제본 — 넘어가는 종이가 매달리는 축이라 판 위에 그대로 둔다 */}
          <div aria-hidden className="flex justify-center gap-3 pb-1">
            {Array.from({ length: 7 }, (_, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: 장식용 고리라 구분할 값이 없다.
              <span key={`ring-${index}`} className="h-3 w-1.5 rounded-full bg-bone/50" />
            ))}
          </div>

          {/*
            축(스프링) 위쪽은 잘라 낸다.

            종이는 위쪽 축에 매달려 있어 아무리 돌아도 축에서부터 위로만 뻗는다 —
            자르지 않으면 90도를 넘긴 종이가 달력 위에 통째로 선 채 남았다가 툭
            사라진다. 잘라 두면 링을 넘어가며 사라지는, 벽걸이 달력이 실제로 하는
            모양이 된다. 위만 자르고 나머지 세 방향은 넓혀 둔다 — 판의 그림자까지
            같이 자르지 않으려고.
          */}
          <div className="[clip-path:inset(0_-100%_-100%_-100%)]">
            {/*
              넘김 무대. 밑장은 흐름을 따라가는 보통 요소라 높이를 정하고, 넘어가는
              종이만 그 위에 절대배치로 겹친다 — 그래야 판 높이가 넘길 때마다 흔들리지 않는다.

              perspective는 900px, 소실점은 축과 같은 자리(위쪽 가운데)에 둔다. 판 너비의
              세 배쯤이라야 아래 모서리가 보는 쪽으로 나오는 게 읽힌다 — 1400px에서는
              거의 정사영이라 넘김이 아니라 세로로 접히는 블라인드처럼 보였다.
            */}
            <div className="relative [perspective-origin:50%_0] [perspective:900px]">
              <CalendarSheet month={flip ? flip.under : month} />

              {flip && (
                <>
                  {/* 들린 종이가 밑장에 드리우는 그림자 — 종이의 발자국을 따라 걷힌다 */}
                  <div
                    key={`cast-${flip.key}`}
                    aria-hidden
                    className={`animate-calendar-cast pointer-events-none absolute inset-0 origin-top rounded-md [background:linear-gradient(to_bottom,color-mix(in_srgb,var(--color-scene-void)_72%,transparent),transparent_58%)] ${reversed}`}
                  />
                  <div
                    key={`sheet-${flip.key}`}
                    className={`animate-calendar-flip absolute inset-0 origin-top ${reversed}`}
                  >
                    <CalendarSheet month={flip.sheet} />
                    {/* 젖혀지는 만큼 빛을 잃는다 */}
                    <div
                      aria-hidden
                      className={`animate-calendar-shade pointer-events-none absolute inset-0 rounded-md bg-scene-void ${reversed}`}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          aria-label={t("minigame.calendarFlip.next")}
          onClick={() => turn("next")}
          disabled={month === LAST_MONTH}
          className="cursor-pointer rounded-full border border-bone/25 p-2 text-bone/70 transition-all hover:border-bone/60 hover:text-paper disabled:cursor-default disabled:opacity-20"
        >
          <CaretRight size={22} weight="bold" />
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <p className="text-xs tracking-widest text-bone/50">
          {t("minigame.calendarFlip.pageOf", {
            value: month - FIRST_MONTH + 1,
            total: CALENDAR_MONTHS.length,
          })}
        </p>
        {isLastPage(month) ? (
          <button
            type="button"
            onClick={() => {
              if (doneRef.current) return;
              doneRef.current = true;
              onComplete({ cleared: true });
            }}
            className="flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full bg-paper px-5 py-1.5 text-xs font-bold tracking-widest text-ink transition-all hover:-translate-y-0.5 active:translate-y-0"
          >
            <Check size={14} weight="bold" />
            {t("minigame.calendarFlip.close")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
