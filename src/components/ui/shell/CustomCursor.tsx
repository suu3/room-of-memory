"use client";

import { useEffect, useRef, useState } from "react";
import { usePointerKind } from "@/i18n/control-hint";
import { cursorTarget } from "@/scenes/memory-room/camera/cursor-target";
import { damp, RING_SIZE, ringGoal } from "./cursor-ring";

/**
 * 링이 따라붙는 속도(1/초). 점은 손에 바로 붙는다. 점까지 늦으면 커서 자체가 굼뜨게
 * 느껴진다. 링만 살짝 늦어 손의 속도를 그린다.
 */
const RING_LAMBDA = 32;
/** 링이 조여들거나 오브젝트로 빨려드는 속도 */
const MORPH_LAMBDA = 26;

/**
 * 링이 조여드는 DOM. 화면 전체를 덮는 대사 넘기기 버튼은 뺀다. 화면 어디서나 조여 있게 된다.
 * 3D 쪽은 cursor-target이 말한다.
 */
const TOUCHABLE_SELECTOR =
  "button:not([data-dialogue-advance]), a, [role='button'], [role='option'], [role='tab'], summary, input, select, textarea";

/** 화면 밖에 두는 자리. 첫 mousemove 전에 (0,0)에 점이 서 있으면 안 된다. */
const OFFSCREEN = -100;

/**
 * 마우스를 따라오는 점과 그 뒤를 늦게 따라오는 링.
 *
 * 네이티브 커서를 숨기고(.custom-cursor) 점이 그 자리를 맡는다. 링은 조금 늦게 따라와
 * 손의 속도를 그린다. 만질 수 있는 것 위에서는 두 가지로 반응한다 (cursor-ring.ts).
 * - DOM 버튼: 링이 손 자리에서 금빛으로 조여든다. 버튼을 감싸지는 않는다.
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
  const rippleRef = useRef<HTMLSpanElement>(null);

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
    const ring = { x: OFFSCREEN, y: OFFSCREEN, scale: 1 };
    /** 손이 얹힌 만질 수 있는 DOM. 패널이 닫혀 사라지면 놓는다 */
    let touchable: Element | null = null;

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
      touchable = target?.closest?.(TOUCHABLE_SELECTOR) ?? null;
    };
    const onLeave = () => {
      pointer.shown = false;
    };
    const onDown = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      pointer.down = true;
      // 누른 자리에서 파문 하나. 클래스를 뗐다 붙여야 연타에도 매번 다시 돈다
      const ripple = rippleRef.current;
      if (!ripple) return;
      ripple.style.setProperty("--ripple-x", `${event.clientX}px`);
      ripple.style.setProperty("--ripple-y", `${event.clientY}px`);
      ripple.classList.remove("is-live");
      void ripple.offsetWidth;
      ripple.classList.add("is-live");
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

      if (touchable && !touchable.isConnected) touchable = null;
      const hot = touchable !== null;
      const absorb = cursorTarget.object ? cursorTarget.screen : null;
      const goal = ringGoal(pointer, hot, absorb);
      // 자리는 손을 늦게 따라오고, 조여들거나 빨려드는 건 그보다 조금 빠르다
      const lambda = absorb ? MORPH_LAMBDA : RING_LAMBDA;
      ring.x = damp(ring.x, goal.x, lambda, delta);
      ring.y = damp(ring.y, goal.y, lambda, delta);
      ring.scale = damp(ring.scale, goal.scale, MORPH_LAMBDA, delta);

      dotEl.style.transform = `translate3d(${pointer.x}px, ${pointer.y}px, 0)`;
      ringEl.style.transform = `translate3d(${ring.x - RING_SIZE / 2}px, ${ring.y - RING_SIZE / 2}px, 0) scale(${ring.scale})`;
      dotEl.dataset.shown = ringEl.dataset.shown = String(pointer.shown);
      ringEl.dataset.hot = String(hot || absorb !== null);
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

  // 네이티브 커서가 전부 숨어 있어서 이 층은 무엇보다 위여야 한다. 개발 패널(z-[99999])보다도.
  // 점과 링은 층 자체가 difference로 섞인다. z-index를 가진 층은 쌓임 맥락이라 안쪽 요소의
  // 블렌드는 층 밖(페이지)에 닿지 않는다. 그러면 상아색 점이 수첩 종이(거의 같은 색) 위에서
  // 사라졌다. 파문은 금빛 그대로 보여야 해서 따로 둔다
  return (
    <>
      <div aria-hidden className="pointer-events-none fixed inset-0 z-[100000]">
        <span ref={rippleRef} className="cursor-ripple" />
      </div>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[100000] mix-blend-difference"
      >
        <span ref={dotRef} className="cursor-dot" />
        <span ref={ringRef} className="cursor-ring" />
      </div>
    </>
  );
}
