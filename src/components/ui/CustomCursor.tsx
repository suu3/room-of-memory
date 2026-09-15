"use client";

import { useEffect, useRef, useState } from "react";
import { usePointerKind } from "@/i18n/control-hint";
import { cursorTarget } from "@/scenes/memory-room/cursor-target";
import { damp, type MagnetRect, RING_SIZE, ringGoal } from "./cursor-ring";

/** 점이 손을 따라붙는 속도와 링이 따라붙는 속도(1/초). 링이 늦어야 무게가 읽힌다. */
const DOT_LAMBDA = 30;
const RING_LAMBDA = 14;
/** 링이 버튼에 붙거나 오브젝트로 빨려드는 속도. 따라오는 것보다 조금 빠르다 */
const MORPH_LAMBDA = 18;

/**
 * 링이 붙는 DOM. 화면 전체를 덮는 대사 넘기기 버튼은 뺀다. 거기 붙으면 링이 화면이 된다.
 * 3D 쪽은 cursor-target이 말한다.
 */
const TOUCHABLE_SELECTOR =
  "button:not([data-dialogue-advance]), a, [role='button'], [role='option'], [role='tab'], summary, input, select, textarea";

/** 화면 밖에 두는 자리. 첫 mousemove 전에 (0,0)에 점이 서 있으면 안 된다. */
const OFFSCREEN = -100;

/** 버튼의 모서리 라운드(px). 링이 그 라운드를 이어받아 감싼다. */
function cornerRadius(element: Element): number {
  const radius = Number.parseFloat(getComputedStyle(element).borderTopLeftRadius);
  return Number.isFinite(radius) ? radius : 0;
}

/**
 * 마우스를 따라오는 점과 그 뒤를 늦게 따라오는 링.
 *
 * 네이티브 커서를 숨기고(.custom-cursor) 점이 그 자리를 맡는다. 링은 조금 늦게 따라와
 * 손의 속도를 그린다. 만질 수 있는 것 위에서는 두 가지로 반응한다 (cursor-ring.ts).
 * - DOM 버튼: 링이 버튼을 감싸는 알약으로 늘어나 붙는다.
 * - 3D 오브젝트: 링이 물건 가운데로 빨려들며 사라지고, 그 순간 물건의 윤곽선이
 *   한 번 밝아진다 (MemoryOutlineGlow). 커서가 물건의 빛으로 옮겨 간 그림이다.
 * 커서가 곧 "여기 만질 수 있다"는 신호라, 3D 오브젝트의 호버(useGlowHover)와 DOM
 * 버튼이 같은 언어로 말하게 된다.
 *
 * 마우스에서만 산다. 손가락에는 커서가 없고, 모션을 끈 사람에게는 뒤늦게 따라오는
 * 링이 곧 어지러움이라 네이티브 커서를 그대로 둔다. 자리는 프레임마다 ref로 직접
 * 옮긴다. 상태로 굴리면 mousemove마다 리렌더다.
 */
