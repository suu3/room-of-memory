"use client";

import { Check } from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { InspectObject } from "@/components/canvas/InspectTurntable";
import {
  ampouleCaseObject,
  ampouleObject,
  idCardObject,
  tableNoteObject,
} from "@/components/canvas/inspect-objects";
import { InspectView } from "@/components/ui/InspectView";
import { useControlHint } from "@/i18n/control-hint";
import { playSound } from "@/lib/audio";
import type { CommonTextKey, MinigameProps } from "@/types/minigame";
import { useOnceCompleter, useSkipEligible } from "../shell";

/** 못 찾아도 막다른 길이 아니다: 이만큼 지나면 스킵이 선다 (접근성 계약). */
const SKIP_AFTER_MS = 45_000;

interface InspectStage {
  object: InspectObject;
  alt: string;
  /** 찾은 뒤 판 아래에 서는 한 줄: 무엇을 봤는지. */
  found: string;
}

/**
 * 3D 인스펙트 미니게임의 껍데기 (v4.1 2장). 물건을 돌려 찾을 면을 보면 한 줄이 서고,
 * "내려놓는다"를 누르면 끝난다. 단계가 둘이면(앰플 케이스 → 앰플) 앞 단계를 찾은 뒤
 * "다음"으로 다음 물건을 집는다.
 *
 * 실패는 없다: 돌려 보는 인터랙션이다. 스킵은 찾은 것으로 친다(cleared).
 */
function InspectMinigame({
  stages,
  onComplete,
  stage = "play",
}: Pick<MinigameProps, "onComplete" | "stage"> & { stages: readonly InspectStage[] }) {
  const { t } = useTranslation();
  const hint = useControlHint();
  const complete = useOnceCompleter(onComplete);
  const frozen = stage === "result";
  const [index, setIndex] = useState(frozen ? stages.length - 1 : 0);
  const [found, setFound] = useState(frozen);
  const skipByTime = useSkipEligible(SKIP_AFTER_MS);
  const current = stages[index];
  const last = index >= stages.length - 1;

  const onFound = useCallback(() => {
    playSound("flip", { variation: 0.05 });
    setFound(true);
  }, []);

  const next = useCallback(() => {
    if (last) {
      complete({ cleared: true });
      return;
    }
    playSound("select");
    setIndex((value) => value + 1);
    setFound(false);
  }, [last, complete]);

  useEffect(() => {
    if (frozen || !found) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== "Enter") return;
      event.preventDefault();
      next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [frozen, found, next]);

  return (
    <div className="flex w-[min(34rem,94vw)] animate-fade-rise flex-col items-center gap-4">
      <InspectView
        // 단계가 바뀌면 새 물건을 집는다: 각도·확대가 처음부터
        key={index}
        object={current.object}
        alt={current.alt}
        hint={hint("minigame.inspect.help")}
        onFound={onFound}
        className="w-full"
      />
      <div className="flex min-h-9 flex-col items-center gap-2">
        {found ? (
          <p
            aria-live="polite"
            className="animate-fade-rise break-ko text-pretty px-4 text-center text-sm text-paper"
          >
            {current.found}
          </p>
        ) : null}
        {frozen ? null : found ? (
          <button
            type="button"
            onClick={next}
            className="flex cursor-pointer items-center gap-1.5 rounded-full bg-paper px-6 py-2 text-sm font-bold tracking-widest text-ink transition-all hover:-translate-y-0.5 active:translate-y-0"
          >
            <Check size={16} weight="bold" />
            {t(last ? "minigame.inspect.putDown" : "minigame.inspect.next")}
          </button>
        ) : skipByTime ? (
          <button
            type="button"
            onClick={() => {
              setFound(true);
            }}
            className="cursor-pointer whitespace-nowrap rounded-full border border-bone/40 px-5 py-1.5 text-sm font-bold tracking-widest text-bone/70 transition-all hover:border-bone hover:text-paper active:translate-y-px"
          >
            {t("minigame.skip")}
          </button>
        ) : null}
      </div>
    </div>
  );
}

const key = (value: CommonTextKey) => value;

/** 식탁 위 쪽지 (2페이즈): 안쪽에 엄마 메모. */
export function CardFlipMinigame(props: MinigameProps) {
  const { t } = useTranslation();
  const stages = useMemo<InspectStage[]>(
    () => [
      {
        object: tableNoteObject(t("minigame.cardFlip.memo"), t("minigame.cardFlip.signature")),
        alt: t("minigame.cardFlip.alt"),
        found: t("minigame.cardFlip.found"),
      },
    ],
    [t],
  );
  return <InspectMinigame stages={stages} {...props} />;
}

/** 안방 출입증 (4페이즈): 뒷면에 라온 로고. */
export function IdCardFlipMinigame(props: MinigameProps) {
  const { t } = useTranslation();
  const stages = useMemo<InspectStage[]>(
    () => [
      {
        object: idCardObject({
          org: t("minigame.idCardFlip.org"),
          role: t("minigame.idCardFlip.role"),
          names: [t("minigame.idCardFlip.dad"), t("minigame.idCardFlip.mom")],
        }),
        alt: t("minigame.idCardFlip.alt"),
        found: t("minigame.idCardFlip.found"),
      },
    ],
    [t],
  );
  return <InspectMinigame stages={stages} {...props} />;
}

/** 냉장고 아래칸의 보냉 케이스 → 앰플 (3페이즈): 빈 슬롯, 라벨의 로고 조각. */
export function AmpouleCaseMinigame(props: MinigameProps) {
  const { t } = useTranslation();
  const stages = useMemo<InspectStage[]>(
    () => [
      {
        object: ampouleCaseObject(t(key("minigame.ampouleCase.caution"))),
        alt: t("minigame.ampouleCase.caseAlt"),
        found: t("minigame.ampouleCase.slotFound"),
      },
      {
        object: ampouleObject(),
        alt: t("minigame.ampouleCase.ampouleAlt"),
        found: t("minigame.ampouleCase.labelFound"),
      },
    ],
    [t],
  );
  return <InspectMinigame stages={stages} {...props} />;
}
