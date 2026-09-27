"use client";

import {
  CaretRight,
  Check,
  EnvelopeSimple,
  Globe,
  Image as ImageIcon,
  UserCircle,
  WifiSlash,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { KeyHint } from "@/components/ui/Keycap";
import { COMPUTER_PASSCODE, COMPUTER_PASSCODE_LENGTH } from "@/data/room-clues";
import { useControlHint } from "@/i18n/control-hint";
import { playSound } from "@/lib/audio";
import type { MinigameProps } from "@/types/minigame";
import { AnswerKeypad, AnswerSlots } from "../answer-input";
import { useOnceCompleter, useSkipEligible } from "../shell";
import {
  ARCHIVE_PAGES,
  BOOT_LINE_MS,
  BOOT_LINES,
  BOOT_SETTLE_MS,
  FAILS_BEFORE_SKIP,
} from "./archive";

/** 틀렸을 때 흔들리고 지워지기까지. page-nudge(0.3s)가 다 돌고 잠깐 머문다. */
const WRONG_HOLD_MS = 450;

/** 비밀번호 없이도 열어주기까지 기다리는 시간 (접근성 계약). */
const SKIP_AFTER_MS = 60_000;

type Screen = "boot" | "lock" | "browse";

/**
 * 창 왼쪽 위의 신호등 세 개. 이 판을 "컴퓨터 화면"으로 읽히게 하는 최소한의 장치다.
 * 색은 팔레트에서 가장 가까운 셋: 새 색을 만들지 않는다 (DESIGN.md).
 */
const TRAFFIC_LIGHTS = ["bg-ember", "bg-memory", "bg-scene-olive"] as const;

/**
 * 책상 위 컴퓨터: 2바퀴에 딱 한 번 열리는 조사.
 *
 * 노트북 한 대가 화면 가운데에 열려 있고, 그 안에서 세 화면이 한 줄로 이어진다.
 *   boot   전원이 들어오고 진행 막대가 찬다. 아무 데나 누르면 건너뛴다
 *   lock   아빠가 걸어둔 로그인. 네 자리를 맞춰야 넘어간다
 *   browse 저장된 메일 두 통 → 캐시에 남은 뉴스 셋을 끝까지 넘긴다
 *
 * 비밀번호(전국대회 날)는 화면 안에 답이 없다. 잠금 화면이 "무슨 날"인지만
 * 알려주고, 숫자는 벽에 걸린 달력에 그어져 있다 (src/data/room-clues.ts).
 * 못 찾아도 막다른 길은 아니다: 네 번 틀리거나 시간이 지나면 스킵이 떠서 그냥
 * 열어준다 (.claude/rules/minigames.md).
 *
 * 방은 어둡고 이 판만 밝다. 화면이 켜졌다는 사실 자체가 이 장면의 사건이라,
 * 씬과 같은 톤으로 어둡게 깔면 아무것도 안 켜진 것처럼 보인다.
 */
export function ComputerBrowseMinigame({ onComplete, stage = "play" }: MinigameProps) {
  const { t } = useTranslation();
  const hint = useControlHint();
  const complete = useOnceCompleter(onComplete);

  /*
   * 결과 대사는 다 읽은 뒤에만 뜬다. 그 단계로 새로 마운트되면 부팅부터 다시
   * 돌 자리가 아니라 마지막으로 보던 화면이 멈춰 있어야 한다. 보통은 이미
   * "browse"인 채로 stage만 바뀌므로 이 초기값이 쓰이는 일은 드물다.
   */
  const [screen, setScreen] = useState<Screen>(stage === "result" ? "browse" : "boot");
  const [bootLine, setBootLine] = useState(0);
  const [entry, setEntry] = useState("");
  const [fails, setFails] = useState(0);
  const [wrong, setWrong] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // 결과 대사가 위에 떠 있는 동안은 판을 멈춘 그림이다. 입력도 연출도 없다.
  const frozen = stage === "result";
  const skipByTime = useSkipEligible(SKIP_AFTER_MS);
  const skipVisible = screen === "lock" && !frozen && (fails >= FAILS_BEFORE_SKIP || skipByTime);

  const page = ARCHIVE_PAGES[pageIndex];
  const lastPage = pageIndex >= ARCHIVE_PAGES.length - 1;

  const unlock = useCallback(() => {
    playSound("select");
    setScreen("browse");
  }, []);

  /* ── 부팅 ─────────────────────────────────────────────────────────── */

  // 전원이 들어오는 소리. 건너뛰어도 끊지 않는다: 컴퓨터는 로그인 화면 뒤에서도 돌고 있다
  useEffect(() => {
    if (screen === "boot" && !frozen) playSound("computerBoot");
  }, [screen, frozen]);

  // 상태 줄이 하나씩 지나가고, 다 지나가면 한 박자 쉬었다 로그인 화면으로.
  useEffect(() => {
    if (screen !== "boot" || frozen) return;
    const done = bootLine >= BOOT_LINES.length;
    const timer = setTimeout(
      () => {
        if (done) setScreen("lock");
        else setBootLine((count) => count + 1);
      },
      done ? BOOT_SETTLE_MS : BOOT_LINE_MS,
    );
    return () => clearTimeout(timer);
  }, [screen, frozen, bootLine]);

  /** 부팅을 건너뛴다. 막대를 끝까지 채우고 다음 틱에 로그인 화면이 뜬다. */
  const skipBoot = useCallback(() => setBootLine(BOOT_LINES.length), []);

  // 로그인 화면이 뜨면 입력칸에 커서를 둔다. 실제 컴퓨터가 그렇다
  useEffect(() => {
    if (screen === "lock" && !frozen) inputRef.current?.focus();
  }, [screen, frozen]);

  /* ── 잠금 ─────────────────────────────────────────────────────────── */

  const submit = useCallback(() => {
    if (screen !== "lock" || wrong || frozen) return;
    if (entry === COMPUTER_PASSCODE) {
      unlock();
      return;
    }
    playSound("deny");
    setWrong(true);
    setFails((count) => count + 1);
  }, [screen, wrong, frozen, entry, unlock]);

  /** 숫자만 받는다. 네 자리가 차면 실제 로그인 화면처럼 바로 검사한다. */
  const typeEntry = useCallback(
    (raw: string) => {
      if (wrong || frozen) return;
      const digits = raw.replace(/\D/g, "").slice(0, COMPUTER_PASSCODE_LENGTH);
      if (digits.length > entry.length) playSound("phoneBeep", { variation: 0.04 });
      setEntry(digits);
      if (digits.length < COMPUTER_PASSCODE_LENGTH) return;
      if (digits === COMPUTER_PASSCODE) {
        unlock();
        return;
      }
      playSound("deny");
      setWrong(true);
      setFails((count) => count + 1);
    },
    [wrong, frozen, entry.length, unlock],
  );

  // 틀린 입력은 흔들린 뒤에 지워진다. 바로 지우면 뭐가 틀렸는지도 못 본다.
  useEffect(() => {
    if (!wrong) return;
    const timer = setTimeout(() => {
      setEntry("");
      setWrong(false);
      inputRef.current?.focus();
    }, WRONG_HOLD_MS);
    return () => clearTimeout(timer);
  }, [wrong]);

  /* ── 읽기 ─────────────────────────────────────────────────────────── */

  const nextPage = useCallback(() => {
    if (frozen) return;
    setPageIndex((current) => {
      if (current >= ARCHIVE_PAGES.length - 1) return current;
      playSound("select");
      return current + 1;
    });
  }, [frozen]);

  /*
   * 키보드 경로. 잠금 화면은 입력칸이 스스로 키를 받으므로 여기서 가로채지 않는다.
   * 창을 훑는 키(Space·→)만 읽는 화면의 몫이다.
   */
  useEffect(() => {
    if (frozen || screen === "lock") return;
    const onKey = (event: KeyboardEvent) => {
      if (screen === "boot") {
        event.preventDefault();
        skipBoot();
        return;
      }
      if (event.code === "Space" || event.code === "Enter" || event.code === "ArrowRight") {
        event.preventDefault();
        nextPage();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen, frozen, skipBoot, nextPage]);

  const AppIcon = page.app === "mail" ? EnvelopeSimple : Globe;
  const bootProgress = Math.min(1, bootLine / BOOT_LINES.length);

  return (
    <div className="flex animate-fade-rise flex-col items-center gap-3">
      {/*
        노트북 한 대. 베젤은 어둡게 두고 테두리에만 알루미늄 하이라이트를 남긴다.
        밝게 두면 켜진 화면과 색이 붙어서 판이 어디서 끝나는지 안 보인다.
      */}
      <div className="mx-auto w-[52rem] max-w-[94vw]">
        <div className="rounded-[1.1rem] bg-scene-dusk px-2.5 pb-2.5 pt-3.5 shadow-panel ring-1 ring-screen-chrome/20">
          {/* 화면 위 카메라: 점 하나가 이 판을 노트북으로 읽히게 한다 */}
          <span
            aria-hidden
            className="mx-auto mb-2 block size-1.5 rounded-full bg-screen-chrome/25"
          />
          {/*
            화면 비율. 넓은 화면은 노트북답게 16:10이지만, 폰 세로 화면에서는 판 폭이
            330px 남짓이라 16:10이면 높이가 200px뿐이다: 잠금 화면의 키패드와 힌트가
            위아래로 잘려 나갔다. 좁은 폭에서는 세로로 긴 3:4로 세워 키패드가 다 선다.
          */}
          <div className="relative aspect-[3/4] overflow-hidden rounded-md bg-night sm:aspect-[16/10]">
            {screen === "boot" ? (
              // 화면 전체가 "건너뛰기"다. 로그를 다 읽을 이유는 없고, 기다리는
              // 몇 초가 연출일 뿐이라 아무 데나 눌러 넘길 수 있어야 한다
              <button
                type="button"
                onClick={skipBoot}
                aria-label={t("minigame.skip")}
                className="flex size-full cursor-pointer flex-col items-center justify-center gap-6 bg-night"
              >
                <span className="sr-only" role="status">
                  {t("minigame.computerBrowse.booting")}
                </span>
                {/* 전원이 들어온 표시: 로고 대신 켜진 사각형 하나 */}
                <span
                  aria-hidden
                  className="size-11 animate-pulse rounded-md border-2 border-screen-glass/40"
                  style={{ animationDuration: "2.4s" }}
                />
                <span className="h-1 w-48 overflow-hidden rounded-full bg-screen-glass/15">
                  <span
                    className="block h-full rounded-full bg-screen-glass/70 transition-[width] duration-500 ease-out"
                    style={{ width: `${bootProgress * 100}%` }}
                  />
                </span>
                <span className="min-h-4 text-[0.75rem] tracking-wide text-screen-glass/45">
                  {bootLine > 0 ? t(BOOT_LINES[Math.min(bootLine, BOOT_LINES.length) - 1]) : ""}
                </span>
              </button>
            ) : screen === "lock" ? (
              /* 로그인 화면: 바탕화면이 흐릿하게 비치고 그 위에 계정 하나 */
              <div
                className="flex size-full flex-col items-center justify-center gap-3 px-6"
                style={{
                  background:
                    "radial-gradient(120% 90% at 50% 18%, #ffffff 0%, var(--color-screen-glass) 40%, var(--color-screen-chrome) 72%, var(--color-screen-shade) 100%)",
                }}
              >
                <UserCircle size={64} weight="fill" className="text-ink/25" aria-hidden />
                <p className="text-base font-bold text-ink">
                  {t("minigame.computerBrowse.account")}
                </p>

                {/*
                 * 자리수가 보이는 슬롯 + 화면 키패드. 비밀번호라 숫자 대신 점을
                 * 세운다(masked). 다 채우면 typeEntry가 스스로 확인하므로 제출
                 * 버튼이 없다.
                 */}
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    submit();
                  }}
                  className="mt-1 flex flex-col items-center gap-3"
                >
                  <AnswerSlots
                    length={COMPUTER_PASSCODE_LENGTH}
                    value={entry}
                    onChange={typeEntry}
                    label={t("minigame.computerBrowse.passwordLabel")}
                    masked
                    rejected={wrong}
                    disabled={frozen}
                    inputRef={inputRef}
                  />
                  <AnswerKeypad
                    length={COMPUTER_PASSCODE_LENGTH}
                    value={entry}
                    onChange={typeEntry}
                    disabled={frozen}
                  />
                </form>

                <p
                  role="status"
                  className={`min-h-5 break-ko text-pretty text-center text-[0.8125rem] ${
                    wrong ? "font-bold text-ember" : "text-ink/50"
                  }`}
                >
                  {wrong
                    ? t("minigame.computerBrowse.wrong")
                    : t("minigame.computerBrowse.passHint")}
                </p>
              </div>
            ) : (
              /* 창 하나가 통째로 화면을 채운다. 바탕화면까지 그리면 읽을 판이 좁아진다 */
              <div className="flex size-full flex-col bg-screen-glass">
                {/* 제목줄: 신호등 · 앱 이름 · 오프라인 표시 */}
                <div className="flex shrink-0 items-center gap-2 border-b border-ink/10 bg-screen-chrome px-3.5 py-2">
                  <span className="flex shrink-0 items-center gap-1.5" aria-hidden>
                    {TRAFFIC_LIGHTS.map((tone) => (
                      <span key={tone} className={`size-2.5 rounded-full ${tone} opacity-80`} />
                    ))}
                  </span>
                  <span className="ml-2 flex min-w-0 flex-1 items-center gap-1.5">
                    <AppIcon size={14} weight="fill" className="shrink-0 text-ink/45" aria-hidden />
                    <span className="min-w-0 truncate text-[0.8125rem] font-bold text-ink/70">
                      {t(
                        page.app === "mail"
                          ? "minigame.computerBrowse.mailApp"
                          : "minigame.computerBrowse.newsApp",
                      )}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5 text-[0.6875rem] font-bold text-ember">
                    <WifiSlash size={13} weight="bold" aria-hidden />
                    {t("minigame.computerBrowse.offline")}
                  </span>
                </div>

                {/* 본문: 저장된 사본 한 장 */}
                <div className="min-h-0 flex-1 overflow-y-auto px-7 py-5">
                  <div key={page.id} className="animate-fade-rise">
                    <p className="text-[0.6875rem] tracking-wider text-ink/40">{t(page.dateKey)}</p>
                    <h3 className="mt-1 break-ko text-pretty text-xl font-bold leading-snug text-ink">
                      {t(page.titleKey)}
                    </h3>
                    {page.app === "mail" ? (
                      <p className="mt-1 text-[0.75rem] text-ink/50">
                        {t("minigame.computerBrowse.mailFrom")}
                      </p>
                    ) : null}

                    <div className="mt-4 flex flex-col gap-3">
                      {page.bodyKeys.map((key) => (
                        <p
                          key={key}
                          className="break-ko text-pretty text-[0.9375rem] leading-relaxed text-ink/80"
                        >
                          {t(key)}
                        </p>
                      ))}
                    </div>

                    {/* 첨부 사진: 파일은 없고 빈 판이 자리를 지킨다 (컷씬과 같은 규칙) */}
                    {page.attachments ? (
                      <div className="mt-5 flex flex-wrap gap-3">
                        {page.attachments.map((name) => (
                          <figure
                            key={name}
                            className="flex h-24 w-32 flex-col items-center justify-center gap-1.5 rounded-md border border-ink/12 bg-screen-chrome"
                          >
                            <ImageIcon size={22} className="text-ink/30" aria-hidden />
                            <figcaption className="text-[0.625rem] text-ink/45">{name}</figcaption>
                          </figure>
                        ))}
                      </div>
                    ) : null}

                    {page.truncated ? (
                      <p className="mt-5 border-ink/12 border-t pt-3 text-[0.8125rem] font-bold text-ember">
                        {t("minigame.computerBrowse.truncated")}
                      </p>
                    ) : null}
                  </div>
                </div>

                {/* 하단: 몇 장째인지와 다음 장 */}
                <div className="flex shrink-0 items-center justify-between border-t border-ink/10 bg-screen-chrome/70 px-3.5 py-2">
                  <span className="text-[0.6875rem] tabular-nums text-ink/40">
                    {pageIndex + 1} / {ARCHIVE_PAGES.length}
                  </span>
                  {!lastPage && !frozen ? (
                    <button
                      type="button"
                      onClick={nextPage}
                      className="flex cursor-pointer items-center gap-1 rounded-full px-3 py-1 text-[0.8125rem] font-bold text-ink/70 transition-colors hover:bg-ink/8 hover:text-ink"
                    >
                      {t("minigame.computerBrowse.next")}
                      <CaretRight size={14} weight="bold" aria-hidden />
                    </button>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </div>
        {/* 힌지 아래로 살짝 보이는 받침: 이게 있어야 판이 아니라 노트북으로 읽힌다 */}
        <div
          aria-hidden
          className="mx-auto h-2 w-[32%] rounded-b-xl bg-scene-dusk ring-1 ring-screen-chrome/15"
        />
      </div>

      {/* 화면마다 아래에 서는 것이 다르다. 부팅은 아무것도, 잠금은 안내(+스킵),
          읽기는 다 읽었을 때 닫는 버튼 */}
      {frozen || screen === "boot" ? null : (
        <div className="flex min-h-9 items-center gap-3">
          {screen === "lock" ? (
            <>
              <p className="break-ko text-pretty px-4 text-center text-sm tracking-widest text-bone/50">
                <KeyHint text={hint("minigame.computerBrowse.lockHelp")} />
              </p>
              {skipVisible && (
                <button
                  type="button"
                  onClick={unlock}
                  className="shrink-0 cursor-pointer whitespace-nowrap rounded-full border border-bone/25 px-4 py-1.5 text-sm font-bold tracking-widest text-bone/60 transition-all hover:border-bone/50 hover:text-bone active:translate-y-px"
                >
                  {t("minigame.skip")}
                </button>
              )}
            </>
          ) : lastPage ? (
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
