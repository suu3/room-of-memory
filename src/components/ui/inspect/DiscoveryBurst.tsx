"use client";

import { useEffect, useRef, useState } from "react";
import { playSound } from "@/lib/audio";
import { useMemoryRoomStore } from "@/store/memory-room";
import { SuccessBurst } from "../minigame/SuccessBurst";

/**
 * 단서에서 무언가를 알아낸 순간의 금빛 입자 (문제집의 이름 · 책 속 쪽지의 번호 · 소독제 병의 로고).
 *
 * 미니게임과 미궁 문제는 풀리면 입자가 뜨는데(MinigameHost · PuzzleHost) 단서는 조용히
 * 기록만 남겼다. 그래서 세면대 물을 빼고 로고를 보고도, 쪽지의 407을 보고도 "이게 찾아야
 * 하던 것인가"를 알 길이 없었다. 같은 입자를 같은 자리에 띄워 같은 말을 하게 한다.
 *
 * 단서를 펼쳐 둔 동안 늘어난 발견만 센다. 저장본을 읽어 들이거나 개발 패널이 진행을
 * 갈아 끼울 때도 목록은 늘지만, 그건 지금 알아낸 것이 아니다.
 */
export function DiscoveryBurst() {
  const count = useMemoryRoomStore((state) => state.discoveries.length);
  const seen = useRef(count);
  const [burstId, setBurstId] = useState(0);

  useEffect(() => {
    const grew = count > seen.current;
    seen.current = count;
    if (!grew || useMemoryRoomStore.getState().activeClue === null) return;
    playSound("success");
    setBurstId((id) => id + 1);
  }, [count]);

  return burstId > 0 ? <SuccessBurst key={burstId} onDone={() => setBurstId(0)} /> : null;
}
