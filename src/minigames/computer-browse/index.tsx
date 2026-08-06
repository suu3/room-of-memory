"use client";

import {
  CaretRight,
  Check,
  EnvelopeSimple,
  Globe,
  Image as ImageIcon,
  WifiSlash,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useControlHint } from "@/i18n/control-hint";
import { playSound } from "@/lib/audio";
import type { MinigameProps } from "@/types/minigame";
import { useOnceCompleter } from "../shell";
import { pagesFor } from "./archive";

/**
 * 책상 위 컴퓨터 — 인터넷이 끊긴 뒤 저장된 것들만 열리는 화면.
 *
 * 1바퀴(gamePhase 1)는 메일함: 아빠가 여행지에서 보낸 메일 두 통.
 * 2바퀴(gamePhase 2)는 브라우저 캐시: 그날까지의 뉴스 세 개.
 *
 * phone-chat과 같은 "읽는 인터랙션"이다 — 실패 조건이 없고, 다음 버튼(클릭 ·
 * Space · →)으로 끝까지 넘기면 닫는 버튼이 뜬다. 다 읽기 전에 닫으면(바깥 클릭)
 * 아무 일도 없었던 것으로 남아 다시 열 수 있다.
 */
export function ComputerBrowseMinigame({
  onComplete,
  gamePhase = 1,
  stage = "play",
}: MinigameProps) {
  const { t } = useTranslation();
  const hint = useControlHint();
  const complete = useOnceCompleter(onComplete);

  const pages = pagesFor(gamePhase);
  const [pageIndex, setPageIndex] = useState(0);

  // 결과 대사가 위에 떠 있는 동안은 판을 멈춘 그림이다 — 입력을 받지 않는다.
  const frozen = stage === "result";
  const page = pages[pageIndex];
  const lastPage = pageIndex >= pages.length - 1;

  const nextPage = useCallback(() => {
    if (frozen) return;
    setPageIndex((current) => {
      if (current >= pages.length - 1) return current;
      playSound("select");
      return current + 1;
    });
  }, [frozen, pages.length]);

  // 키보드 경로 — Space · Enter · →로 다음 장.
  useEffect(() => {
    if (frozen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.code === "Space" || event.code === "Enter" || event.code === "ArrowRight") {
        event.preventDefault();
        nextPage();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [frozen, nextPage]);

  const isMail = gamePhase !== 2;
  const AppIcon = isMail ? EnvelopeSimple : Globe;

  return (
    <div className="flex animate-fade-rise flex-col items-center gap-4">
      {/* 모니터 — 폰 목업과 같은 문법의 "물건" 테두리 */}
      <div className="mx-auto w-[34rem] max-w-[94vw]">
        <div className="rounded-xl bg-ink p-[6px] shadow-panel ring-1 ring-night/80">
          <div className="overflow-hidden rounded-lg bg-scene-void">
            {/* 창 제목줄 — 앱 이름과 오프라인 표시 */}
            <div className="flex items-center gap-2 border-b border-bone/10 px-3.5 py-2 text-bone/85">
              <AppIcon size={15} weight="fill" className="shrink-0 text-memory" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-bold">
                {t(isMail ? "minigame.computerBrowse.mailApp" : "minigame.computerBrowse.newsApp")}
              </span>
              <span className="flex shrink-0 items-center gap-1.5 text-[0.6875rem] text-ember">
                <WifiSlash size={13} weight="bold" aria-hidden />
                {t("minigame.computerBrowse.offline")}
              </span>
            </div>

            {/* 본문 — 저장된 사본 한 장 */}
            <div className="h-[min(22rem,52dvh)] overflow-y-auto bg-scene-navy px-5 py-4">
              <div key={page.id} className="animate-fade-rise">
                <p className="text-[0.6875rem] tracking-wider text-bone/40">{t(page.dateKey)}</p>
                <h3 className="mt-1 break-ko text-pretty text-[1.0625rem] font-bold leading-snug text-paper">
                  {t(page.titleKey)}
                </h3>
                {isMail ? (
                  <p className="mt-1 text-[0.75rem] text-bone/45">
                    {t("minigame.computerBrowse.mailFrom")}
                  </p>
                ) : null}

                <div className="mt-3 flex flex-col gap-2.5">
                  {page.bodyKeys.map((key) => (
                    <p
                      key={key}
                      className="break-ko text-pretty text-[0.9375rem] leading-relaxed text-bone"
                    >
                      {t(key)}
                    </p>
                  ))}
                </div>

                {/* 첨부 사진 — 파일은 없고 회색 판이 자리를 지킨다 (컷씬과 같은 규칙) */}
                {page.attachments ? (
                  <div className="mt-4 flex flex-wrap gap-3">
                    {page.attachments.map((name) => (
                      <figure
                        key={name}
                        className="flex h-24 w-32 flex-col items-center justify-center gap-1.5 rounded-md border border-bone/15 bg-scene-dusk"
                      >
                        <ImageIcon size={22} className="text-bone/40" aria-hidden />
                        <figcaption className="text-[0.625rem] text-bone/45">{name}</figcaption>
                      </figure>
                    ))}
                  </div>
                ) : null}

                {page.truncated ? (
                  <p className="mt-4 border-bone/15 border-t pt-3 text-[0.8125rem] text-ember">
                    {t("minigame.computerBrowse.truncated")}
                  </p>
                ) : null}
              </div>
            </div>

            {/* 하단 — 몇 장째인지와 다음 장 */}
            <div className="flex items-center justify-between border-t border-bone/10 px-3.5 py-2">
              <span className="text-[0.6875rem] tabular-nums text-bone/40">
                {pageIndex + 1} / {pages.length}
              </span>
              {!lastPage && !frozen ? (
                <button
                  type="button"
                  onClick={nextPage}
                  className="flex cursor-pointer items-center gap-1 rounded-full px-3 py-1 text-[0.8125rem] font-bold text-memory transition-colors hover:bg-bone/10"
                >
                  {t("minigame.computerBrowse.next")}
                  <CaretRight size={14} weight="bold" aria-hidden />
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* 다 읽었을 때만 닫는 버튼 — phone-chat과 같은 자리다 */}
      {frozen ? null : (
        <div className="flex min-h-9 items-center gap-3">
          {lastPage ? (
            <button
              type="button"
              onClick={() => complete({ cleared: true })}
              className="flex cursor-pointer items-center gap-1.5 rounded-full bg-paper px-6 py-2 text-sm font-bold tracking-widest text-ink transition-all hover:-translate-y-0.5 active:translate-y-0"
            >
              <Check size={16} weight="bold" />
              {t("minigame.computerBrowse.close")}
            </button>
          ) : (
            <p className="break-ko text-pretty px-4 text-center text-sm tracking-widest text-bone/50">
              {hint("minigame.computerBrowse.help")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
