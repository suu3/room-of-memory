"use client";

import { useProgress } from "@react-three/drei";
import { useEffect } from "react";
import { useMemoryRoomStore } from "@/store/memory-room";
import { roomLoadFraction } from "./room-load";

/**
 * 모델이 얼마나 들어왔는지를 스토어에 흘려보낸다. 아무것도 그리지 않는다.
 *
 * 진행률을 읽는 쪽은 타이틀 화면(Canvas 밖 DOM)이고 아는 쪽은 three의 로딩
 * 매니저(Canvas 청크 안)라, 둘을 잇는 자리가 필요하다. 이 컴포넌트가 캔버스
 * 청크에 사는 이유이기도 하다 — drei를 타이틀 화면에서 import하면 three가
 * 초기 번들로 딸려 들어와, 정작 빨리 떠야 할 화면이 늦어진다.
 */
export function RoomLoadReporter({ failed }: { failed: boolean }) {
  const { loaded, total, active } = useProgress();
  const setRoomLoadProgress = useMemoryRoomStore((state) => state.setRoomLoadProgress);

  useEffect(() => {
    // WebGL이 안 서는 기기에서는 모델을 하나도 안 받는다 — 기다릴 것이 없으니
    // 바로 채워 준다. 안 그러면 대체 화면 위에서 시작 버튼이 영영 안 열린다.
    setRoomLoadProgress(failed ? 1 : roomLoadFraction({ loaded, total, active }));
  }, [failed, loaded, total, active, setRoomLoadProgress]);

  return null;
}
