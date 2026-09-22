"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useControlHint } from "@/i18n/control-hint";
import { ASSETS } from "@/lib/assets";
import { playSound } from "@/lib/audio";
import { useEffectEnabled } from "@/lib/effects/effect-budget";
import type { MinigameProps } from "@/types/minigame";
import { PhotoParticles } from "../photo-particles/PhotoParticles";
import { MinigameShell, MinigameStat, useOnceCompleter, useSkipEligible } from "../shell";
import {
  BLANK_TILE,
  type Board,
  canMove,
  isSolved,
  moveAt,
  PUZZLE_SIZE,
  type SlideDirection,
  scrambledBoard,
  slide,
  tileBackgroundPosition,
} from "./puzzle";

const SKIP_AFTER_MS = 40_000;
/** 맞춘 사진을 보여 주는 시간(ms). 입자가 켜지면 흩어졌다 모이는 게 보이도록 길어진다 */
const SOLVED_HOLD_MS = 900;
const SOLVED_HOLD_PARTICLES_MS = 1800;
/** 맞춘 직후 이만큼은 흩어진 채로 둔다. 바로 모이면 흩어졌던 게 안 보인다 */
const GATHER_DELAY_MS = 300;
/** 섞는 수. 3×3에서 이 정도면 한눈에 답이 보이지도, 손이 지치지도 않는다. */
const SCRAMBLE_MOVES = 24;
/** 조각 하나가 잘라 쓸 배경의 크기: 가로·세로 **둘 다** 격자 배수여야 한다. */
const TILE_BACKGROUND_SIZE = `${PUZZLE_SIZE * 100}% ${PUZZLE_SIZE * 100}%`;

/**
 * 조각 사이의 틈(px). 격자의 gap이 아니라 조각 **안쪽에** 그린다.
 *
 * gap으로 벌리면 사진이 틈만큼 늘어난다: 조각 하나가 제 폭의 3배로 그림을 깔기 때문에,
 * 조각들을 틈만큼 떼어 놓으면 세 조각이 덮는 폭이 그림 한 장보다 넓어진다. 잘린 게
 * 아니라 벌어진 그림이 된다. 조각을 맞대어 놓고 테두리를 안쪽으로 덮으면 틈이 그림의
 * 그만큼을 가려서, 진짜로 잘라 놓은 것처럼 이어진다.
 *
 * 색은 판 바탕과 같아야 틈이 "판이 비치는 자리"로 읽힌다. 판이 ivory 10%를 panel 위에
 * 깔고 있으므로 두 겹을 같은 순서로 쌓는다 (먼저 적은 그림자가 위에 온다).
 */
const SEAM_PX = 3;
const TILE_SEAM = [
  `inset 0 0 0 ${SEAM_PX}px color-mix(in srgb, var(--color-ivory) 10%, transparent)`,
  `inset 0 0 0 ${SEAM_PX}px var(--color-panel)`,
].join(", ");

/**
 * 사진의 가로세로비를 실제 파일에서 읽어 온다.
 *
 * 격자가 사진과 다른 비율이면 조각이 사진을 왜곡한다. 값을 코드에 박아 두면 사진을
 * 갈아 끼울 때마다 같이 고쳐야 하므로, 파일에게 직접 묻는다. 알아내기 전에는
 * 정사각으로 두고, 알아낸 뒤 한 번 갱신된다.
 */
function usePhotoAspect(src: string): number {
  const [aspect, setAspect] = useState(1);

  useEffect(() => {
    let active = true;
    const image = new Image();
    const measure = () => {
      if (active && image.naturalWidth > 0 && image.naturalHeight > 0) {
        setAspect(image.naturalWidth / image.naturalHeight);
      }
    };
    image.onload = measure;
    image.src = src;
    // 이미 받아 둔 사진이면 onload가 안 온다 (1차 조사에서 같은 파일을 썼다)
    if (image.complete) measure();
    return () => {
      active = false;
    };
  }, [src]);

  return aspect;
}

