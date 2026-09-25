"use client";

import { Check, EnvelopeSimple, WifiSlash } from "@phosphor-icons/react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useControlHint } from "@/i18n/control-hint";
import { playSound } from "@/lib/audio";
import type { CommonTextKey, MinigameProps } from "@/types/minigame";
import { useOnceCompleter, useSkipEligible } from "../shell";

/** 몇 번 틀리면 스킵을 내주는가. 시간 경과 쪽이 먼저 오면 그쪽이 이긴다. */
const MISSES_BEFORE_SKIP = 3;
const SKIP_AFTER_MS = 45_000;
/** 틀린 칸이 붉게 떠 있는 시간(ms). */
const WRONG_HOLD_MS = 520;
/** 맞춘 두 칸이 금빛으로 선 뒤 메일로 넘어가기까지(ms). */
const MATCH_HOLD_MS = 900;

export type LogoKind = "raon" | "hotel" | "health";

export interface LogoCandidate {
  id: string;
  logo: LogoKind;
  /** 어디서 찾은 그림인가: 메일 첨부 파일명 또는 캐시 뉴스. */
  sourceKey: CommonTextKey;
}

/**
 * 고를 수 있는 그림 넷. 라온 로고는 두 군데(아빠 메일 첨부 · 캐시 뉴스의 연구시설
 * 정문)에 있다. 어느 쪽을 골라도 맞다: 둘이 같은 로고라는 게 이 장면의 발견이다.
 */
export const LOGO_CANDIDATES: readonly LogoCandidate[] = [
  { id: "hotel", logo: "hotel", sourceKey: "minigame.computerLogo.source.hotel" },
  { id: "badge", logo: "raon", sourceKey: "minigame.computerLogo.source.badge" },
  { id: "health", logo: "health", sourceKey: "minigame.computerLogo.source.health" },
  { id: "gate", logo: "raon", sourceKey: "minigame.computerLogo.source.gate" },
];

/** 앰플 라벨에 남은 조각과 같은 로고인가. */
export function matchesLabel(candidate: LogoCandidate): boolean {
  return candidate.logo === "raon";
}

/**
 * 로고 그림. 색은 currentColor 하나라 부르는 쪽의 글자색(토큰)을 따른다.
 * `half`면 왼쪽 반만 남는다: 앰플 라벨이 반쯤 지워진 조각이다.
 */
