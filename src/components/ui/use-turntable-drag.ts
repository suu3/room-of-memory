"use client";

import { type PointerEvent as ReactPointerEvent, useCallback, useMemo, useRef } from "react";

/** 화면 가로폭 대비 회전량: 창 하나를 가로지르면 한 바퀴 조금 넘게 돈다. */
const DRAG_TO_RADIANS = 0.011;
/** 버튼 한 번에 도는 각. 15°씩이면 마우스 없이도 뒤통수까지 열두 번이면 닿는다. */
export const TURN_STEP = Math.PI / 12;

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
  /** 마지막으로 손댄 시각(ms). 0이면 아직 아무도 안 만졌다. 저 혼자 도는 쪽이 본다. */
  const touchedAtRef = useRef(0);
  const dragRef = useRef<{ pointerId: number; x: number; from: number } | null>(null);

  const turn = useCallback((delta: number) => {
    yawRef.current += delta;
    touchedAtRef.current = Date.now();
  }, []);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, from: yawRef.current };
    touchedAtRef.current = Date.now();
  }, []);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    yawRef.current = drag.from + (event.clientX - drag.x) * DRAG_TO_RADIANS;
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

  return { yawRef, touchedAtRef, turn, handlers };
}
