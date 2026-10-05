"use client";

import { CheckIcon, NotePencilIcon, WifiSlashIcon } from "@phosphor-icons/react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useControlHint } from "@/i18n/control-hint";
import { playSound } from "@/lib/audio";
import type { CommonTextKey, MinigameProps } from "@/types/minigame";
import { MinigameHelp, useOnceCompleter, useSkipEligible } from "../shell";

/** 몇 번 틀리면 스킵을 내주는가. 시간 경과 쪽이 먼저 오면 그쪽이 이긴다. */
const MISSES_BEFORE_SKIP = 3;
const SKIP_AFTER_MS = 45_000;
/** 틀린 칸이 붉게 떠 있는 시간(ms). */
const WRONG_HOLD_MS = 520;
/** 맞는 칸이 금빛으로 선 뒤 저장된 페이지로 넘어가기까지(ms). */
const MATCH_HOLD_MS = 900;

export type LogoKind = "laon" | "hotel" | "health" | "harbor";

export interface LogoCandidate {
  id: string;
  logo: LogoKind;
  /** 어느 페이지의 그림인가: 저장된 페이지 목록에 뜨는 제목. */
  sourceKey: CommonTextKey;
}

/**
 * 고를 수 있는 그림 넷. 라온 로고는 하나뿐이다: 임직원 포털의 저장된 페이지.
 * 화장실 세면대 바닥에서 건진 소독제 병(단서 laon-sanitizer)에서 로고를 봤으니 "소독제 병에서 본
 * 로고"를 고를 수 있다. 소독제 병에 이름은 없다: 이름은 맞힌 뒤 열리는 포털에서 처음 나온다. 전에는 같은 로고 둘(첨부 · 뉴스의 정문)을
 * 다 고르는 판이었는데 "같은 그림 찾기"라 시시했다 (2026-10-01). 셋은 비슷한 결의 틀린
 * 그림이다: 둥근 테·수평선·해 같은 요소를 하나씩 나눠 가져 한눈에 고르지는 못하게.
 */
export const LOGO_CANDIDATES: readonly LogoCandidate[] = [
  { id: "hotel", logo: "hotel", sourceKey: "minigame.computerLogo.source.hotel" },
  { id: "portal", logo: "laon", sourceKey: "minigame.computerLogo.source.portal" },
  { id: "health", logo: "health", sourceKey: "minigame.computerLogo.source.health" },
  { id: "gate", logo: "harbor", sourceKey: "minigame.computerLogo.source.gate" },
];

/** 라온생명과학연구소의 로고인가 (세면대 바닥의 소독제 병과 같은 그림). */
export function matchesLabel(candidate: LogoCandidate): boolean {
  return candidate.logo === "laon";
}

