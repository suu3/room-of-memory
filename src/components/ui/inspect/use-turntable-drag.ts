"use client";

import { type PointerEvent as ReactPointerEvent, useCallback, useMemo, useRef } from "react";

/** 화면 가로폭 대비 회전량: 창 하나를 가로지르면 한 바퀴 조금 넘게 돈다. */
const DRAG_TO_RADIANS = 0.011;
/**
 * 버튼 한 번에 도는 각. 30°씩이면 마우스 없이도 뒤쪽까지 여섯 번이면 닿는다. 15°였을 때는
 * 문제집 뒤표지(±37° 안에 들어와야 읽힌다)까지 열 번을 눌러야 했다 (2026-10-02 QA).
 */
export const TURN_STEP = Math.PI / 6;

/**
 * 끌어서 돌려보는 물건(수첩의 캐릭터 모델, 집어 든 문제집)의 손잡이.
 *
 * 각도는 state가 아니라 ref다. 드래그마다 리렌더되면 Canvas가 통째로 다시 그려진다
 * (.claude/rules/r3f.md의 "useFrame에서 setState 금지"와 같은 이유). Canvas 안의
 * 컴포넌트가 useFrame에서 yawRef를 읽어 그룹을 돌린다.
 *
 * `handlers`는 Canvas를 감싼 DOM 상자에 얹는다. 키보드에는 같은 일을 하는 `turn`을
 * 버튼으로 준다: 끄는 건 마우스·손가락의 몫이라서.
 */
export function useTurntableDrag() {
  const yawRef = useRef(0);
  /**
   * 세로로 끈 거리(px, 아래가 양수). 회전이 아니라 옮기기가 필요한 쪽(확대한 문제집)이
   * 읽고, 범위를 벗어나면 제 손으로 되돌려 쓴다. 안 쓰는 쪽은 그냥 쌓이게 둔다.
   */
  const dragYRef = useRef(0);
  /** 마지막으로 손댄 시각(ms). 0이면 아직 아무도 안 만졌다. 저 혼자 도는 쪽이 본다. */
  const touchedAtRef = useRef(0);
  const dragRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
    from: number;
    fromY: number;
  } | null>(null);

  const turn = useCallback((delta: number) => {
    yawRef.current += delta;
    touchedAtRef.current = Date.now();
  }, []);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      from: yawRef.current,
      fromY: dragYRef.current,
    };
    touchedAtRef.current = Date.now();
  }, []);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    yawRef.current = drag.from + (event.clientX - drag.x) * DRAG_TO_RADIANS;
    dragYRef.current = drag.fromY + (event.clientY - drag.y);
    touchedAtRef.current = Date.now();
  }, []);

  const endDrag = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    touchedAtRef.current = Date.now();
  }, []);

  const handlers = useMemo(
    () => ({ onPointerDown, onPointerMove, onPointerUp: endDrag, onPointerCancel: endDrag }),
    [onPointerDown, onPointerMove, endDrag],
  );

  return { yawRef, dragYRef, touchedAtRef, turn, handlers };
}
