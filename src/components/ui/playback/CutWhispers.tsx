"use client";

import type { ParseKeys } from "i18next";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

/** 속말 한 줄이 떠 있는 시간(ms). 떠오르는 페이드를 포함한다. */
export const WHISPER_SHOW_MS = 2600;
/** 가라앉는 페이드(ms). 아래 duration-700과 같다. */
const WHISPER_FADE_MS = 700;
/** 한 줄이 다 가라앉고 다음 줄이 뜨기까지 비는 틈(ms). */
const WHISPER_GAP_MS = 500;

/**
 * 컷 위의 속말 (CutsceneCut.whisperKeys). 화면 위 혼잣말 자리에 한 줄씩 떠올랐다
 * 가라앉기를 컷이 끝날 때까지 되풀이한다. 라디오 재난 방송이 대사창에 흐르는 동안
 * 도해가 속으로 "…듣고 싶지 않아.", "그만해…"를 되뇐다.
 *
 * 자리·글자는 방의 혼잣말(Monologue)과 같다: 같은 사람의 속말이라서다. 컷씬 판(z-40)이
 * 방의 혼잣말을 덮고 있으므로 판 안에 따로 세운다. 줄들을 한 칸에 겹쳐 두고 불투명도만
 * 넘겨서, 바뀌는 사이에 판이 출렁이지 않는다.
 */
export function CutWhispers({ keys }: { keys: string[] }) {
  const { t: tRoom } = useTranslation("memoryRoom");
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: index는 본문에서 읽지 않고 "다음 줄로 넘어갔다"는 신호로만 쓴다. 줄마다 시계를 다시 건다.
  useEffect(() => {
    // 첫 줄도 페이드로 들어오게 한 박자 뒤에 켠다
    const show = window.setTimeout(() => setVisible(true), 50);
    const hide = window.setTimeout(() => setVisible(false), WHISPER_SHOW_MS);
    const next = window.setTimeout(
      () => setIndex((value) => (value + 1) % keys.length),
      WHISPER_SHOW_MS + WHISPER_FADE_MS + WHISPER_GAP_MS,
    );
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
      window.clearTimeout(next);
    };
  }, [index, keys.length]);

  return (
    <div
      className="pointer-events-none absolute left-1/2 top-32 z-10 grid w-[min(clamp(640px,44vw,840px),calc(100vw-32px))] -translate-x-1/2 text-center md:top-28 lg:top-16"
      aria-hidden
    >
      {keys.map((key, at) => (
        <p
          key={key}
          className={`monologue-text col-start-1 row-start-1 whitespace-pre-line break-ko text-pretty font-pixel text-monologue leading-normal text-ivory transition-opacity duration-700 ${
            at === index && visible ? "opacity-100" : "opacity-0"
          }`}
        >
          {tRoom(key as ParseKeys<"memoryRoom">)}
        </p>
      ))}
    </div>
  );
}
