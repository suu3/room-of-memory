"use client";

import { Check } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { KeyHint } from "@/components/ui/Keycap";
import { useControlHint } from "@/i18n/control-hint";
import { ASSETS } from "@/lib/assets";
import { playSound } from "@/lib/audio";
import { blurBackdrop } from "@/lib/image-blur";
import type { MinigameProps } from "@/types/minigame";
import { useSkipEligible } from "../shell";
import {
  clampLens,
  LENS_ZOOM,
  type LensPosition,
  moveLens,
  spotAt,
  WINDOW_SPOTS,
  type WindowSpot,
} from "./spots";

/** 그림 원본 크기(px). 렌즈 안의 확대 그림이 같은 비율로 서야 한다. */
const FRAME = { width: 1448, height: 1086 };
/** 렌즈 지름: 창 폭에 대한 %. */
const LENS_SIZE = 26;
/**
 * 이만큼 지나면 다 못 찾았어도 커튼을 닫을 수 있다. 세 자리를 다 짚는 것이 이 창의
 * 내용이지만, 못 찾는 사람을 창가에 세워 두지는 않는다 (.claude/rules/minigames.md).
 */
const CLOSE_AFTER_MS = 20_000;

/**
 * 커튼을 걷고 창밖을 내다본다.
 *
 * 이기고 지는 게임이 아니다. 방 안의 물건들은 그날의 흔적을 하나씩 말하지만
 * 창문만은 지금 바깥이 어떤지를 보여준다. 다만 그냥 그림 한 장이면 아무도 핏자국을
 * 못 본다. 돋보기로 창밖을 훑어 세 자리(연기 · 도로의 자국 · 불 꺼진 창)를 짚으면
 * 한 줄씩 말이 붙고, 다 짚으면 커튼을 닫는다. 도중에 닫으면 아무 일도 없었던
 * 것처럼 다시 열 수 있다 (방탈출 탐색).
 *
 * 그림의 노을은 밤의 방과 시간대가 어긋난다. 그림을 다시 그리는 대신 유리 위에
 * 밤의 색을 한 겹 얹는다 (.window-night). 커튼 너머의 빛은 방보다 늘 조금 밝다.
 */
