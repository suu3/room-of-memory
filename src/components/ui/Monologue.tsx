"use client";

import { useTranslation } from "react-i18next";
import type { StageId } from "@/data/memory-room";
import { useTypewriter } from "@/lib/use-typewriter";

/**
 * 화면 상단 혼잣말.
 *
 * 타자 연출을 살리려면 훅이 **보이는 시점에** 마운트되어야 한다. 부모(MemoryRoom)
 * 최상단에서 호출하면 타이틀 화면이 떠 있는 동안 보이지도 않는 채로 다 찍혀서,
 * 방에 들어왔을 땐 이미 완성된 문장만 남는다. 그래서 별도 컴포넌트로 떼어냈다.
 */
export function Monologue({ stageId }: { stageId: StageId }) {
  const { t: tRoom } = useTranslation("memoryRoom");
  const monologue = useTypewriter(tRoom(`stages.${stageId}.monologue`));

  return (
    <div className="pointer-events-none absolute left-1/2 top-32 z-10 w-full max-w-2xl -translate-x-1/2 px-4 text-center md:top-16">
      <p className="animate-fade-rise font-pixel text-2xl text-fog">「 {monologue} 」</p>
    </div>
  );
}