export function CustomCursor() {
  const pointerKind = usePointerKind();
  const [active, setActive] = useState(false);
  const dotRef = useRef<HTMLSpanElement>(null);
  const ringRef = useRef<HTMLSpanElement>(null);

  // 첫 마우스 이동에서 켠다. 마우스가 붙은 태블릿은 hover 미디어 쿼리로는 못 가른다
  useEffect(() => {
    if (pointerKind !== "keys") {
      setActive(false);
      return;
    }
    if (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const onMove = (event: PointerEvent) => {
      if (event.pointerType === "mouse") setActive(true);
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [pointerKind]);

  useEffect(() => {
    if (!active) return;
    const root = document.documentElement;
    root.classList.add("custom-cursor");

    const pointer = { x: OFFSCREEN, y: OFFSCREEN, shown: false, down: false };
    const dot = { x: OFFSCREEN, y: OFFSCREEN };
    const ring = {
      x: OFFSCREEN,
      y: OFFSCREEN,
      width: RING_SIZE,
      height: RING_SIZE,
      radius: RING_SIZE / 2,
      scale: 1,
    };
    /** 링이 붙을 DOM 버튼과 그 라운드. 사각형은 프레임마다 새로 잰다 (스크롤·리사이즈). */
    let magnet: { element: Element; radius: number } | null = null;

    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") {
        // 손가락이 끼어들면 점을 치운다. 손가락 아래 점이 남아 있으면 커서가 멈춘 것으로 보인다
        pointer.shown = false;
        return;
      }
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.shown = true;
      const target = event.target as Element | null;
      const touchable = target?.closest?.(TOUCHABLE_SELECTOR) ?? null;
      if (touchable === null) magnet = null;
      else if (magnet?.element !== touchable) {
        magnet = { element: touchable, radius: cornerRadius(touchable) };
      }
    };
    const onLeave = () => {
      pointer.shown = false;
    };
    const onDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse") pointer.down = true;
    };
    const onUp = () => {
      pointer.down = false;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    document.addEventListener("pointerleave", onLeave);
    window.addEventListener("blur", onLeave);

    let frame = 0;
    let last: number | null = null;
    const tick = (now: number) => {
      frame = window.requestAnimationFrame(tick);
      /*
       * 첫 프레임은 0으로 친다. rAF의 시각은 프레임의 시작이라 그 전에 읽은
       * performance.now()보다 앞설 수 있고, 음수 delta는 감쇠식을 발산시킨다
       * (exp의 부호가 뒤집혀 점이 화면 밖 10^15px로 날아갔다). 탭이 숨었다 돌아오는
       * 긴 공백은 0.1초로 자른다.
       */
      const delta = last === null ? 0 : Math.min(0.1, Math.max(0, (now - last) / 1000));
      last = now;
      const dotEl = dotRef.current;
      const ringEl = ringRef.current;
      if (!dotEl || !ringEl) return;
      dot.x = damp(dot.x, pointer.x, DOT_LAMBDA, delta);
      dot.y = damp(dot.y, pointer.y, DOT_LAMBDA, delta);

      // 붙을 버튼이 사라졌으면(패널이 닫힘) 놓는다
      if (magnet && !magnet.element.isConnected) magnet = null;
      // DOMRect는 getter라 스프레드로 복사되지 않는다. 필드를 하나씩 옮긴다
      const rect = magnet?.element.getBoundingClientRect();
      const magnetRect: MagnetRect | null =
        magnet && rect
          ? {
              left: rect.left,
              top: rect.top,
              width: rect.width,
              height: rect.height,
              radius: magnet.radius,
            }
          : null;
      const absorb = cursorTarget.object ? cursorTarget.screen : null;
      const goal = ringGoal(pointer, magnetRect, absorb);
      // 자리는 손을 늦게 따라오고, 붙거나 빨려드는 모양은 그보다 조금 빠르다
      const lambda = magnetRect || absorb ? MORPH_LAMBDA : RING_LAMBDA;
      ring.x = damp(ring.x, goal.x, lambda, delta);
      ring.y = damp(ring.y, goal.y, lambda, delta);
      ring.width = damp(ring.width, goal.width, MORPH_LAMBDA, delta);
      ring.height = damp(ring.height, goal.height, MORPH_LAMBDA, delta);
      ring.radius = damp(ring.radius, goal.radius, MORPH_LAMBDA, delta);
      ring.scale = damp(ring.scale, goal.scale, MORPH_LAMBDA, delta);

      dotEl.style.transform = `translate3d(${dot.x}px, ${dot.y}px, 0)`;
      ringEl.style.transform = `translate3d(${ring.x - ring.width / 2}px, ${ring.y - ring.height / 2}px, 0) scale(${ring.scale})`;
      ringEl.style.width = `${ring.width}px`;
      ringEl.style.height = `${ring.height}px`;
      ringEl.style.borderRadius = `${ring.radius}px`;
      dotEl.dataset.shown = ringEl.dataset.shown = String(pointer.shown);
      ringEl.dataset.hot = String(magnetRect !== null || absorb !== null);
      ringEl.dataset.down = String(pointer.down);
    };
    frame = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      document.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("blur", onLeave);
      root.classList.remove("custom-cursor");
    };
  }, [active]);

  if (!active) return null;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[70]">
      <span ref={dotRef} className="cursor-dot" />
      <span ref={ringRef} className="cursor-ring" />
    </div>
  );
}