/** 로고 그림. 색은 currentColor 하나라 부르는 쪽의 글자색(토큰)을 따른다. */
function Logo({ kind }: { kind: LogoKind }) {
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
      <g>
        {kind === "laon" ? (
          <>
            {/* 라온: 둥근 테 안, 수평선 위로 떠오르는 해와 빛살 셋 (ui-laon-logo.svg와 같은 도형) */}
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
        ) : kind === "harbor" ? (
          <>
            {/* 항만 공사: 둥근 테 안, 수평선 아래로 지는 해와 물결. 라온과 테·선을 나눠 가진 가짜 */}
            <circle r={40} />
            <line x1={-25} y1={-6} x2={25} y2={-6} />
            <path d="M-15.4 -6 A15.4 15.4 0 0 0 15.4 -6" />
            <path d="M-22 16 q11 -9 22 0 t22 0" />
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

type Screen = "match" | "portal";

/**
 * 컴퓨터 3차 (v4 3-5): 세면대 바닥의 소독제 병에서 본 로고를 떠올리며 다시 켠 컴퓨터.
 *
 * 로그인은 2차에서 이미 했으니 곧장 브라우저의 저장된 페이지 목록이 뜬다. 줄마다 그 사이트의
 * 그림이 붙은 넷. 견본은 옆에 세우지 않는다: 답을 옆에 두면 같은 그림 찾기라 너무 쉽다. 세면대
 * 바닥의 소독제 병에서 본 것을 떠올려 고른다. 라온생명과학연구소의 로고를 고르면 그 그림이 나온
 * 저장된 페이지가 열린다: 아빠가 이 컴퓨터로 들어갔던 임직원 포털이다. 메모는 포털 안에
 * 있지 않다: 회사 포털에 아들 방 선반을 적어 둘 리 없다. 아빠가 이 컴퓨터의 브라우저에 페이지를
 * 저장하며 붙여 둔 한 줄이고, 그것이 선반의 책을 가리킨다.
 * 이름과 직함은 싣지 않는다: 안방의 출입증에서 처음 나오는 정보다.
 *
 * 틀려도 끝나지 않는다. 세 번 틀리거나 시간이 지나면 스킵이 선다 (접근성 계약).
 */
export function ComputerLogoMinigame({ onComplete, stage = "play" }: MinigameProps) {
  const { t } = useTranslation();
  const hint = useControlHint();
  const complete = useOnceCompleter(onComplete);
  const frozen = stage === "result";
  const [screen, setScreen] = useState<Screen>(frozen ? "portal" : "match");
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
        setScreen("portal");
      }, MATCH_HOLD_MS);
      return () => clearTimeout(timer);
    }
  }, [verdict]);

  useEffect(() => {
    if (frozen || screen !== "portal") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== "Enter" && event.code !== "Space") return;
      event.preventDefault();
      complete({ cleared: true });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [frozen, screen, complete]);

  const tone = (candidate: LogoCandidate) => {
    if (verdict === "right" && picked === candidate.id)
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
          <WifiSlashIcon size={14} weight="bold" aria-hidden />
          <span className="min-w-0 flex-1 truncate">
            {t(
              screen === "portal" ? "minigame.computerBrowse.newsApp" : "minigame.computerLogo.app",
            )}
          </span>
        </div>

        {screen === "match" ? (
          <div className="p-5">
            {/* 브라우저의 저장된 페이지 목록: 한 줄에 그 사이트의 그림(파비콘)과 제목 */}
            <ul className="flex flex-col gap-2">
              {LOGO_CANDIDATES.map((candidate) => (
                <li key={candidate.id}>
                  <button
                    type="button"
                    onClick={() => pick(candidate)}
                    disabled={verdict !== null}
                    className={`flex w-full cursor-pointer items-center gap-4 rounded-lg border px-4 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-memory disabled:cursor-default ${tone(candidate)}`}
                  >
                    <span className="size-12 flex-none">
                      <Logo kind={candidate.logo} />
                    </span>
                    <span className="min-w-0 flex-1 break-ko text-sm leading-snug text-bone/70">
                      {t(candidate.sourceKey)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="flex flex-col gap-4 p-5 text-paper">
            <article className="flex flex-col gap-4 rounded-lg border border-bone/10 p-4">
              {/* 포털 머리: 방금 맞춘 로고와 연구소 이름 (소독제 병에는 없던 이름이 여기서 처음 나온다) */}
              <header className="flex items-center gap-3 border-b border-bone/10 pb-4">
                <span className="size-12 flex-none text-memory">
                  <Logo kind="laon" />
                </span>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <h3 className="break-ko text-lg font-bold">
                    {t("minigame.computerLogo.portal.org")}
                  </h3>
                  <p className="text-[0.75rem] text-bone/50">
                    {t("minigame.computerLogo.portal.title")}
                  </p>
                </div>
              </header>
              <p className="text-sm text-bone/60">{t("minigame.computerLogo.portal.lastLogin")}</p>
            </article>
            {/* 메모는 포털 안이 아니라 브라우저 쪽에 있다: 아빠가 이 페이지를 저장하며 붙여 둔 한 줄 */}
            <section className="flex flex-col gap-2 rounded-lg border border-bone/15 bg-scene-void/40 p-3">
              <p className="flex items-center gap-1.5 text-[0.75rem] text-bone/50">
                <NotePencilIcon size={12} weight="bold" aria-hidden />
                {t("minigame.computerLogo.portal.memoLabel")}
              </p>
              <p className="break-ko text-pretty leading-relaxed">
                {t("minigame.computerLogo.portal.memo")}
              </p>
            </section>
          </div>
        )}
      </div>

      <div className="flex min-h-9 items-center gap-3">
        {frozen ? null : screen === "portal" ? (
          <div className="flex flex-col items-center gap-3">
            {/* 도해의 깨달음은 페이지 밖에 선다: 아빠가 쓴 글로 읽히지 않게 */}
            <p className="break-ko text-pretty px-4 text-center text-sm tracking-widest text-bone/60">
              {t("minigame.computerLogo.found")}
            </p>
            <button
              type="button"
              onClick={() => complete({ cleared: true })}
              className="flex cursor-pointer items-center gap-1.5 rounded-full bg-paper px-6 py-2 text-sm font-bold tracking-widest text-ink transition-all hover:-translate-y-0.5 active:translate-y-0"
            >
              <CheckIcon size={16} weight="bold" />
              {t("minigame.computerBrowse.close")}
            </button>
          </div>
        ) : (
          <>
            {/* aria-live는 바깥에: 안내와 "틀렸다"가 한 자리에서 갈린다. 안내 끝의 "클릭"은 키캡으로 선다 */}
            <div aria-live="polite">
              <MinigameHelp
                help={
                  verdict === "wrong"
                    ? t("minigame.computerLogo.wrong")
                    : hint("minigame.computerLogo.help")
                }
                className="break-ko text-pretty px-4 text-center text-sm tracking-widest text-bone/50"
              />
            </div>
            {skipVisible ? (
              <button
                type="button"
                onClick={() => setScreen("portal")}
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