const ARROW_DIRECTIONS: Record<string, SlideDirection> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

/**
 * 2차 조사에서 액자 사진을 맞춘다.
 *
 * 1차는 뿌연 유리를 닦는 게임이었다. 같은 액자를 또 닦게 하면 2바퀴가 1바퀴의
 * 재탕이 되므로, 여기서는 조각난 사진을 다시 맞춘다. 흩어진 것을 제자리로
 * 돌려놓는 동작이 2바퀴의 주제와 같다.
 */
export function PhotoPuzzleMinigame({ onComplete, onSettled }: MinigameProps) {
  const { t } = useTranslation();
  const hint = useControlHint();
  const complete = useOnceCompleter(onComplete);
  const [board, setBoard] = useState<Board>(() => scrambledBoard(SCRAMBLE_MOVES, Math.random));
  const [moves, setMoves] = useState(0);
  const [solved, setSolved] = useState(false);
  const skipEligible = useSkipEligible(SKIP_AFTER_MS);
  const aspect = usePhotoAspect(ASSETS.images.mgPhotoWipePhase2);
  /** 맞춘 사진을 입자로 그릴지. 예산 등급이 정한다 (docs/visual-experiments.md 9장) */
  const particlesEnabled = useEffectEnabled("cheap");
  /** 얼굴 입자까지 모이는 단계. 맞춘 뒤 GATHER_DELAY_MS 지나 켠다 */
  const [gathered, setGathered] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);
  /** 입자 층이 덮을 판의 실제 크기(px). 판은 svh 기준이라 CSS로는 못 옮겨 적는다 */
  const [boardSize, setBoardSize] = useState<{ width: number; height: number } | null>(null);

  /*
   * 판을 한 번 민다. 못 미는 자리를 눌렀으면 아무 일도 일어나지 않는다.
   * 막힌 조각마다 실패음을 울리면 손이 바쁜 구간이 시끄러워진다.
   */
  const applyRef = useRef((_next: Board) => {});
  applyRef.current = (next: Board) => {
    if (solved || next === board) return;
    setBoard(next);
    setMoves((count) => count + 1);
    if (!isSolved(next)) {
      playSound("flip");
      return;
    }
    setSolved(true);
    onSettled?.();
    playSound("collect");
  };

  // 창 전역 키 핸들러는 한 번만 붙으므로, 최신 판은 렌더마다 갱신되는 ref로 건넨다
  const slideRef = useRef((_direction: SlideDirection) => {});
  slideRef.current = (direction: SlideDirection) => applyRef.current(slide(board, direction));

  // 맞추고 나면 사진 한 장이 남는다. 잠깐 보여준 뒤 결과 대사로 넘긴다.
  // 입자가 켜져 있으면 그 사이에 사진이 흩어졌다 얼굴까지 모인다 (1차에서는 얼굴이 안 모였다).
  // 모이는 게 보여야 하니 잡아 두는 시간이 두 배다.
  useEffect(() => {
    if (!solved) return;
    const hold = particlesEnabled ? SOLVED_HOLD_PARTICLES_MS : SOLVED_HOLD_MS;
    const gather = particlesEnabled
      ? window.setTimeout(() => setGathered(true), GATHER_DELAY_MS)
      : 0;
    const timer = window.setTimeout(() => complete({ cleared: true, score: moves }), hold);
    return () => {
      window.clearTimeout(timer);
      if (gather !== 0) window.clearTimeout(gather);
    };
  }, [solved, moves, complete, particlesEnabled]);

  // 입자 층은 판 위에 absolute로 얹힌다. 판의 크기를 재서 그대로 준다 (svh 폭이라 CSS로 못 옮긴다)
  useEffect(() => {
    if (!solved || !particlesEnabled) return;
    const board = boardRef.current;
    if (!board) return;
    const measure = () => {
      const rect = board.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setBoardSize({ width: Math.round(rect.width), height: Math.round(rect.height) });
      }
    };
    measure();
    const observer =
      typeof ResizeObserver === "function" ? new ResizeObserver(() => measure()) : null;
    observer?.observe(board);
    return () => observer?.disconnect();
  }, [solved, particlesEnabled]);

  // 방향키만으로 끝까지 플레이할 수 있어야 한다 (.claude/rules/minigames.md)
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const direction = ARROW_DIRECTIONS[event.key];
      if (!direction || event.repeat) return;
      event.preventDefault();
      slideRef.current(direction);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <MinigameShell
      title={t("minigame.photoPuzzle.title")}
      help={hint("minigame.photoPuzzle.help")}
      stats={<MinigameStat label={t("minigame.photoPuzzle.moves")} value={moves} />}
      skipVisible={skipEligible && !solved}
      onSkip={() => complete({ cleared: true, score: moves })}
    >
      <div ref={boardRef} className="relative mx-auto w-[min(100%,calc(52svh*0.92))]">
        <div
          // gap 없이 맞대어 깐다. 틈은 조각 안쪽의 TILE_SEAM이 그린다
          className="grid overflow-hidden rounded-md bg-ivory/10"
          style={{ gridTemplateColumns: `repeat(${PUZZLE_SIZE}, minmax(0, 1fr))` }}
        >
          {board.map((tile, index) => {
            const position = tileBackgroundPosition(tile);
            // 다 맞춘 뒤에는 빈칸도 사진으로 메워 한 장으로 남긴다
            const empty = tile === BLANK_TILE && !solved;
            const movable = !solved && canMove(board, index);

            return (
              <button
                // biome-ignore lint/suspicious/noArrayIndexKey: 자리(index)가 곧 격자 칸이라 조각이 바뀌어도 같은 칸이다.
                key={index}
                type="button"
                disabled={!movable}
                aria-label={t("minigame.photoPuzzle.tile", { value: tile + 1 })}
                onClick={() => applyRef.current(moveAt(board, index))}
                // 조각에도 바탕을 깔아 둔다. 사진이 붙기 전에 빈 칸으로 비지 않게
                className={`transition-[opacity,transform] duration-150 ${
                  empty ? "bg-ivory/10" : "bg-bone"
                } ${movable ? "cursor-pointer hover:-translate-y-0.5" : "cursor-default"} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-memory`}
                style={{
                  // 조각도 사진과 같은 비율이어야 한다. 정사각 칸에 넣으면 사진이 눌린다
                  aspectRatio: aspect,
                  boxShadow: TILE_SEAM,
                  ...(empty
                    ? null
                    : {
                        backgroundImage: `url(${ASSETS.images.mgPhotoWipePhase2})`,
                        backgroundSize: TILE_BACKGROUND_SIZE,
                        backgroundPosition: `${position.x}% ${position.y}%`,
                      }),
                }}
              />
            );
          })}
        </div>
        {/*
          맞춘 순간 같은 사진이 입자로 풀려 다시 모인다. 1차 액자(photo-wipe)에서 끝까지
          안 모이던 얼굴이 여기서는 모인다. 바탕을 panel로 깔아 아래 조각들이 비치지 않게 한다:
          비치면 흩어진 게 아니라 얼룩으로 보인다.
        */}
        {solved && particlesEnabled && boardSize && (
          <div
            className="absolute inset-0 overflow-hidden rounded-md bg-panel"
            style={{ width: boardSize.width, height: boardSize.height }}
          >
            <PhotoParticles
              src={ASSETS.images.mgPhotoWipePhase2}
              width={boardSize.width}
              height={boardSize.height}
              gamePhase={2}
              enabled
              gathered={gathered}
              className="block w-full"
            />
          </div>
        )}
      </div>
    </MinigameShell>
  );
}
