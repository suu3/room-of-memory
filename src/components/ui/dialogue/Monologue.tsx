"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { MonologueId } from "@/data/monologue";
import { useEffectEnabled } from "@/lib/effects/effect-budget";
import { useTypewriter } from "@/lib/use-typewriter";
import { type Act, selectAct, useMemoryRoomStore } from "@/store/memory-room";
import {
  EXIT_SPREAD_MS,
  EXIT_TOTAL_MS,
  type ExitChar,
  exitDirection,
  exitPlan,
} from "./monologue-exit";

/**
 * 단계가 바뀔 때 옛 줄이 물러나는 시간(ms). 글자 단위 물러남(monologue-exit.ts)이 끝나는
 * 시간과 같다. 효과가 꺼진 판의 폴백(문단 전체 opacity, globals의 duration-300)은 이보다
 * 짧아서 그 안에 끝난다.
 */
const SWAP_FADE_MS = EXIT_TOTAL_MS;

/**
 * 화면 상단 혼잣말. 지금 할 일 알약(HudGuide) 아래, 화면 위 가운데에 선다.
 *
 * 타자 연출을 살리려면 훅이 **보이는 시점에** 마운트되어야 한다. 부모(MemoryRoom)
 * 최상단에서 호출하면 타이틀 화면이 떠 있는 동안 보이지도 않는 채로 다 찍혀서,
 * 방에 들어왔을 땐 이미 완성된 문장만 남는다. 그래서 별도 컴포넌트로 떼어냈다.
 *
 * 구간(조사 개수)이 바뀌면 새 줄을 처음부터 다시 찍는다. 다만 **곧장 갈아치우지
 * 않는다**. 구간은 기억을 하나 완료하는 순간에 넘어가는데, 그때 줄이 통째로
 * 사라졌다 다시 찍히면 대사창이 닫히는 것과 겹쳐서 화면이 깜빡인 것처럼 보인다.
 * 옛 줄을 한 박자 물러나게 한 뒤에 새 줄을 들인다.
 *
 * 물러나는 쪽은 글자 단위다 (docs/visual-experiments.md 8장). 1막에서는 말끝이 흐려지며
 * 떨어지고, 2막부터는 글자가 아래에서 위로 모이며 사라진다. 등장(타자기)은 그대로.
 * 효과 예산(useEffectEnabled)이 막으면 예전처럼 문단 전체가 opacity로 물러난다.
 *
 * 대사창도 토스트도 아니다. 상자·화자·꼬리 없이 아이보리 글자만 어둠 위에 선다.
 * 그림자 두 겹(.monologue-text)이 밝은 물건 위에서도 글자를 세우고, 그래도 모자란
 * 자리는 경계 없는 어둠(.monologue-veil)이 글자 뒤에만 옅게 깔린다.
 *
 * 대사창·미니게임·컷씬이 떠 있는 동안은 물러난다(`hidden`). 그대로 두면 대사창의 줄과
 * 이 줄이 동시에 읽혀 화면에 말이 둘이 된다. 언마운트하지 않고 투명하게만 두는 이유는,
 * 돌아왔을 때 같은 줄을 처음부터 다시 찍지 않기 위해서다.
 */
export function Monologue({
  monologueId,
  hidden = false,
}: {
  monologueId: MonologueId;
  hidden?: boolean;
}) {
  const { t: tRoom } = useTranslation("memoryRoom");
  const act = useMemoryRoomStore(selectAct);
  const perChar = useEffectEnabled("cheap");
  /** 지금 찍고 있는 구간. monologueId가 바뀌어도 페이드가 끝난 뒤에 따라온다. */
  const [shown, setShown] = useState(monologueId);
  /**
   * 물러나는 중인 줄의 본문. null이면 물러나고 있지 않다. 타자기가 아직 찍는 중에 구간이
   * 넘어갈 수도 있어서, 물러나기 시작한 순간의 글자들을 여기 **얼려 둔다**. 얼리지 않으면
   * 물러나는 도중에 새 글자가 계속 돋아나고, 글자 수가 바뀔 때마다 지연이 다시 계산되어
   * 이미 움직이던 글자가 처음부터 다시 움직인다.
   */
  const [leavingText, setLeavingText] = useState<string | null>(null);
  const monologue = useTypewriter(tRoom(`stages.${shown}.monologue`));

  /* 교체 effect가 타자기의 최신 글자를 읽되, 글자마다 effect가 다시 돌지는 않게 ref로 건넨다 */
  const typedRef = useRef(monologue);
  useEffect(() => {
    typedRef.current = monologue;
  }, [monologue]);

  useEffect(() => {
    if (monologueId === shown) return;
    setLeavingText(typedRef.current);
    const timer = window.setTimeout(() => {
      setShown(monologueId);
      setLeavingText(null);
    }, SWAP_FADE_MS);
    return () => window.clearTimeout(timer);
  }, [monologueId, shown]);

  /* 글자 단위로 물러나는 동안은 문단은 그대로 두고 글자들이 각자 사라진다 */
  const perCharLeaving = leavingText !== null && perChar;

  return (
    /*
     * 자리는 부모(MemoryRoom의 화면 위 가운데 기둥)가 정한다. 여기서는 폭을 다 쓰는
     * 블록 하나로만 선다. 그래야 위의 안내 알약과 한 흐름에 놓여 서로 겹치지 않는다.
     */
    <div
      aria-hidden={hidden}
      className={`pointer-events-none relative w-full text-center transition-opacity duration-300 ${
        hidden ? "opacity-0" : "opacity-100"
      }`}
    >
      <span aria-hidden className="monologue-veil absolute -inset-x-10 -inset-y-5 -z-10" />
      {/*
        글자는 폭 따라 20→30px(--text-monologue). 좁은 화면에서 넘치면 어절 단위로 접는다.
        대본의 개행(stages.yaml의 여러 줄 독백)은 그대로 줄을 꺾는다 (whitespace-pre-line)
      */}
      <p
        /* 물러나는 글자들은 이미 읽힌 말의 잔상이라 보조기기에는 들려주지 않는다 */
        aria-hidden={perCharLeaving || undefined}
        className={`monologue-text animate-fade-rise whitespace-pre-line break-ko text-pretty font-pixel text-monologue leading-normal text-ivory transition-opacity duration-300 ${
          leavingText !== null && !perChar ? "opacity-0" : "opacity-100"
        }`}
      >
        {leavingText !== null && perChar ? (
          <MonologueExitText text={leavingText} act={act} spreadMs={EXIT_SPREAD_MS} />
        ) : (
          monologue
        )}
      </p>
    </div>
  );
}

