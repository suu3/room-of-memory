"use client";

import {
  Backspace,
  BatteryHigh,
  CellSignalFull,
  ChatCircleDots,
  Check,
  LockSimple,
  WifiHigh,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useControlHint } from "@/i18n/control-hint";
import { playSound } from "@/lib/audio";
import type { MinigameProps } from "@/types/minigame";
import { useOnceCompleter, useSkipEligible } from "../shell";
import { FAILS_BEFORE_SKIP, MOM_MESSAGES, PASSCODE, PASSCODE_LENGTH } from "./messages";

/** 키패드 배열. 빈 칸은 자리만 지킨다 — 실제 폰 키패드의 0 왼쪽 공백. */
const KEYPAD: readonly string[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];

/** 틀렸을 때 흔들리고 지워지기까지. page-nudge(0.3s)가 다 돌고 잠깐 머문다. */
const WRONG_HOLD_MS = 450;

/**
 * 2바퀴 폰 재조사 — 잠금화면.
 *
 * 몇 주 만에 처음 온 알림이 잠금화면 뒤에 있다. 비밀번호는 네 자리, 단서는
 * 잠금화면의 힌트("다 멈춘 날")와 calendar가 심은 날짜다. 풀면 그날 묶여 있던
 * 엄마의 문자가 한 통씩 도착한다 — 읽는 것까지가 이 인터랙션이다.
 *
 * 실패 조건은 없다. 틀리면 흔들리고 지워질 뿐이고, FAILS_BEFORE_SKIP번 틀리거나
 * 시간이 지나면 스킵이 떠서 비밀번호 없이 열어준다 (스킵도 cleared: true —
 * 퍼즐을 건너뛰는 것이지 이야기를 건너뛰는 게 아니라, 문자 화면은 똑같이 선다).
 */
