"use client";

import { type ComponentPropsWithoutRef, useLayoutEffect, useRef } from "react";
import { prefersReducedMotion } from "@/lib/reduced-motion";

/** 유령이 사라지는 데 걸리는 시간(ms). globals.css의 .exit-ghost와 같아야 한다. */
const EXIT_MS = 200;

/**
 * 언마운트될 때 제 모습을 잠깐 남기고 사라지는 층.
 *
 * React는 상태가 바뀌면 DOM을 그 자리에서 뗀다. 퇴장 애니메이션을 주려면 상태를
 * 붙들고 있어야 하는데, 미니게임 판처럼 안에 살아 있는 것이 많은 층은 붙들어 두는
 * 쪽이 더 위험하다 (끝난 판이 200ms 더 돌며 결과를 다시 보고할 수 있다).
 *
 * 대신 떼이는 순간 DOM을 통째로 복제해 옆에 세우고(.exit-ghost) 그 유령이 사라진다.
 * 복제본에는 핸들러가 없고 inert라 아무것도 누를 수 없다. 스크린 리더에도 없는 셈이다.
 * 진짜는 즉시 떼이므로 상태 흐름은 그대로다.
 *
 * 레이아웃 이펙트의 정리에서 복제한다. 그 시점에는 노드가 아직 부모에 붙어 있다.
 * useEffect의 정리는 노드가 떼인 뒤라 부모를 모른다.
 */
export function ExitFade({ children, ...props }: ComponentPropsWithoutRef<"div">) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    return () => {
      const parent = node.parentNode;
      if (!parent || prefersReducedMotion()) return;
      const ghost = node.cloneNode(true) as HTMLElement;
      ghost.inert = true;
      ghost.setAttribute("aria-hidden", "true");
      ghost.classList.add("exit-ghost");
      parent.insertBefore(ghost, node.nextSibling);
      const done = () => ghost.remove();
      ghost.addEventListener("animationend", done, { once: true });
      // 애니메이션이 못 돌아도(탭이 숨어 있음) 유령이 남지 않게 한다
      window.setTimeout(done, EXIT_MS + 100);
    };
  }, []);

  return (
    <div ref={ref} {...props}>
      {children}
    </div>
  );
}
