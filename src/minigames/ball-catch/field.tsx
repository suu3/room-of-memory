import type React from "react";
import { ASSETS } from "../../lib/assets";
import type { SwingResult } from "./timing";

export interface BallCatchFieldProps {
  ballRef: React.RefObject<HTMLDivElement | null>;
  shadowRef: React.RefObject<HTMLDivElement | null>;
  remainingMisses: number;
  maxMisses: number;
  feedback: SwingResult | null;
  swingId: number;
  showPrompt: boolean;
  onSwing: () => void;
  labels: {
    aria: string;
    hits: string;
    chances: string;
    prompt: string;
    hit: string;
    early: string;
    late: string;
  };
}

const feedbackTone: Record<SwingResult, string> = {
  hit: "text-memory",
  early: "text-ember",
  late: "text-ember",
};

export function BallCatchField({
  ballRef,
  shadowRef,
  remainingMisses,
  maxMisses,
  feedback,
  swingId,
  showPrompt,
  onSwing,
  labels,
}: BallCatchFieldProps) {
  const feedbackLabel = feedback ? labels[feedback] : null;

  return (
    <button
      type="button"
      aria-label={labels.aria}
      onClick={onSwing}
      className={`relative block h-96 w-full cursor-pointer overflow-hidden rounded-xs border-2 border-night focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-memory ${
        feedback ? "animate-batting-field-shake" : ""
      }`}
    >
      <div className="absolute inset-0 bg-scene-abyss" />
      {/* biome-ignore lint/performance/noImgElement: Native images are required for the layered field sprites. */}
      <img
        className="absolute inset-0 size-full object-cover object-center"
        src={ASSETS.images.mgBallCatchSunsetField}
        alt=""
      />
      <div className="absolute inset-0 bg-night/20" aria-hidden />
      {/* 겨자색 노을 띠를 회갈색으로 눌러 앉힌다. 앰버는 링과 피드백의 몫이다 (globals.css) */}
      <div className="ball-catch-sky absolute inset-0" aria-hidden />

      {/* biome-ignore lint/performance/noImgElement: Native images are required for the layered field sprites. */}
      <img
        className="absolute left-1/2 top-[35%] w-36 -translate-x-1/2 -translate-y-1/2 drop-shadow-lg sm:w-44"
        src={ASSETS.images.mgBallCatchPitcher}
        alt=""
      />

      <div
        ref={shadowRef}
        aria-hidden
        className="absolute left-1/2 top-[68%] h-4 w-16 rounded-[50%] bg-night/60 opacity-0 blur-sm"
        style={{ transform: "translate(-50%, -50%) scale(0.5)" }}
      />

      <div
        className="absolute left-1/2 top-[68%] size-24 -translate-x-1/2 -translate-y-1/2"
        aria-hidden
      >
        <span className="absolute left-0 top-0 size-5 border-l-2 border-t-2 border-memory" />
        <span className="absolute right-0 top-0 size-5 border-r-2 border-t-2 border-memory" />
        <span className="absolute bottom-0 left-0 size-5 border-b-2 border-l-2 border-memory" />
        <span className="absolute bottom-0 right-0 size-5 border-b-2 border-r-2 border-memory" />
      </div>

      <div
        ref={ballRef}
        aria-hidden
        className="absolute size-14 bg-contain bg-center bg-no-repeat opacity-0"
        style={{
          left: "50%",
          top: "12%",
          transform: "translate(-50%, -50%) scale(0.25)",
          backgroundImage: `url(${ASSETS.images.mgBallCatchBall})`,
        }}
      />

      <div
        className="absolute bottom-0 left-1/2 h-10 w-20 -translate-x-1/2 bg-paper/70"
        style={{ clipPath: "polygon(14% 0, 86% 0, 100% 58%, 50% 100%, 0 58%)" }}
        aria-hidden
      />

      <div className="absolute left-4 top-4 text-left font-pixel text-xs tracking-widest text-paper">
        <strong className="text-memory">{labels.hits}</strong>
      </div>

      <div className="absolute right-4 top-4 text-right font-pixel text-xs tracking-widest text-paper">
        <span className="block">
          {labels.chances}{" "}
          <strong className="text-bone">
            {remainingMisses} / {maxMisses}
          </strong>
        </span>
        <span className="mt-2 flex justify-end gap-1" aria-hidden>
          {Array.from({ length: maxMisses }, (_, slot) => slot + 1).map((chance) => (
            // biome-ignore lint/performance/noImgElement: Native images keep the fixed chance slots visually consistent with the gameplay ball.
            <img
              key={chance}
              className={`size-5 drop-shadow-md ${
                chance <= remainingMisses ? "opacity-100" : "opacity-30"
              }`}
              src={ASSETS.images.mgBallCatchBall}
              alt=""
            />
          ))}
        </span>
      </div>

      {showPrompt && (
        <span className="absolute bottom-4 left-1/2 -translate-x-1/2 font-pixel text-xs tracking-widest text-bone">
          {labels.prompt}
        </span>
      )}

      {feedbackLabel && feedback && (
        <span
          key={`${feedback}-${swingId}`}
          className={`animate-batting-feedback absolute left-1/2 top-[47%] -translate-x-1/2 -translate-y-1/2 font-pixel text-2xl font-bold tracking-widest drop-shadow-lg ${feedbackTone[feedback]}`}
        >
          {feedbackLabel}
        </span>
      )}

      {feedback === "hit" && (
        // biome-ignore lint/performance/noImgElement: The impact sprite is a short-lived animated overlay.
        <img
          key={`impact-${swingId}`}
          className="animate-batting-impact absolute left-1/2 top-[68%] size-40"
          src={ASSETS.images.mgBallCatchImpact}
          alt=""
        />
      )}

      <div className="absolute -bottom-[14%] -right-[14%] w-[62%] max-w-md" aria-hidden>
        {/* biome-ignore lint/performance/noImgElement: The bat sprite needs a keyed native element to restart its CSS animation. */}
        <img
          key={swingId}
          className={swingId > 0 ? "animate-bat-swing-image" : ""}
          src={ASSETS.images.mgBallCatchBat}
          alt=""
        />
      </div>
    </button>
  );
}
