"use client";

import { useEffect, useRef, useState } from "react";
import { usePointerKind } from "@/i18n/control-hint";

/** 점이 손을 따라붙는 속도와 링이 따라붙는 속도(1/초). 링이 늦어야 무게가 읽힌다. */
const DOT_LAMBDA = 30;
const RING_LAMBDA = 14;

/** 만질 수 있는 DOM. 3D 쪽은 useGlowHover가 body의 인라인 cursor로 말한다. */
const TOUCHABLE_SELECTOR =
  "button, a, [role='button'], [role='option'], [role='tab'], summary, input, select, textarea, label";

/** 화면 밖에 두는 자리. 첫 mousemove 전에 (0,0)에 점이 서 있으면 안 된다. */
const OFFSCREEN = -100;

/**
 * 마우스를 따라오는 점과 그 뒤를 늦게 따라오는 링.
 *
 * 네이티브 커서를 숨기고(.custom-cursor) 점이 그 자리를 맡는다. 링은 조금 늦게 따라와
 * 손의 속도를 그리고, 만질 수 있는 것(버튼·빛나는 물건) 위에서는 금빛으로 벌어진다.
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

    const pointer = { x: OFFSCREEN, y: OFFSCREEN, shown: false, hot: false, down: false };
    const dot = { x: OFFSCREEN, y: OFFSCREEN };
    const ring = { x: OFFSCREEN, y: OFFSCREEN };

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
      pointer.hot = target?.closest?.(TOUCHABLE_SELECTOR) !== null && target !== null;
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
    let last = performance.now();
    const tick = (now: number) => {
      frame = window.requestAnimationFrame(tick);
      const delta = Math.min(0.1, (now - last) / 1000);
      last = now;
      const dotEl = dotRef.current;
      const ringEl = ringRef.current;
      if (!dotEl || !ringEl) return;
      const follow = (from: number, to: number, lambda: number) =>
        from + (to - from) * (1 - Math.exp(-lambda * delta));
      dot.x = follow(dot.x, pointer.x, DOT_LAMBDA);
      dot.y = follow(dot.y, pointer.y, DOT_LAMBDA);
      ring.x = follow(ring.x, pointer.x, RING_LAMBDA);
      ring.y = follow(ring.y, pointer.y, RING_LAMBDA);
      dotEl.style.transform = `translate3d(${dot.x}px, ${dot.y}px, 0)`;
      ringEl.style.transform = `translate3d(${ring.x}px, ${ring.y}px, 0)`;
      // 3D 오브젝트 위에서는 useGlowHover가 body에 pointer를 써 둔다
      const hot = pointer.hot || document.body.style.cursor === "pointer";
      dotEl.dataset.shown = ringEl.dataset.shown = String(pointer.shown);
      ringEl.dataset.hot = String(hot);
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
