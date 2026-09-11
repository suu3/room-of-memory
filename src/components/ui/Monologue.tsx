"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { MonologueId } from "@/data/monologue";
import { useTypewriter } from "@/lib/use-typewriter";

/** 단계가 바뀔 때 옛 줄이 물러나는 시간(ms). globals.css의 transition과 맞춘다. */
const SWAP_FADE_MS = 320;

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
  /** 지금 찍고 있는 구간. monologueId가 바뀌어도 페이드가 끝난 뒤에 따라온다. */
  const [shown, setShown] = useState(monologueId);
  const [leaving, setLeaving] = useState(false);
  const monologue = useTypewriter(tRoom(`stages.${shown}.monologue`));

  useEffect(() => {
    if (monologueId === shown) return;
    setLeaving(true);
    const timer = window.setTimeout(() => {
      setShown(monologueId);
      setLeaving(false);
    }, SWAP_FADE_MS);
    return () => window.clearTimeout(timer);
  }, [monologueId, shown]);

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
      {/* 글자는 폭 따라 20→30px(--text-monologue). 좁은 화면에서 넘치면 어절 단위로 접는다 */}
      <p
        className={`monologue-text animate-fade-rise break-ko text-pretty font-pixel text-monologue leading-normal text-ivory transition-opacity duration-300 ${
          leaving ? "opacity-0" : "opacity-100"
        }`}
      >
        {monologue}
      </p>
    </div>
  );
}