export function PhoneLockMinigame({ onComplete, stage = "play" }: MinigameProps) {
  const { t } = useTranslation();
  const hint = useControlHint();
  const complete = useOnceCompleter(onComplete);

  const [screen, setScreen] = useState<"locked" | "messages">("locked");
  const [entry, setEntry] = useState("");
  const [fails, setFails] = useState(0);
  const [wrong, setWrong] = useState(false);
  const [arrived, setArrived] = useState(0);

  // 결과 대사가 위에 떠 있는 동안은 판을 멈춘 그림이다 — 입력도 연출도 없다.
  const frozen = stage === "result";
  // 스킵은 두 길 중 먼저 오는 쪽 — N회 실패 또는 시간 경과 (접근성 규칙).
  const skipByTime = useSkipEligible(45_000);
  const skipVisible = screen === "locked" && !frozen && (fails >= FAILS_BEFORE_SKIP || skipByTime);

  const unlock = useCallback(() => {
    playSound("select");
    setScreen("messages");
  }, []);

  /** 숫자 하나 입력. 네 자리가 차면 실제 폰처럼 바로 검사한다. */
  const pressDigit = useCallback(
    (digit: string) => {
      if (screen !== "locked" || wrong || frozen) return;
      playSound("phoneBeep", { variation: 0.04 });
      setEntry((current) => {
        const next = (current + digit).slice(0, PASSCODE_LENGTH);
        if (next.length < PASSCODE_LENGTH) return next;
        if (next === PASSCODE) {
          unlock();
          return next;
        }
        setWrong(true);
        setFails((count) => count + 1);
        return next;
      });
    },
    [screen, wrong, frozen, unlock],
  );

  const eraseDigit = useCallback(() => {
    if (screen !== "locked" || wrong || frozen) return;
    setEntry((current) => current.slice(0, -1));
  }, [screen, wrong, frozen]);

  // 틀린 입력은 흔들린 뒤에 지워진다 — 바로 지우면 뭐가 틀렸는지도 못 본다.
  useEffect(() => {
    if (!wrong) return;
    const timer = setTimeout(() => {
      setEntry("");
      setWrong(false);
    }, WRONG_HOLD_MS);
    return () => clearTimeout(timer);
  }, [wrong]);

  // 열리면 문자가 한 통씩 도착한다. 그날 못 온 알림이 지금 몰려서 오는 소리다.
  useEffect(() => {
    if (screen !== "messages" || arrived >= MOM_MESSAGES.length) return;
    const timer = setTimeout(
      () => {
        playSound("phoneBeep", { variation: 0.06 });
        setArrived((count) => count + 1);
      },
      arrived === 0 ? 400 : 700,
    );
    return () => clearTimeout(timer);
  }, [screen, arrived]);

  // 키보드 경로 — 숫자키·넘패드로 입력, Backspace로 지운다.
  useEffect(() => {
    if (screen !== "locked" || frozen) return;
    const onKey = (event: KeyboardEvent) => {
      if (/^[0-9]$/.test(event.key)) {
        event.preventDefault();
        pressDigit(event.key);
      } else if (event.key === "Backspace") {
        event.preventDefault();
        eraseDigit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen, frozen, pressDigit, eraseDigit]);

  const allArrived = arrived >= MOM_MESSAGES.length;

  return (
    <div className="flex animate-fade-rise flex-col items-center gap-4">
      {/* 기기 테두리 — phone-chat과 같은 폰이라는 인상을 만든다 */}
      <div className="mx-auto w-[22rem] max-w-[92vw]">
        <div className="rounded-[2.5rem] bg-ink p-[3px] shadow-panel ring-1 ring-night/80">
          <div className="relative overflow-hidden rounded-[2.3rem] bg-scene-void">
            {/* 노치 */}
            <div className="absolute left-1/2 top-0 z-10 h-[1.2rem] w-[6.5rem] -translate-x-1/2 rounded-b-xl bg-ink" />

            {/* 상태바 */}
            <div className="flex items-center justify-between px-5 pb-1 pt-2 text-bone/85">
              <span className="w-16 text-[0.75rem] font-bold tabular-nums">17:03</span>
              <span className="w-[6.5rem]" aria-hidden />
              <span className="flex w-16 items-center justify-end gap-1" aria-hidden>
                <CellSignalFull size={13} weight="fill" />
                <WifiHigh size={13} weight="fill" />
                <BatteryHigh size={15} weight="fill" />
              </span>
            </div>

            {screen === "locked" ? (
              <div className="flex h-[min(28rem,60dvh)] flex-col items-center px-5 pb-4 pt-3">
                <LockSimple size={16} weight="fill" className="text-bone/45" aria-hidden />
                {/* 잠금화면의 시계. 날짜는 일부러 없다 — 오늘이 며칠인지는 이 게임이 못박지 않는다 */}
                <p className="mt-0.5 text-3xl font-bold tabular-nums text-paper">17:03</p>

                {/* 몇 주 만의 알림 — 잠금을 풀 이유가 화면 안에 있다 */}
                <div className="mt-3 flex w-full items-center gap-2.5 rounded-xl bg-bone/10 px-3.5 py-2.5">
                  <ChatCircleDots size={20} weight="fill" className="shrink-0 text-memory" />
                  <div className="min-w-0">
                    <p className="truncate text-[0.8125rem] font-bold text-paper">
                      {t("minigame.phoneLock.sender")}
                    </p>
                    <p className="truncate text-[0.75rem] text-bone/55">
                      {t("minigame.phoneLock.notification")}
                    </p>
                  </div>
                </div>

                {/* 입력 자리 — 틀리면 흔들린다. 점은 장식이고, 자리 수·오답은
                    아래 role="status" 줄과 키 소리가 읽어 준다 */}
                <div
                  aria-hidden
                  className={`mt-4 flex items-center gap-3 ${wrong ? "animate-page-nudge" : ""}`}
                >
                  {Array.from({ length: PASSCODE_LENGTH }, (_, at) => (
                    <span
                      // biome-ignore lint/suspicious/noArrayIndexKey: 자릿수 칸은 순서가 정체성이다
                      key={at}
                      className={`size-3 rounded-full border transition-colors ${
                        at < entry.length
                          ? wrong
                            ? "border-ember bg-ember"
                            : "border-memory bg-memory"
                          : "border-bone/40"
                      }`}
                    />
                  ))}
                </div>
                <p
                  role="status"
                  className={`mt-2 min-h-4 text-[0.75rem] ${wrong ? "text-ember" : "text-bone/45"}`}
                >
                  {wrong ? t("minigame.phoneLock.wrong") : t("minigame.phoneLock.hint")}
                </p>

                {/* 키패드 */}
                <div className="mt-auto grid w-full max-w-52 grid-cols-3 gap-2">
                  {KEYPAD.map((key) =>
                    key === "" ? (
                      <span key="pad-gap" aria-hidden />
                    ) : key === "⌫" ? (
                      <button
                        key="pad-erase"
                        type="button"
                        onClick={eraseDigit}
                        aria-label={t("minigame.phoneLock.erase")}
                        className="mx-auto flex size-12 cursor-pointer items-center justify-center rounded-full text-bone/70 transition-colors hover:bg-bone/10 active:bg-bone/20"
                      >
                        <Backspace size={22} />
                      </button>
                    ) : (
                      <button
                        key={`pad-${key}`}
                        type="button"
                        onClick={() => pressDigit(key)}
                        className="mx-auto flex size-12 cursor-pointer items-center justify-center rounded-full bg-bone/10 text-lg font-bold text-paper transition-colors hover:bg-bone/20 active:bg-bone/30"
                      >
                        {key}
                      </button>
                    ),
                  )}
                </div>
              </div>
            ) : (
              <div className="flex h-[min(28rem,60dvh)] flex-col">
                {/* 메시지 앱 헤더 */}
                <div className="flex items-center gap-2.5 border-b border-bone/10 px-3.5 pb-3 pt-1.5">
                  <ChatCircleDots size={18} weight="fill" className="shrink-0 text-memory" />
                  <p className="min-w-0 flex-1 truncate text-[0.9375rem] font-bold text-paper">
                    {t("minigame.phoneLock.sender")}
                  </p>
                </div>

                <div
                  role="log"
                  aria-label={t("minigame.phoneLock.sender")}
                  className="min-h-0 flex-1 overflow-y-auto bg-scene-navy px-3 py-3.5"
                >
                  {/* 보낸 날짜가 대화의 머리로 선다 — 그날 쓰인 문자라는 것이 이 화면의 전부다 */}
                  <p className="pb-3 text-center text-[0.6875rem] tracking-wider text-bone/35">
                    {t("minigame.phoneLock.dateSent")}
                  </p>
                  <ul className="flex flex-col gap-2.5">
                    {MOM_MESSAGES.slice(0, frozen ? MOM_MESSAGES.length : arrived).map(
                      (message) => (
                        <li
                          key={message.id}
                          className="flex animate-fade-rise flex-col items-start"
                        >
                          <div className="flex max-w-[82%] items-end gap-1.5">
                            <p className="break-ko text-pretty rounded-2xl rounded-bl-sm bg-scene-dusk px-3 py-2 text-[0.875rem] leading-relaxed text-paper">
                              {t(message.textKey)}
                            </p>
                            <span className="shrink-0 pb-1 text-[0.625rem] tabular-nums text-bone/35">
                              {message.time}
                            </span>
                          </div>
                        </li>
                      ),
                    )}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 잠금 중에는 조작 안내(+스킵), 다 읽으면 닫는 버튼. phone-chat과 같은 자리다 */}
      {frozen ? null : (
        <div className="flex min-h-9 items-center gap-3">
          {screen === "locked" ? (
            <>
              <p className="break-ko text-pretty px-4 text-center text-sm tracking-widest text-bone/50">
                {hint("minigame.phoneLock.help")}
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
          ) : allArrived ? (
            <button
              type="button"
              onClick={() => complete({ cleared: true })}
              className="flex cursor-pointer items-center gap-1.5 rounded-full bg-paper px-6 py-2 text-sm font-bold tracking-widest text-ink transition-all hover:-translate-y-0.5 active:translate-y-0"
            >
              <Check size={16} weight="bold" />
              {t("minigame.phoneLock.close")}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