export function WindowViewMinigame({ onComplete }: MinigameProps) {
  const { t } = useTranslation();
  const hint = useControlHint();
  const doneRef = useRef(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const [lens, setLensState] = useState<LensPosition>({ x: 50, y: 50 });
  const [found, setFoundState] = useState<WindowSpot["id"][]>([]);
  const [latest, setLatest] = useState<WindowSpot["id"] | null>(null);
  /*
   * 키 리스너는 창 전역에 하나만 달고 최신 값을 ref로 본다. 방향키를 연달아 누르면
   * 리렌더보다 키가 먼저 오는데, 그때 옛 state를 보면 두 걸음이 한 걸음이 된다.
   */
  const lensRef = useRef(lens);
  const foundRef = useRef(found);
  const setLens = useCallback((next: LensPosition) => {
    lensRef.current = next;
    setLensState(next);
  }, []);
  const closeByTime = useSkipEligible(CLOSE_AFTER_MS);
  const allFound = found.length === WINDOW_SPOTS.length;
  const canClose = allFound || closeByTime;

  // 커튼이 젖혀지는 소리: 판이 열리는 순간 한 번.
  useEffect(() => {
    playSound("wipe");
  }, []);

  /** 렌즈 중심을 들여다본다. 뭔가 있으면 찾은 것으로 적는다. */
  const look = useCallback((at: LensPosition) => {
    const spot = spotAt(at, foundRef.current);
    if (!spot) {
      playSound("deny");
      return;
    }
    playSound("radioLock");
    foundRef.current = [...foundRef.current, spot.id];
    setFoundState(foundRef.current);
    setLatest(spot.id);
  }, []);

  const lensFromPointer = (event: React.PointerEvent<HTMLElement>): LensPosition | null => {
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return null;
    return clampLens({
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    });
  };

  // 방향키로 렌즈를 옮기고 Enter·Space로 들여다본다. 마우스가 없어도 다 찾을 수 있어야 한다.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Enter" || event.code === "Space") {
        if (event.target instanceof HTMLButtonElement) return;
        event.preventDefault();
        look(lensRef.current);
        return;
      }
      const next = moveLens(lensRef.current, event.key);
      if (!next) return;
      event.preventDefault();
      setLens(next);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [look, setLens]);

  const close = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    playSound("close");
    onComplete({ cleared: true });
  };

  return (
    <div className="flex animate-fade-rise flex-col items-center gap-4">
      {/* 창틀: 어두운 방에서 이 그림만 빛나 보이도록 바깥으로 빛을 흘린다 */}
      <div className="relative w-[34rem] max-w-[86vw] rounded-md bg-scene-coal p-2 shadow-panel ring-1 ring-bone/20">
        {/* 렌즈는 포인터를 따라다니는 그림이다. 조작은 아래 버튼과 키보드가 맡는다 */}
        <div
          ref={frameRef}
          className="relative cursor-none overflow-hidden rounded-sm"
          onPointerMove={(event) => {
            const next = lensFromPointer(event);
            if (next) setLens(next);
          }}
          onPointerDown={(event) => {
            const next = lensFromPointer(event);
            if (!next) return;
            setLens(next);
            look(next);
          }}
        >
          {/* biome-ignore lint/performance/noImgElement: 그림 한 장이 곧 이 화면이라 원본 비율 그대로 쓴다. */}
          <img
            src={ASSETS.images.mgWindowViewOutside}
            alt={t("minigame.windowView.title")}
            width={FRAME.width}
            height={FRAME.height}
            draggable={false}
            style={blurBackdrop(ASSETS.images.mgWindowViewOutside)}
            className="block h-auto w-full select-none"
          />
          {/* 밤의 색: 노을 그림을 방의 시간대로 끌어내린다 */}
          <span aria-hidden className="window-night pointer-events-none absolute inset-0" />
          {/* 찾은 자리: 작은 표식이 남는다. 어디를 봤는지 잊지 않게 */}
          {WINDOW_SPOTS.filter((spot) => found.includes(spot.id)).map((spot) => (
            <span
              key={spot.id}
              aria-hidden
              className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-memory"
              style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
            />
          ))}
          {/*
            돋보기. 같은 그림을 LENS_ZOOM배로 깔고 렌즈 중심이 가리키는 자리를 보여준다.
            밤의 색은 렌즈 안에는 얹지 않는다. 들여다보는 자리만 또렷해야 돋보기다.
          */}
          <span
            aria-hidden
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-paper/80 shadow-panel"
            style={{
              left: `${lens.x}%`,
              top: `${lens.y}%`,
              width: `${LENS_SIZE}%`,
              aspectRatio: "1",
              backgroundImage: `url(${ASSETS.images.mgWindowViewOutside})`,
              backgroundSize: `${LENS_ZOOM * 100}% auto`,
              backgroundPosition: `${lens.x}% ${lens.y}%`,
            }}
          >
            <span className="absolute inset-0 rounded-full ring-1 ring-inset ring-night/40" />
          </span>
        </div>
        {/* 유리에 비친 방의 어둠: 그림 위에 아주 옅게만 */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-2 rounded-sm ring-1 ring-inset ring-night/30"
        />
      </div>

      {/* 찾은 것들: 세 칸. 찾을수록 밝아진다 */}
      <ul
        className="flex flex-wrap items-center justify-center gap-2"
        aria-label={t("minigame.windowView.spotsLabel")}
      >
        {WINDOW_SPOTS.map((spot) => {
          const seen = found.includes(spot.id);
          return (
            <li
              key={spot.id}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs tracking-widest transition-colors duration-300 ${
                seen ? "border-memory/60 bg-memory/15 text-memory" : "border-bone/20 text-bone/45"
              }`}
            >
              {seen && <Check size={12} weight="bold" aria-hidden />}
              {t(`minigame.windowView.spot.${spot.id}`)}
            </li>
          );
        })}
      </ul>

      {/* 방금 짚은 자리에 붙는 한마디. 다 찾으면 마지막 줄로 갈아든다 */}
      <p
        role="status"
        aria-live="polite"
        className="min-h-[1.25rem] max-w-[86vw] break-ko text-pretty text-center text-sm text-ivory"
      >
        {allFound
          ? t("minigame.windowView.allFound")
          : latest
            ? t(`minigame.windowView.line.${latest}`)
            : ""}
      </p>

      <p className="max-w-[86vw] break-ko text-pretty text-center text-xs tracking-widest text-bone/55">
        <KeyHint
          text={allFound ? t("minigame.windowView.help") : hint("minigame.windowView.lookHelp")}
        />
      </p>

      {canClose && (
        <button
          type="button"
          onClick={close}
          className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full bg-paper px-5 py-1.5 text-xs font-bold tracking-widest text-ink transition-all hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-memory"
        >
          <Check size={14} weight="bold" />
          {t("minigame.windowView.close")}
        </button>
      )}
    </div>
  );
}
