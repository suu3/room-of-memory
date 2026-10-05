"use client";

import {
  ArrowClockwiseIcon,
  ArrowCounterClockwiseIcon,
  ArrowsOutLineVerticalIcon,
  CaretDownIcon,
  CaretLeftIcon,
  CaretRightIcon,
  CaretUpIcon,
  MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon,
} from "@phosphor-icons/react";
import dynamic from "next/dynamic";
import {
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import type { InspectObject } from "@/components/canvas/InspectTurntable";
import { inspectControlOf } from "@/components/canvas/InspectTurntable";
import { clampPage, swipeStep, UNFOLD_PX } from "@/components/canvas/inspect-math";
import { playSound } from "@/lib/audio";
import { STAGE_ICON_BUTTON } from "../shared/ui-classes";
import { TURN_STEP, useTurntableDrag } from "./use-turntable-drag";

/** Canvas는 클라이언트에서만 뜬다 (.claude/rules/r3f.md): 물건을 집어 들 때 비로소 받는다. */
const InspectTurntable = dynamic(() => import("@/components/canvas/InspectTurntable"), {
  ssr: false,
});

/** 확대 범위. */
const ZOOM_MIN = 1;
const ZOOM_MAX = 2.4;
/** 휠 한 칸(deltaY 100)에 곱해지는 배율. 다섯 칸쯤 굴리면 끝까지 간다. */
const WHEEL_ZOOM_RATE = 0.0018;
/** 버튼 한 번에 곱해지는 배율. */
const ZOOM_STEP = 1.35;
/** 기울이기 버튼 한 번에 끄는 픽셀. 0.15rad씩, 다섯 번이면 끝까지 눕는다. */
const TILT_STEP_PX = 25;
/** 조작 안내가 떠 있는 시간(ms). 그 전에 물건을 잡으면 바로 걷힌다. */
const HINT_MS = 4500;

/**
 * 집어 든 물건을 살펴보는 판 (3D 인스펙트의 DOM 쪽, v4.1 2장).
 *
 * 물건마다 손이 하는 일이 다르다 (InspectTurntable의 `InspectControl`):
 *   turn    좌우로 끌어 돌리고, 휠·버튼으로 당기고, 당긴 뒤에는 세로로 끌어 옮긴다
 *   tilt    좌우로 돌리고, 세로로 끌어 기울인다 (출입증의 홀로그램)
 *   unfold  세로로 끌어 올려 편다 (접힌 쪽지)
 *   pages   좌우로 끌어 장을 넘긴다 (책)
 * 끄는 건 마우스·손가락의 몫이라 키보드에는 같은 일을 하는 버튼을 준다. 무엇을 찾아야
 * 하는지는 적지 않는다: 만져 본 사람만 본다.
 *
 * `object`는 부르는 쪽이 useMemo로 붙잡아 넘긴다 (inspect-objects.ts). 새 객체가 오면
 * 면 그림을 다시 굽는다.
 */
export function InspectView({
  object,
  alt,
  hint,
  hintPinned = false,
  onFound,
  className = "",
}: {
  object: InspectObject;
  /** 스크린리더가 읽는 물건의 이름. */
  alt: string;
  /** 판 아래 조작 안내 한 줄. */
  hint: string;
  /**
   * 안내를 걷지 않고 세워 둔다. 찾아야 다음으로 넘어가는 물건(첫 문제집)은 찾기 전까지
   * 무엇을 해 보라는 말이 남아 있어야 한다. 몇 번 돌려 보고 내려놓으면 아무 일도 없어서
   * 같은 안내만 되풀이됐다.
   */
  hintPinned?: boolean;
  /** 찾을 것을 읽었을 때 한 번. */
  onFound: () => void;
  className?: string;
}) {
  const { t } = useTranslation();
  const control = useMemo(() => inspectControlOf(object), [object]);
  const { yawRef, dragYRef, turn, handlers } = useTurntableDrag();
  const zoomRef = useRef(ZOOM_MIN);

  const zoomBy = useCallback((factor: number) => {
    zoomRef.current = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoomRef.current * factor));
  }, []);

  const onWheel = useCallback(
    (event: ReactWheelEvent<HTMLDivElement>) => {
      // 위로 굴리면(deltaY 음수) 당겨진다. 지도와 같은 방향
      zoomBy(Math.exp(-event.deltaY * WHEEL_ZOOM_RATE));
    },
    [zoomBy],
  );

  /*
   * 장 넘기기: 각도가 아니라 장 수를 쥔다. 버튼의 활성 여부가 장 수를 따르므로 state로도
   * 비춘다 (한 장에 한 번 바뀌는 값이라 리렌더가 부담이 아니다). 판은 ref를 읽는다.
   */
  const sheets = control.kind === "pages" ? control.sheets : 0;
  const pageRef = useRef(0);
  const [page, setPage] = useState(0);
  const flipTo = useCallback(
    (next: number) => {
      const clamped = clampPage(next, sheets);
      if (clamped === pageRef.current) return;
      pageRef.current = clamped;
      setPage(clamped);
      playSound("flip", { variation: 0.06 });
    },
    [sheets],
  );
  const swipeRef = useRef<{ pointerId: number; x: number } | null>(null);
  const pageHandlers = useMemo(
    () => ({
      onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
        swipeRef.current = { pointerId: event.pointerId, x: event.clientX };
      },
      onPointerUp: (event: ReactPointerEvent<HTMLElement>) => {
        const swipe = swipeRef.current;
        if (!swipe || swipe.pointerId !== event.pointerId) return;
        swipeRef.current = null;
        flipTo(pageRef.current + swipeStep(event.clientX - swipe.x));
      },
      onPointerCancel: () => {
        swipeRef.current = null;
      },
    }),
    [flipTo],
  );

  // 안내는 처음에만: 손이 물건을 잡았거나 잠시 지나면 걷혀 무대에 물건만 남는다
  const [hintShown, setHintShown] = useState(true);
  useEffect(() => {
    const timer = window.setTimeout(() => setHintShown(false), HINT_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div
      className={`inspect-stage relative overflow-hidden rounded-lg border border-line shadow-panel ${className}`}
    >
      <div
        role="img"
        aria-label={alt}
        {...(control.kind === "pages" ? pageHandlers : handlers)}
        onPointerDownCapture={() => setHintShown(false)}
        onWheel={onWheel}
        className="h-64 w-full cursor-grab touch-none overscroll-contain active:cursor-grabbing sm:h-80"
      >
        <InspectTurntable
          object={object}
          yawRef={yawRef}
          zoomRef={zoomRef}
          dragYRef={dragYRef}
          pageRef={pageRef}
          onFound={onFound}
        />
      </div>
      <p
        className={`pointer-events-none absolute inset-x-0 top-3 px-4 text-center text-xs text-fog transition-opacity duration-500 ${hintShown || hintPinned ? "opacity-100" : "opacity-0"}`}
      >
        {hint}
      </p>
      <div className="flex justify-center pb-3">
        <div className="flex items-center gap-0.5 rounded-full border border-line bg-surface p-1 backdrop-blur-sm">
          {control.kind === "pages" ? (
            <>
              <button
                type="button"
                onClick={() => flipTo(page - 1)}
                disabled={page <= 0}
                aria-label={t("minigame.inspect.prevPage")}
                className={`${STAGE_ICON_BUTTON} disabled:cursor-default disabled:opacity-30`}
              >
                <CaretLeftIcon size={15} weight="bold" />
              </button>
              <span
                className="min-w-10 text-center text-xs tabular-nums text-fog"
                aria-live="polite"
              >
                {t("minigame.inspect.page", { value: page, total: sheets })}
              </span>
              <button
                type="button"
                onClick={() => flipTo(page + 1)}
                disabled={page >= sheets}
                aria-label={t("minigame.inspect.nextPage")}
                className={`${STAGE_ICON_BUTTON} disabled:cursor-default disabled:opacity-30`}
              >
                <CaretRightIcon size={15} weight="bold" />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => turn(-TURN_STEP)}
                aria-label={t("characterSheet.turnLeft")}
                className={STAGE_ICON_BUTTON}
              >
                <ArrowCounterClockwiseIcon size={15} weight="bold" />
              </button>
              <button
                type="button"
                onClick={() => turn(TURN_STEP)}
                aria-label={t("characterSheet.turnRight")}
                className={STAGE_ICON_BUTTON}
              >
                <ArrowClockwiseIcon size={15} weight="bold" />
              </button>
              <span aria-hidden className="mx-1 h-4 w-px bg-line" />
              {control.kind === "tilt" ? (
                // 기울이기: 위 버튼이 윗변을 뒤로 눕힌다 (위로 끄는 것과 같다)
                <>
                  <button
                    type="button"
                    onClick={() => {
                      dragYRef.current -= TILT_STEP_PX;
                    }}
                    aria-label={t("minigame.inspect.tiltBack")}
                    className={STAGE_ICON_BUTTON}
                  >
                    <CaretUpIcon size={15} weight="bold" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      dragYRef.current += TILT_STEP_PX;
                    }}
                    aria-label={t("minigame.inspect.tiltForward")}
                    className={STAGE_ICON_BUTTON}
                  >
                    <CaretDownIcon size={15} weight="bold" />
                  </button>
                </>
              ) : control.kind === "unfold" ? (
                <button
                  type="button"
                  onClick={() => {
                    dragYRef.current = -UNFOLD_PX;
                  }}
                  aria-label={t("minigame.inspect.unfold")}
                  className={STAGE_ICON_BUTTON}
                >
                  <ArrowsOutLineVerticalIcon size={15} weight="bold" />
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => zoomBy(1 / ZOOM_STEP)}
                    aria-label={t("clue.workbook.zoomOut")}
                    className={STAGE_ICON_BUTTON}
                  >
                    <MagnifyingGlassMinusIcon size={15} weight="bold" />
                  </button>
                  <button
                    type="button"
                    onClick={() => zoomBy(ZOOM_STEP)}
                    aria-label={t("clue.workbook.zoomIn")}
                    className={STAGE_ICON_BUTTON}
                  >
                    <MagnifyingGlassPlusIcon size={15} weight="bold" />
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
