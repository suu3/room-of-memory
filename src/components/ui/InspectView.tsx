"use client";

import {
  ArrowClockwise,
  ArrowCounterClockwise,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
} from "@phosphor-icons/react";
import dynamic from "next/dynamic";
import {
  type WheelEvent as ReactWheelEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import type { InspectObject } from "@/components/canvas/InspectTurntable";
import { STAGE_ICON_BUTTON } from "./ui-classes";
import { TURN_STEP, useTurntableDrag } from "./use-turntable-drag";

/** Canvas는 클라이언트에서만 뜬다 (.claude/rules/r3f.md): 물건을 집어 들 때 비로소 받는다. */
const InspectTurntable = dynamic(() => import("@/components/canvas/InspectTurntable"), {
  ssr: false,
});

/** 확대 범위. InspectTurntable의 ZOOM_MIN·ZOOM_MAX와 같다 (dynamic import라 값을 못 가져온다). */
const ZOOM_MIN = 1;
const ZOOM_MAX = 2.4;
/** 휠 한 칸(deltaY 100)에 곱해지는 배율. 다섯 칸쯤 굴리면 끝까지 간다. */
const WHEEL_ZOOM_RATE = 0.0018;
/** 버튼 한 번에 곱해지는 배율. */
const ZOOM_STEP = 1.35;
/** 조작 안내가 떠 있는 시간(ms). 그 전에 물건을 잡으면 바로 걷힌다. */
const HINT_MS = 4500;

/**
 * 집어 든 물건을 돌려 보는 판 (3D 인스펙트의 DOM 쪽, v4.1 2장).
 *
 * 문제집·카드·책·출입증·앰플 케이스가 **같은 조작**으로 돈다: 좌우로 끌어 돌리고,
 * 휠이나 버튼으로 당기고, 당긴 뒤에는 세로로 끌어 옮긴다. 끄는 건 마우스·손가락의
 * 몫이라 키보드에는 같은 일을 하는 버튼을 준다. 무엇을 찾아야 하는지는 적지 않는다:
 * 뒤집어 본 사람만 본다.
 *
 * `object`는 부르는 쪽이 useMemo로 붙잡아 넘긴다 (inspect-objects.ts). 새 객체가 오면
 * 면 그림을 다시 굽는다.
 */
export function InspectView({
  object,
  alt,
  hint,
  onFound,
  className = "",
}: {
  object: InspectObject;
  /** 스크린리더가 읽는 물건의 이름. */
  alt: string;
  /** 판 아래 조작 안내 한 줄. */
  hint: string;
  /** 찾을 면을 읽었을 때 한 번. */
  onFound: () => void;
  className?: string;
}) {
  const { t } = useTranslation();
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
        {...handlers}
        onPointerDownCapture={() => setHintShown(false)}
        onWheel={onWheel}
        className="h-64 w-full cursor-grab touch-none overscroll-contain active:cursor-grabbing sm:h-80"
      >
        <InspectTurntable
          object={object}
          yawRef={yawRef}
          zoomRef={zoomRef}
          dragYRef={dragYRef}
          onFound={onFound}
        />
      </div>
      <p
        className={`pointer-events-none absolute inset-x-0 top-3 px-4 text-center text-xs text-fog transition-opacity duration-500 ${hintShown ? "opacity-100" : "opacity-0"}`}
      >
        {hint}
      </p>
      <div className="flex justify-center pb-3">
        <div className="flex items-center gap-0.5 rounded-full border border-line bg-surface p-1 backdrop-blur-sm">
          <button
            type="button"
            onClick={() => turn(-TURN_STEP)}
            aria-label={t("characterSheet.turnLeft")}
            className={STAGE_ICON_BUTTON}
          >
            <ArrowCounterClockwise size={15} weight="bold" />
          </button>
          <button
            type="button"
            onClick={() => turn(TURN_STEP)}
            aria-label={t("characterSheet.turnRight")}
            className={STAGE_ICON_BUTTON}
          >
            <ArrowClockwise size={15} weight="bold" />
          </button>
          <span aria-hidden className="mx-1 h-4 w-px bg-line" />
          <button
            type="button"
            onClick={() => zoomBy(1 / ZOOM_STEP)}
            aria-label={t("clue.workbook.zoomOut")}
            className={STAGE_ICON_BUTTON}
          >
            <MagnifyingGlassMinus size={15} weight="bold" />
          </button>
          <button
            type="button"
            onClick={() => zoomBy(ZOOM_STEP)}
            aria-label={t("clue.workbook.zoomIn")}
            className={STAGE_ICON_BUTTON}
          >
            <MagnifyingGlassPlus size={15} weight="bold" />
          </button>
        </div>
      </div>
    </div>
  );
}