export function Logo({ kind, half = false }: { kind: LogoKind; half?: boolean }) {
  const clipId = `logo-half-${kind}`;
  return (
    <svg
      aria-hidden="true"
      role="presentation"
      viewBox="-50 -50 100 100"
      className="size-full"
      fill="none"
      stroke="currentColor"
      strokeWidth={6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {half ? (
        <defs>
          <clipPath id={clipId}>
            <rect x={-50} y={-50} width={50} height={100} />
          </clipPath>
        </defs>
      ) : null}
      <g clipPath={half ? `url(#${clipId})` : undefined}>
        {kind === "raon" ? (
          <>
            {/* 라온: 둥근 테 안, 수평선 위로 떠오르는 해와 빛살 셋 (ui-raon-logo.svg와 같은 도형) */}
            <circle r={40} />
            <line x1={-25} y1={9.6} x2={25} y2={9.6} />
            <path d="M-15.4 9.6 A15.4 15.4 0 0 1 15.4 9.6" />
            <path d="M0 -21.7 V-13.3 M-16.7 -14.2 L-10.4 -7.5 M16.7 -14.2 L10.4 -7.5" />
          </>
        ) : kind === "hotel" ? (
          <>
            {/* 바닷가 숙소: 네모 안의 물결 두 줄 */}
            <rect x={-38} y={-38} width={76} height={76} rx={10} />
            <path d="M-26 0 q13 -12 26 0 t26 0" />
            <path d="M-26 16 q13 -12 26 0 t26 0" />
          </>
        ) : (
          <>
            {/* 보건 당국: 방패 안의 십자 */}
            <path d="M0 -40 L34 -26 V4 C34 24 16 36 0 42 C-16 36 -34 24 -34 4 V-26 Z" />
            <line x1={0} y1={-18} x2={0} y2={18} />
            <line x1={-16} y1={0} x2={16} y2={0} />
          </>
        )}
      </g>
    </svg>
  );
}

type Screen = "match" | "mail";

/**
 * 컴퓨터 3차 (v4 3-5): 앰플 라벨에 남은 로고 조각을 쫓아 다시 켠 컴퓨터.
 *
 * 로그인은 2차에서 이미 했으니 곧장 저장된 그림들이 뜬다. 왼쪽에 라벨 조각, 오른쪽에
 * 메일 첨부와 캐시 뉴스에서 건진 그림 넷. 조각과 같은 로고를 고르면 같은 로고가
 * 두 군데(아빠의 출입증 사진, 연구시설 정문)에 있었다는 게 드러나고, 그 첨부가
 * 달린 아빠 메일이 열린다. 메일 끝에 하부장 번호의 힌트가 있다.
 *
 * 틀려도 끝나지 않는다. 세 번 틀리거나 시간이 지나면 스킵이 선다 (접근성 계약).
 */
export function ComputerLogoMinigame({ onComplete, stage = "play" }: MinigameProps) {
  const { t } = useTranslation();
  const hint = useControlHint();
  const complete = useOnceCompleter(onComplete);
  const frozen = stage === "result";
  const [screen, setScreen] = useState<Screen>(frozen ? "mail" : "match");
  const [picked, setPicked] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<"wrong" | "right" | null>(null);
  const [misses, setMisses] = useState(0);
  const skipByTime = useSkipEligible(SKIP_AFTER_MS);
  const skipVisible = screen === "match" && !frozen && (misses >= MISSES_BEFORE_SKIP || skipByTime);

  const pick = useCallback(
    (candidate: LogoCandidate) => {
      if (verdict || frozen || screen !== "match") return;
      setPicked(candidate.id);
      if (matchesLabel(candidate)) {
        playSound("radioLock");
        setVerdict("right");
      } else {
        playSound("deny");
        setVerdict("wrong");
      }
    },
    [verdict, frozen, screen],
  );

  useEffect(() => {
    if (verdict === "wrong") {
      const timer = setTimeout(() => {
        setVerdict(null);
        setPicked(null);
        setMisses((count) => count + 1);
      }, WRONG_HOLD_MS);
      return () => clearTimeout(timer);
    }
    if (verdict === "right") {
      const timer = setTimeout(() => {
        playSound("select");
        setScreen("mail");
      }, MATCH_HOLD_MS);
      return () => clearTimeout(timer);
    }
  }, [verdict]);

  useEffect(() => {
    if (frozen || screen !== "mail") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== "Enter" && event.code !== "Space") return;
      event.preventDefault();
      complete({ cleared: true });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [frozen, screen, complete]);

  const tone = (candidate: LogoCandidate) => {
    if (verdict === "right" && matchesLabel(candidate))
      return "border-memory bg-memory/15 text-memory";
    if (verdict === "wrong" && picked === candidate.id)
      return "border-ember bg-ember/15 text-ember";
    return "border-bone/25 bg-scene-void/40 text-bone/80 hover:border-memory hover:text-memory";
  };

  return (
    <div className="flex w-[min(44rem,94vw)] animate-fade-rise flex-col items-center gap-4">
      {/* 모니터 한 장: 2차와 같은 컴퓨터라 같은 결의 어두운 창이다 */}
      <div className="w-full overflow-hidden rounded-xl border border-bone/15 bg-scene-navy shadow-panel">
        <div className="flex items-center gap-2 border-b border-bone/10 bg-scene-coal px-4 py-2 text-[0.75rem] text-bone/55">
          {screen === "mail" ? (
            <EnvelopeSimple size={14} weight="bold" aria-hidden />
          ) : (
            <WifiSlash size={14} weight="bold" aria-hidden />
          )}
          <span className="min-w-0 flex-1 truncate">
            {t(screen === "mail" ? "minigame.computerBrowse.mailApp" : "minigame.computerLogo.app")}
          </span>
        </div>

        {screen === "match" ? (
          <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
            {/* 앰플 라벨 조각 */}
            <figure className="flex flex-col items-center gap-2 sm:w-40">
              <div className="size-28 rounded-lg border border-dashed border-bone/30 bg-paper p-3 text-ink">
                <Logo kind="raon" half />
              </div>
              <figcaption className="break-ko text-center text-[0.75rem] text-bone/55">
                {t("minigame.computerLogo.label")}
              </figcaption>
            </figure>
            <ul className="grid flex-1 grid-cols-2 gap-3">
              {LOGO_CANDIDATES.map((candidate) => (
                <li key={candidate.id}>
                  <button
                    type="button"
                    onClick={() => pick(candidate)}
                    disabled={verdict !== null}
                    className={`flex w-full cursor-pointer flex-col items-center gap-2 rounded-lg border p-3 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-memory disabled:cursor-default ${tone(candidate)}`}
                  >
                    <span className="size-16">
                      <Logo kind={candidate.logo} />
                    </span>
                    <span className="break-ko text-center text-[0.75rem] leading-snug text-bone/60">
                      {t(candidate.sourceKey)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <article className="flex flex-col gap-3 p-5 text-paper">
            <header className="flex flex-col gap-1 border-b border-bone/10 pb-3">
              <p className="text-[0.75rem] text-bone/50">
                {t("minigame.computerBrowse.mailFrom")} · {t("minigame.computerLogo.mail.date")}
              </p>
              <h3 className="break-ko text-lg font-bold">
                {t("minigame.computerLogo.mail.subject")}
              </h3>
            </header>
            <div className="flex items-center gap-3 rounded-lg bg-scene-void/40 p-3">
              <span className="size-12 shrink-0 text-memory">
                <Logo kind="raon" />
              </span>
              <p className="break-ko text-sm text-bone/70">{t("minigame.computerLogo.found")}</p>
            </div>
            <p className="break-ko text-pretty leading-relaxed">
              {t("minigame.computerLogo.mail.b1")}
            </p>
            <p className="break-ko text-pretty leading-relaxed">
              {t("minigame.computerLogo.mail.b2")}
            </p>
          </article>
        )}
      </div>

      <div className="flex min-h-9 items-center gap-3">
        {frozen ? null : screen === "mail" ? (
          <button
            type="button"
            onClick={() => complete({ cleared: true })}
            className="flex cursor-pointer items-center gap-1.5 rounded-full bg-paper px-6 py-2 text-sm font-bold tracking-widest text-ink transition-all hover:-translate-y-0.5 active:translate-y-0"
          >
            <Check size={16} weight="bold" />
            {t("minigame.computerBrowse.close")}
          </button>
        ) : (
          <>
            <p
              aria-live="polite"
              className="break-ko text-pretty px-4 text-center text-sm tracking-widest text-bone/50"
            >
              {verdict === "wrong"
                ? t("minigame.computerLogo.wrong")
                : hint("minigame.computerLogo.help")}
            </p>
            {skipVisible ? (
              <button
                type="button"
                onClick={() => setScreen("mail")}
                className="cursor-pointer whitespace-nowrap rounded-full border border-bone/40 px-5 py-1.5 text-sm font-bold tracking-widest text-bone/70 transition-all hover:border-bone hover:text-paper active:translate-y-px"
              >
                {t("minigame.skip")}
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
