"use client";

import { WifiSlashIcon } from "@phosphor-icons/react";
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
/** 맞는 줄이 금빛으로 서고 연구소 이름이 드러난 뒤 도해의 대사로 넘어가기까지(ms). */
const MATCH_HOLD_MS = 900;

export type LogoKind = "laon" | "hotel" | "health" | "harbor";

export interface LogoCandidate {
  id: string;
  logo: LogoKind;
  /** 어느 페이지의 그림인가: 접속 기록에 뜨는 제목. */
  sourceKey: CommonTextKey;
  /** 기록에 남은 주소. 지어낸 주소라 번역하지 않는다. 연구소 이름은 주소에도 싣지 않는다. */
  address: string;
  /** 들어간 날짜와 시각. */
  visitedKey: CommonTextKey;
}

/**
 * 고를 수 있는 그림 넷. 라온 로고는 하나뿐이다: 임직원 포털에 들어간 기록.
 * 화장실 세면대 바닥에서 건진 소독제 병(단서 laon-sanitizer)에서 로고를 봤으니 "소독제 병에서 본
 * 로고"를 고를 수 있다. 소독제 병에 이름은 없다: 이름은 맞힌 뒤 열리는 포털에서 처음 나온다. 전에는 같은 로고 둘(첨부 · 뉴스의 정문)을
 * 다 고르는 판이었는데 "같은 그림 찾기"라 시시했다 (2026-10-01). 셋은 비슷한 결의 틀린
 * 그림이다: 둥근 테·수평선·해 같은 요소를 하나씩 나눠 가져 한눈에 고르지는 못하게.
 *
 * 순서는 접속 기록답게 최근 것이 위다. 셋이 떠나기 전날(10월 16일) 밤에 몰려 있다.
 */
export const LOGO_CANDIDATES: readonly LogoCandidate[] = [
  {
    id: "gate",
    logo: "harbor",
    sourceKey: "minigame.computerLogo.source.gate",
    address: "seohang-news.kr/local",
    visitedKey: "minigame.computerLogo.visited.gate",
  },
  {
    id: "portal",
    logo: "laon",
    sourceKey: "minigame.computerLogo.source.portal",
    address: "intra.llsi.re.kr/login",
    visitedKey: "minigame.computerLogo.visited.portal",
  },
  {
    id: "health",
    logo: "health",
    sourceKey: "minigame.computerLogo.source.health",
    address: "kdha.go.kr/briefing",
    visitedKey: "minigame.computerLogo.visited.health",
  },
  {
    id: "hotel",
    logo: "hotel",
    sourceKey: "minigame.computerLogo.source.hotel",
    address: "stay.badatgil.kr/guide",
    visitedKey: "minigame.computerLogo.visited.hotel",
  },
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

/**
 * 컴퓨터 3차 (v4 3-5): 세면대 바닥의 소독제 병에서 본 로고를 떠올리며 다시 켠 컴퓨터.
 *
 * 로그인은 2차에서 이미 했으니 곧장 브라우저의 접속 기록이 뜬다. 줄마다 그 사이트의 그림과
 * 제목·주소·들어간 시각이 붙은 넷. 견본은 옆에 세우지 않는다: 답을 옆에 두면 같은 그림 찾기라
 * 너무 쉽다. 세면대 바닥의 소독제 병에서 본 것을 떠올려 고른다.
 *
 * 라온의 로고를 고르면 그 줄이 금빛으로 서며 연구소 이름이 드러나고, 페이지를 열지 않은 채 곧장
 * 도해의 대사로 넘어간다 (computer-logo-found). 전에는 포털의 저장된 페이지가 한 장 더 열렸는데,
 * 거기 적힌 것("마지막 접속 10월 16일 23:40 · 이 컴퓨터")은 기록 줄이 이미 말하고 있었다
 * (2026-10-06). 떠나기 전날 밤 아빠가 이 방에 있었다는 데서 도해가 선반의 거꾸로 꽂힌 책을
 * 스스로 떠올린다. 이름과 직함은 싣지 않는다: 안방의 출입증에서 처음 나오는 정보다.
 *
 * 틀려도 끝나지 않는다. 세 번 틀리거나 시간이 지나면 스킵이 선다 (접근성 계약).
 */
export function ComputerLogoMinigame({ onComplete, stage = "play" }: MinigameProps) {
  const { t } = useTranslation();
  const hint = useControlHint();
  const complete = useOnceCompleter(onComplete);
  // 결과 대사가 위에 떠 있는 동안은 맞힌 줄이 선 채로 멈춘 그림이다
  const frozen = stage === "result";
  const [picked, setPicked] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<"wrong" | "right" | null>(null);
  const [misses, setMisses] = useState(0);
  const skipByTime = useSkipEligible(SKIP_AFTER_MS);
  const skipVisible =
    !frozen && verdict !== "right" && (misses >= MISSES_BEFORE_SKIP || skipByTime);

  const pick = useCallback(
    (candidate: LogoCandidate) => {
      if (verdict || frozen) return;
      setPicked(candidate.id);
      if (matchesLabel(candidate)) {
        playSound("radioLock");
        setVerdict("right");
      } else {
        playSound("deny");
        setVerdict("wrong");
      }
    },
    [verdict, frozen],
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
      const timer = setTimeout(() => complete({ cleared: true }), MATCH_HOLD_MS);
      return () => clearTimeout(timer);
    }
  }, [verdict, complete]);

  /** 맞힌 줄인가. 스킵으로 넘어왔거나 결과 단계로 새로 마운트돼도 라온의 줄이 선다. */
  const found = (candidate: LogoCandidate) =>
    matchesLabel(candidate) && (frozen || (verdict === "right" && picked === candidate.id));

  const tone = (candidate: LogoCandidate) => {
    if (found(candidate)) return "border-memory bg-memory/15 text-memory";
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
          <span className="min-w-0 flex-1 truncate">{t("minigame.computerLogo.app")}</span>
        </div>

        <div className="p-5">
          {/* 브라우저의 접속 기록: 한 줄에 그 사이트의 그림(파비콘) · 제목과 주소 · 들어간 시각 */}
          <ul className="flex flex-col gap-2">
            {LOGO_CANDIDATES.map((candidate) => (
              <li key={candidate.id}>
                <button
                  type="button"
                  onClick={() => pick(candidate)}
                  disabled={verdict !== null || frozen}
                  className={`flex w-full cursor-pointer items-center gap-4 rounded-lg border px-4 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-memory disabled:cursor-default ${tone(candidate)}`}
                >
                  <span className="size-12 flex-none">
                    <Logo kind={candidate.logo} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    {/* 소독제 병에는 없던 연구소 이름이 맞힌 줄에서 처음 나온다 */}
                    <span className="break-ko text-sm leading-snug text-bone/70">
                      {found(candidate)
                        ? `${t("minigame.computerLogo.portal.org")} · ${t(candidate.sourceKey)}`
                        : t(candidate.sourceKey)}
                    </span>
                    <span className="truncate text-[0.6875rem] text-bone/40">
                      {candidate.address}
                    </span>
                  </span>
                  <span className="flex-none whitespace-nowrap text-[0.75rem] tabular-nums text-bone/50">
                    {t(candidate.visitedKey)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex min-h-9 items-center gap-3">
        {frozen || verdict === "right" ? null : (
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
                onClick={() => complete({ cleared: true })}
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
