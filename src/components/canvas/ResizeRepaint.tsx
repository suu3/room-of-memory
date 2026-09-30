"use client";

import { advance, useStore } from "@react-three/fiber";
import { useEffect } from "react";

/**
 * 캔버스 크기·배율이 바뀐 직후 한 장을 바로 그린다.
 *
 * r3f는 크기나 배율이 바뀌면 스토어 구독에서 gl.setSize를 부르고 다음 프레임을 **예약만**
 * 한다. 그 사이에 브라우저가 화면을 합성하면 새로 잡힌 캔버스 버퍼는 비어 있어, 캔버스
 * 뒤의 어둠이 한 프레임 비친다. 폰에서 화면 전체가 검게 깜빡이던 것이 이것이다: 성능
 * 감시가 배율 상한을 내리는 순간, 뷰포트 높이(dvh)가 흔들리는 순간.
 *
 * r3f의 구독이 먼저 등록돼 있어(루트를 만들 때) 이 구독이 돌 때는 버퍼가 이미 새 크기다.
 * 여기서 곧장 advance로 한 장을 그리면 합성 전에 캔버스가 차 있다. 그리지 않는 구간
 * (frameloop never)은 건드리지 않는다: 그때는 영상이 방을 덮고 있어 캔버스가 안 보인다.
 */
export function ResizeRepaint() {
  const store = useStore();

  useEffect(() => {
    const initial = store.getState();
    let width = initial.size.width;
    let height = initial.size.height;
    let dpr = initial.viewport.dpr;

    return store.subscribe((state) => {
      const resized =
        state.size.width !== width || state.size.height !== height || state.viewport.dpr !== dpr;
      if (!resized) return;
      width = state.size.width;
      height = state.size.height;
      dpr = state.viewport.dpr;
      if (state.frameloop === "never" || !state.internal.active) return;
      advance(performance.now(), true, state);
    });
  }, [store]);

  return null;
}