/**
 * 물러나는 줄을 글자마다 `<span>`으로 세운 것. 글자 하나하나가 .monologue-exit-down /
 * .monologue-exit-up 애니메이션을 제 지연(monologue-exit.ts)으로 돈다. 실험실
 * (/lab/monologue-exit)도 같은 것을 쓴다.
 *
 * 줄바꿈이 문제다. transform은 inline 상자에 먹지 않아 글자마다 inline-block이 필요한데,
 * 붙어 선 inline-block 사이는 어디서든 줄이 꺾일 수 있어서 `break-ko`(keep-all)가 지키던
 * 어절이 갈라진다. 그래서 어절(공백 사이의 글자 묶음)을 nowrap인 inline span으로 한 번
 * 감싸고, 공백은 글자 span으로 만들지 않고 **텍스트 노드 그대로** 둔다. 줄은 예전처럼
 * 공백에서만 꺾이고, 어절 안의 글자만 각자 움직인다. 공백 자리도 계획(exitPlan)에는
 * 들어 있어 어절 안 글자의 지연이 원문의 자리와 어긋나지 않는다.
 */
export function MonologueExitText({
  text,
  act,
  spreadMs,
}: {
  text: string;
  act: Act;
  /** 첫 글자와 마지막 글자의 시작 시각 차이(ms). 게임은 EXIT_SPREAD_MS. */
  spreadMs: number;
}) {
  const direction = exitDirection(act);
  const words = useMemo(() => groupWords(exitPlan(text, act, spreadMs)), [text, act, spreadMs]);

  return (
    <>
      {words.map((word, wordIndex) =>
        word.kind === "space" ? (
          word.text
        ) : (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: 물러나는 동안 본문은 얼려 있어 자리가 곧 정체다.
            key={wordIndex}
            className="whitespace-nowrap"
          >
            {word.chars.map((entry, charIndex) => (
              <span
                // biome-ignore lint/suspicious/noArrayIndexKey: 같은 이유. 같은 글자가 반복되면 인덱스 말고 구분할 값이 없다.
                key={charIndex}
                className={`inline-block monologue-exit-${direction}`}
                style={{ animationDelay: `${Math.round(entry.delayMs)}ms` }}
              >
                {entry.char}
              </span>
            ))}
          </span>
        ),
      )}
    </>
  );
}

type WordRun = { kind: "space"; text: string } | { kind: "word"; chars: readonly ExitChar[] };

/** 계획을 어절(공백 아닌 글자의 연속)과 공백 덩어리로 나눈다. 공백은 지연을 버리고 글자만 남긴다. */
function groupWords(plan: readonly ExitChar[]): WordRun[] {
  const runs: WordRun[] = [];
  for (const entry of plan) {
    const isSpace = /\s/u.test(entry.char);
    const last = runs[runs.length - 1];
    if (isSpace) {
      if (last?.kind === "space")
        runs[runs.length - 1] = { kind: "space", text: last.text + entry.char };
      else runs.push({ kind: "space", text: entry.char });
    } else if (last?.kind === "word") {
      runs[runs.length - 1] = { kind: "word", chars: [...last.chars, entry] };
    } else {
      runs.push({ kind: "word", chars: [entry] });
    }
  }
  return runs;
}
