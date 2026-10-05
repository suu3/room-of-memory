"use client";

import type { ParseKeys } from "i18next";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { DEDUCTIONS, type DeductionId, pairSolves } from "@/data/deductions";
import type { MemoryId } from "@/data/memory-room";
import { lastVisitDone, visitConfig } from "@/data/story-phase";
import { localizeAsset } from "@/lib/assets";
import { playSound } from "@/lib/audio";
import { useTypewriterState } from "@/lib/use-typewriter";
import { selectDeductionResumable, useMemoryRoomStore } from "@/store/memory-room";
import { selectLocale, useSettingsStore } from "@/store/settings";
import { STAGGER_CLASS, staggerStyle } from "../shared/stagger";
import { FOCUS_RING } from "../shared/ui-classes";
import { boardCards, hintedCards, pickCard } from "./deduction-board";
import { LoreStill } from "./LoreEntries";
import { loreBodyKey, loreTitleKey } from "./lore-text";

/**
 * 추리 판: 결론 컷씬 앞에 서는 "모순 찾기" (src/data/deductions.ts).
 *
 * 수첩 모달이 아니라 **무대**다. 방이 어두워지고, 위에 누군가의 말 한 줄이 찍히고, 그 아래
 * 빈 사진 자리 둘이 선으로 매달린다. 책상에는 수첩에서 꺼낸 기록 사진들이 흩어져 있다.
 * 사진을 누르면 자리로 올라가고, 둘이 차면 한 박자 뒤에 판정이 난다: 맞으면 선이 금빛으로
 * 이어지고, 어긋나면 한 번 흔들리고 사진이 책상으로 돌아온다.
 * 처음엔 종이 패널 안의 카드 격자였는데, 그건 웹 페이지의 선택 폼으로 읽혔다
 * (DESIGN.md Overview: "전부 같은 네이비 사각 패널이면 웹 모달로 읽힌다").
 *
 * 대사 선택지(셋 중 하나)가 아니라 기록 사진인 이유: 선택지는 답이 눈앞에 적혀 있어 읽고
 * 찍는 퀴즈가 된다. 사진은 플레이어가 조사해 모은 것이라, 어느 둘이 그 말과 안 맞는지는
 * 스스로 떠올려야 한다.
 *
 * 닫기가 없다. 결론이 이 판 뒤에 줄 서 있어서, 내려놓으면 이야기가 그 자리에 멈춘다.
 * 대신 막힌 채로 두지 않는다: 몇 번 어긋나면 답이 되는 사진에 금빛 테가 둘린다
 * (hintedCards. 미니게임의 스킵과 같은 약속이다).
 */
export function DeductionBoard() {
  const active = useMemoryRoomStore((state) => state.activeDeduction);
  const resumable = useMemoryRoomStore(selectDeductionResumable);
  const resume = useMemoryRoomStore((state) => state.resumeDeduction);

  // 판이 뜬 채로 껐다 켠 경우: 판은 저장되지 않으므로 방이 비는 순간 같은 물음을 다시 세운다
  useEffect(() => {
    if (resumable) resume();
  }, [resumable, resume]);

  // key: 다른 추리로 바뀌면 고른 것과 어긋난 횟수가 새로 시작한다
  return active ? <Board key={active} id={active} /> : null;
}

/** 어긋났을 때의 한 줄. 같은 말만 되풀이하지 않게 셋을 돌린다. */
const MISS_LINES = ["deduction.miss1", "deduction.miss2", "deduction.miss3"] as const;
/** 두 자리가 찬 뒤 판정까지의 한 박자. 곧장 판정하면 누른 것과 결과가 한 덩어리로 지나간다. */
const WEIGH_MS = 650;
/** 어긋난 사진이 책상으로 돌아가기까지. 무엇이 어긋났는지 볼 시간이다. */
const RETURN_MS = 1300;

type Verdict = "hit" | "miss";

