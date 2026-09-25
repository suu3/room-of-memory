"use client";

import { Check } from "@phosphor-icons/react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useControlHint } from "@/i18n/control-hint";
import { playSound } from "@/lib/audio";
import type { MinigameProps } from "@/types/minigame";
import { PhoneShell } from "../phone-chat/PhoneShell";
import { MOM_UNREAD } from "../phone-chat/thread";
import { useOnceCompleter } from "../shell";

/** 엄마가 그날 아침 보낸 문자의 시각. 캐시 뉴스의 첫 보도(오후 3시대)보다 한참 앞이다. */
export const MOM_MESSAGE_TIME = "07:12";

/**
 * 폰 2차 (v4 3-4): 1막부터 떠 있던 엄마 대화방의 "읽지 않음 1"을 연다.
 *
 * 잠금은 없다. 비밀번호를 풀어 여는 게 아니라, 미뤄 둔 방을 **스스로 여는** 동작이다.
 * 목록에서 엄마 방을 누르면 방이 열리고, 배지의 1이 사라진다. 문자는 한 통뿐이다:
 * 그날 아침 7시 12분, 끝나면 바로 집에 오라고. 뉴스는 오후였다 (컴퓨터 2차가 먼저
 * 보여 준다). 시각을 짚는 말은 결과 대사가 한 번만 한다.
 *
 * 실패는 없다. 읽는 인터랙션이다.
 */
export function MomChatMinigame({ onComplete, stage = "play" }: MinigameProps) {
  const { t } = useTranslation();
  const hint = useControlHint();
  const complete = useOnceCompleter(onComplete);
  // 결과 대사 단계로 새로 마운트되면 이미 읽은 방이 열려 있어야 한다
  const [opened, setOpened] = useState(stage === "result");
  const frozen = stage === "result";

  const openRoom = useCallback(() => {
    if (opened || frozen) return;
    playSound("phoneBeep", { variation: 0.04 });
    setOpened(true);
  }, [opened, frozen]);

  useEffect(() => {
    if (frozen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== "Enter" && event.code !== "Space") return;
      event.preventDefault();
      if (!opened) openRoom();
      else complete({ cleared: true });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [opened, frozen, openRoom, complete]);

  return (
    <div className="flex animate-fade-rise flex-col items-center gap-4">
      <PhoneShell
        title={t(opened ? "minigame.phoneChat.contact.mom" : "minigame.momChat.listTitle")}
        subtitle={t(opened ? "minigame.momChat.roomSubtitle" : "minigame.momChat.listSubtitle")}
        clock="20:47"
      >
        {opened ? (
          <div
            role="log"
            aria-label={t("minigame.phoneChat.contact.mom")}
            className="size-full overflow-y-auto bg-scene-navy px-3 py-3.5"
          >
            <p className="pb-3 text-center text-[0.6875rem] tracking-wider text-bone/35">
              {t("minigame.phoneChat.date")}
            </p>
            <div className="flex animate-fade-rise flex-col items-start">
              <span className="mb-1 px-1 text-[0.6875rem] font-bold tracking-wider text-bone/45">
                {t("minigame.phoneChat.contact.mom")}
              </span>
              <div className="flex max-w-[82%] items-end gap-1.5">
                <p className="break-ko text-pretty rounded-2xl rounded-bl-sm bg-scene-dusk px-3 py-2 text-[0.875rem] leading-relaxed text-paper">
                  {t("minigame.momChat.message")}
                </p>
                <span className="shrink-0 pb-1 text-[0.625rem] tabular-nums text-bone/35">
                  {MOM_MESSAGE_TIME}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="size-full bg-scene-navy px-3 py-3">
            <button
              type="button"
              onClick={openRoom}
              className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl bg-scene-dusk/60 px-3 py-2.5 text-left transition-colors hover:bg-scene-dusk focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-memory"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[0.875rem] font-bold text-paper">
                  {t("minigame.phoneChat.contact.mom")}
                </span>
                <span className="block truncate text-[0.75rem] text-bone/45">
                  {t("minigame.phoneChat.family.momPreview")}
                </span>
              </span>
              <span className="shrink-0 text-[0.6875rem] tabular-nums text-bone/40">
                {MOM_MESSAGE_TIME}
              </span>
              <span className="min-w-[1.15rem] shrink-0 rounded-full bg-ember px-1 text-center text-[0.6875rem] font-bold leading-[1.15rem] text-paper">
                {MOM_UNREAD}
              </span>
            </button>
          </div>
        )}
      </PhoneShell>

      <div className="flex min-h-9 items-center gap-3">
        {opened && !frozen ? (
          <button
            type="button"
            onClick={() => complete({ cleared: true })}
            className="flex cursor-pointer items-center gap-1.5 rounded-full bg-paper px-6 py-2 text-sm font-bold tracking-widest text-ink transition-all hover:-translate-y-0.5 active:translate-y-0"
          >
            <Check size={16} weight="bold" />
            {t("minigame.phoneChat.close")}
          </button>
        ) : !frozen ? (
          <p className="break-ko text-pretty px-4 text-center text-sm tracking-widest text-bone/50">
            {hint("minigame.momChat.help")}
          </p>
        ) : null}
      </div>
    </div>
  );
}
