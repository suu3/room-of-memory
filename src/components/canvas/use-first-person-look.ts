"use client";

import { type MutableRefObject, type RefObject, useEffect } from "react";
import {
  handleLookKeyDown,
  type LookAngles,
  lookFromDrag,
  touchLookSensitivity,
} from "@/scenes/memory-room/camera/first-person";
import { isInteractiveTarget, ORBIT_DRAG_THRESHOLD } from "./room-canvas-runtime";

/**
 * 1인칭 구간의 시선 입력: 화면을 끌면 둘러보고, `,`/`.`로 좌우로 돈다.
 *
 * 아이소메트릭의 회전 드래그와 같은 자리(캔버스를 감싼 컨테이너)에서 듣되, 둘이 동시에
 * 켜지지 않는다 (RoomCanvas가 1인칭 동안 회전·배율 입력을 잠근다). 임계값을 넘긴 끌기는
 * 뒤따르는 click을 캡처 단계에서 삼켜 물건이 잘못 눌리지 않게 한다. 회전 드래그와 같은
 * 규칙이다. 버튼·조이스틱 위에서 시작한 끌기는 시선을 돌리지 않는다.
 *
 * 값은 ref에 쓴다. 프레임마다 카메라(FirstPersonRig)가 읽는다. 상태로 두면 끌 때마다
 * 캔버스가 리렌더된다.
 */
export function useFirstPersonLook(
  containerRef: RefObject<HTMLElement | null>,
  enabled: boolean,
  lookRef: MutableRefObject<LookAngles>,
) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !enabled) return;

    /*
     * 손가락 끌기를 브라우저가 가져가지 못하게 한다. touch-action이 기본값이면 브라우저가
     * 끌기를 제 몸짓(스크롤·확대)으로 보고 첫 몇 픽셀 만에 pointercancel을 보낸다: 폰에서
     * 300px을 쓸어도 20px만큼만 돌았다. 1인칭 동안만 막고 끝나면 되돌린다. 아이소메트릭의
     * 바닥 탭·핀치는 건드리지 않는다.
     */
    const previousTouchAction = container.style.touchAction;
    container.style.touchAction = "none";

    let drag: {
      pointerId: number;
      x: number;
      y: number;
      start: LookAngles;
      yawSensitivity: number | undefined;
    } | null = null;
    let swallowClick = false;
    const handlePointerDown = (event: PointerEvent) => {
      if (drag !== null || event.button !== 0 || isInteractiveTarget(event.target)) {
        drag = null;
        return;
      }
      drag = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        start: { yaw: lookRef.current.yaw, pitch: lookRef.current.pitch },
        // 손가락은 화면 폭으로 잰다: 폭을 두 번 쓸면 한 바퀴 (touchLookSensitivity)
        yawSensitivity:
          event.pointerType === "touch" ? touchLookSensitivity(container.clientWidth) : undefined,
      };
    };
    const handlePointerMove = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (!swallowClick && Math.hypot(dx, dy) < ORBIT_DRAG_THRESHOLD) return;
      swallowClick = true;
      lookFromDrag(drag.start, dx, dy, lookRef.current, drag.yawSensitivity);
    };
    const endDrag = (event: PointerEvent) => {
      if (drag && event.pointerId !== drag.pointerId) return;
      drag = null;
    };
    const handleClickCapture = (event: MouseEvent) => {
      if (!swallowClick) return;
      swallowClick = false;
      event.stopPropagation();
      event.preventDefault();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      handleLookKeyDown(event, {
        locked: false,
        look: lookRef.current,
        apply: (next) => {
          lookRef.current.yaw = next.yaw;
          lookRef.current.pitch = next.pitch;
        },
        isInteractiveTarget,
      });
    };

    container.addEventListener("pointerdown", handlePointerDown);
    container.addEventListener("pointermove", handlePointerMove);
    container.addEventListener("pointerup", endDrag);
    container.addEventListener("pointercancel", endDrag);
    container.addEventListener("click", handleClickCapture, { capture: true });
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      container.style.touchAction = previousTouchAction;
      container.removeEventListener("pointerdown", handlePointerDown);
      container.removeEventListener("pointermove", handlePointerMove);
      container.removeEventListener("pointerup", endDrag);
      container.removeEventListener("pointercancel", endDrag);
      container.removeEventListener("click", handleClickCapture, { capture: true });
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [containerRef, enabled, lookRef]);
}
