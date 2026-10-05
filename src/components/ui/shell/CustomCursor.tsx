"use client";

import { useEffect, useRef, useState } from "react";
import { usePointerKind } from "@/i18n/control-hint";
import { cursorTarget } from "@/scenes/memory-room/camera/cursor-target";
import { bracketGoal, damp } from "./cursor-brackets";

/**
 * 꺾쇠가 물건을 감싸거나 손 자리로 모이는 속도(1/초). 점은 손에 바로 붙는다. 점까지
 * 늦으면 커서 자체가 굼뜨게 느껴진다. 꺾쇠만 살짝 늦어 "착" 하고 자리를 잡는다.
 */
const BRACKET_LAMBDA = 22;

/** 꺾쇠 넷. 순서가 곧 모서리다: 왼쪽 위, 오른쪽 위, 왼쪽 아래, 오른쪽 아래 */
const CORNERS = ["tl", "tr", "bl", "br"] as const;

/**
 * 점이 금빛이 되는 DOM. 화면 전체를 덮는 대사 넘기기 버튼은 뺀다. 화면 어디서나 금빛이 된다.
 * 3D 쪽은 cursor-target이 말한다.
 */
const TOUCHABLE_SELECTOR =
  "button:not([data-dialogue-advance]), a, [role='button'], [role='option'], [role='tab'], summary, input, select, textarea";

/** 화면 밖에 두는 자리. 첫 mousemove 전에 (0,0)에 점이 서 있으면 안 된다. */
const OFFSCREEN = -100;

/**
 * 마우스를 따라오는 점 하나와, 만질 수 있는 물건을 감싸는 네 모서리 꺾쇠.
 *
 * 네이티브 커서를 숨기고(.custom-cursor) 점이 그 자리를 맡는다. 평소에는 점뿐이다.
 * 만질 수 있는 것 위에서는 두 가지로 반응한다 (cursor-brackets.ts).
 * - DOM 버튼: 점이 금빛이 된다. 버튼을 감싸지는 않는다.
 * - 3D 오브젝트: 금빛 꺾쇠 넷이 손 자리에서 벌어져 물건을 감싸고, 그 순간 물건의
 *   윤곽선이 한 번 밝아진다 (MemoryOutlineGlow). 꺾쇠가 "어디"를, 윤곽선이 "무엇"을 말한다.
 *
 * 마우스에서만 산다. 손가락에는 커서가 없고, 모션을 끈 사람에게는 벌어졌다 모이는
 * 꺾쇠가 곧 어지러움이라 네이티브 커서를 그대로 둔다. 자리는 프레임마다 ref로 직접
 * 옮긴다. 상태로 굴리면 mousemove마다 리렌더다.
 */
export function CustomCursor() {
  const pointerKind = usePointerKind();
  const [active, setActive] = useState(false);
  const dotRef = useRef<HTMLSpanElement>(null);
  const hotDotRef = useRef<HTMLSpanElement>(null);
  const bracketRefs = useRef<(HTMLSpanElement | null)[]>([]);
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
    const box = { left: OFFSCREEN, top: OFFSCREEN, right: OFFSCREEN, bottom: OFFSCREEN };
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
      const hotDotEl = hotDotRef.current;
      if (!dotEl || !hotDotEl) return;

      if (touchable && !touchable.isConnected) touchable = null;
      const target = cursorTarget.object ? cursorTarget.screen : null;
      const hot = touchable !== null || cursorTarget.object !== null;
      const goal = bracketGoal(pointer, target, pointer.down, {
        width: window.innerWidth,
        height: window.innerHeight,
      });
      box.left = damp(box.left, goal.left, BRACKET_LAMBDA, delta);
      box.top = damp(box.top, goal.top, BRACKET_LAMBDA, delta);
      box.right = damp(box.right, goal.right, BRACKET_LAMBDA, delta);
      box.bottom = damp(box.bottom, goal.bottom, BRACKET_LAMBDA, delta);

      const at = `translate3d(${pointer.x}px, ${pointer.y}px, 0)`;
      dotEl.style.transform = hotDotEl.style.transform = at;
      dotEl.dataset.shown = hotDotEl.dataset.shown = String(pointer.shown);
      dotEl.dataset.hot = hotDotEl.dataset.hot = String(hot);
      const live = String(pointer.shown && target !== null);
      bracketRefs.current.forEach((el, index) => {
        if (!el) return;
        const x = index % 2 === 0 ? box.left : box.right;
        const y = index < 2 ? box.top : box.bottom;
        el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        el.dataset.live = live;
      });
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
  // 평소의 점은 층 자체가 difference로 섞인다. z-index를 가진 층은 쌓임 맥락이라 안쪽 요소의
  // 블렌드는 층 밖(페이지)에 닿지 않는다. 그러면 상아색 점이 수첩 종이(거의 같은 색) 위에서
  // 사라졌다. 파문·꺾쇠·금빛 점은 금빛 그대로 보여야 해서 따로 둔다
  return (
    <>
      <div aria-hidden className="pointer-events-none fixed inset-0 z-[100000]">
        <span ref={rippleRef} className="cursor-ripple" />
        {CORNERS.map((corner, index) => (
          <span
            key={corner}
            ref={(el) => {
              bracketRefs.current[index] = el;
            }}
            className="cursor-bracket"
            data-corner={corner}
          />
        ))}
        <span ref={hotDotRef} className="cursor-dot-hot" />
      </div>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[100000] mix-blend-difference"
      >
        <span ref={dotRef} className="cursor-dot" />
      </div>
    </>
  );
}