function Board({ id }: { id: DeductionId }) {
  const { t } = useTranslation();
  const { t: tRoom, i18n } = useTranslation("memoryRoom");
  const collected = useMemoryRoomStore((state) => state.collected);
  const revisited = useMemoryRoomStore((state) => state.revisited);
  const rechecked = useMemoryRoomStore((state) => state.rechecked);
  const guided = useMemoryRoomStore((state) => state.difficulty === "guided");
  const finish = useMemoryRoomStore((state) => state.finishDeduction);
  const locale = useSettingsStore(selectLocale);
  const [picked, setPicked] = useState<MemoryId[]>([]);
  const [misses, setMisses] = useState(0);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const claim = useTypewriterState(t(`deduction.claims.${id}`), 45);

  const full = picked.length === 2;
  const hinted = hintedCards(id, misses, guided);
  const progress = { collected, revisited, rechecked };

  // 두 자리가 찼다: 한 박자 뒤에 판정한다
  useEffect(() => {
    if (!full) return;
    const hit = pairSolves(id, picked);
    const timer = window.setTimeout(() => {
      setVerdict(hit ? "hit" : "miss");
      playSound(hit ? "success" : "deny");
      if (!hit) setMisses((count) => count + 1);
    }, WEIGH_MS);
    return () => window.clearTimeout(timer);
  }, [full, id, picked]);

  // 어긋난 사진은 잠깐 보여 준 뒤 책상으로 돌려보낸다
  useEffect(() => {
    if (verdict !== "miss") return;
    const timer = window.setTimeout(() => {
      setPicked([]);
      setVerdict(null);
    }, RETURN_MS);
    return () => window.clearTimeout(timer);
  }, [verdict]);

  const press = (card: MemoryId) => {
    // 자리가 찬 동안(판정 대기·판정 중)에는 손을 대지 못한다
    if (full) return;
    setPicked(pickCard(picked, card));
    playSound("select");
  };

  const cardOf = (card: MemoryId) => {
    const visit = lastVisitDone(progress, card) ?? 2;
    const titleKey = loreTitleKey(card, visit, (key) => i18n.exists(key, { ns: "memoryRoom" }));
    return {
      title: tRoom(titleKey as ParseKeys<"memoryRoom">),
      body: tRoom(loreBodyKey(card, visit) as ParseKeys<"memoryRoom">),
      still: localizeAsset(visitConfig(card, visit)?.replayStill, locale),
    };
  };

  /* 도해의 한 줄. 판정이 없을 때는 지금 무엇을 할 차례인지를 도해의 말로 짚는다 */
  const line =
    verdict === "hit"
      ? t("deduction.joined")
      : verdict === "miss" || (picked.length === 0 && misses > 0)
        ? t(MISS_LINES[(Math.max(misses, 1) - 1) % MISS_LINES.length])
        : picked.length === 1
          ? t("deduction.one")
          : full
            ? ""
            : t("deduction.prompt");

  // 선의 색: 판정 전에는 헤어라인, 맞으면 금빛, 어긋나면 벽돌빛
  const thread = verdict === "hit" ? "bg-memory" : verdict === "miss" ? "bg-ember" : "bg-ivory/25";

  return (
    <div className="absolute inset-0 z-30 overflow-clip">
      {/* 방은 사라지지 않고 가라앉는다: 가장자리부터 조여 가운데 무대만 남긴다 */}
      <div aria-hidden className="absolute inset-0 animate-backdrop-in bg-scene-void/80" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(110% 90% at 50% 40%, transparent 40%, var(--color-scene-void) 100%)",
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("deduction.title")}
        className="relative mx-auto flex h-full w-full max-w-4xl flex-col items-center px-4 pt-6 pb-4 sm:pt-10"
      >
        {/* 모순을 찾을 말. 상자 없이 장면 위에 찍힌다 (혼잣말과 같은 문법) */}
        <header className="flex-none text-center">
          <p aria-hidden className="font-pixel text-ash text-xs tracking-[0.12em]">
            {t("deduction.title")}
          </p>
          <p className="mt-3 text-[13px] font-medium text-memory">
            {tRoom(`characters.${DEDUCTIONS[id].claimant}.name` as ParseKeys<"memoryRoom">)}
          </p>
          <blockquote className="monologue-text mt-1 min-h-[1.5em] break-ko text-balance font-pixel text-ivory text-monologue leading-normal">
            <span className="sr-only">{t(`deduction.claims.${id}`)}</span>
            <span aria-hidden>“{claim.typed}”</span>
          </blockquote>
        </header>

        {/*
          말에서 두 자리로 내려오는 선. 위에서 한 줄기로 내려와 좌우로 갈라진다.
          선은 그어진다(rule-draw): 판이 "나타나는" 게 아니라 누가 줄을 매다는 것으로 읽힌다.
        */}
        <div aria-hidden className="flex w-full max-w-md flex-none flex-col items-center">
          <span
            className={`h-5 w-px animate-rule-draw-y transition-colors duration-200 ${thread}`}
          />
          <span
            className={`h-px w-1/2 animate-rule-draw transition-colors duration-200 ${thread}`}
          />
          <span className="flex w-1/2 justify-between">
            <span className={`h-4 w-px transition-colors duration-200 ${thread}`} />
            <span className={`h-4 w-px transition-colors duration-200 ${thread}`} />
          </span>
        </div>

        {/* 사진 자리 둘. 빈 자리는 수첩의 빈 사진 칸과 같은 귀퉁이 홀더다 */}
        <div
          className={`relative flex w-full max-w-md flex-none justify-between gap-4 ${
            verdict === "miss" ? "animate-page-nudge" : ""
          }`}
        >
          {[0, 1].map((slot) => {
            const card = picked[slot];
            if (!card) {
              return (
                <div
                  key={slot}
                  role="img"
                  aria-label={t("deduction.slotEmpty")}
                  className="relative aspect-[16/9] w-[calc(50%-0.5rem)] rounded-[2px] border border-line bg-surface-subtle"
                >
                  {[
                    "left-1.5 top-1.5 border-l border-t",
                    "right-1.5 top-1.5 border-r border-t",
                    "left-1.5 bottom-1.5 border-b border-l",
                    "right-1.5 bottom-1.5 border-b border-r",
                  ].map((corner) => (
                    <span key={corner} className={`absolute size-3 border-ivory/30 ${corner}`} />
                  ))}
                </div>
              );
            }
            const { title, still } = cardOf(card);
            return (
              <button
                key={slot}
                type="button"
                disabled={full}
                onClick={() => press(card)}
                aria-label={t("deduction.putBack", { title })}
                className={`w-[calc(50%-0.5rem)] animate-fade-rise cursor-pointer rounded-sm border bg-card p-1.5 text-left transition-colors duration-200 disabled:cursor-default ${FOCUS_RING} ${
                  verdict === "hit"
                    ? "border-memory"
                    : verdict === "miss"
                      ? "border-ember"
                      : "border-ink/20"
                }`}
              >
                <LoreStill id={card} name={title} unlocked wide still={still} />
                <span className="mt-1 block truncate text-ink text-xs font-medium">{title}</span>
              </button>
            );
          })}
          {/* 맞았다: 두 사진 사이에 한 단어. 튀어나오지 않고 떠오른다 */}
          {verdict === "hit" && (
            <span className="-translate-x-1/2 -translate-y-1/2 monologue-text absolute top-1/2 left-1/2 animate-fade-rise font-pixel text-[1.75rem] text-memory">
              {t("deduction.verdict")}
            </span>
          )}
        </div>

        {/* 도해의 한 줄과, 맞은 뒤의 넘기기 */}
        <div className="flex min-h-20 flex-none flex-col items-center justify-center gap-1.5 py-3 text-center">
          <p aria-live="polite" className="monologue-text break-ko font-pixel text-ivory text-lg">
            {line}
          </p>
          {verdict === "hit" ? (
            <button
              type="button"
              // biome-ignore lint/a11y/noAutofocus: 이어진 순간 다음 행동은 이 버튼 하나다
              autoFocus
              onClick={finish}
              className={`animate-fade-rise cursor-pointer border-memory border-b px-1 pb-0.5 font-pixel text-memory text-sm ${FOCUS_RING}`}
            >
              <span aria-hidden>▶ </span>
              {t("deduction.continue")}
            </button>
          ) : (
            <p className="text-ash text-xs">
              {hinted.length > 0 ? t("deduction.hint") : t("deduction.help")}
            </p>
          )}
        </div>

        {/* 책상 위의 기록들. 자리로 올라간 사진은 빈 자국만 남는다 */}
        <ul className="flex min-h-0 w-full flex-1 flex-wrap content-start justify-center gap-x-3 gap-y-4 overflow-y-auto overscroll-contain px-1 pt-2 pb-3 sm:gap-x-4">
          {boardCards(revisited).map((card, index) => {
            const { title, body, still } = cardOf(card);
            const lifted = picked.includes(card);
            const hint = !lifted && verdict !== "hit" && hinted.includes(card);
            return (
              <li
                key={card}
                className={`w-[calc(50%-0.375rem)] sm:w-44 ${STAGGER_CLASS}`}
                style={staggerStyle(index)}
              >
                <button
                  type="button"
                  aria-pressed={lifted}
                  disabled={full}
                  onClick={() => press(card)}
                  className={`flex h-full w-full cursor-pointer flex-col rounded-sm border bg-card p-2 text-left transition-[border-color,opacity,translate] duration-150 disabled:cursor-default ${FOCUS_RING} ${
                    index % 2 === 0 ? "rotate-[-0.8deg]" : "rotate-[0.8deg]"
                  } ${
                    lifted
                      ? "border-transparent opacity-20"
                      : hint
                        ? "border-memory"
                        : "border-ink/10 hover:-translate-y-1 hover:border-ink/40"
                  }`}
                >
                  <LoreStill id={card} name={title} unlocked wide still={still} />
                  <span className="mt-1.5 text-graphite text-xs font-medium tracking-[0.06em]">
                    {title}
                    {/* 금빛 테만으로 말하지 않는다: 읽는 사람에게도 짚어 준 기록임을 적는다 */}
                    {hint && <span className="sr-only"> ({t("deduction.hinted")})</span>}
                  </span>
                  <span className="mt-0.5 break-ko text-pretty text-ink text-xs leading-normal">
                    {body}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
