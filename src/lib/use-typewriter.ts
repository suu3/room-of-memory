"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * 타자기식 글자 단위 reveal (DESIGN.md > Motion).
 * 텍스트가 바뀌면 처음부터 다시 친다. prefers-reduced-motion이면 즉시 완성.
 */
export function useTypewriter(text: string, charMs = 70): string {
  const chars = useMemo(() => Array.from(text), [text]);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setCount(chars.length);
      return;
    }
    setCount(0);
    const id = window.setInterval(() => {
      setCount((current) => {
        if (current >= chars.length) {
          window.clearInterval(id);
          return current;
        }
        return current + 1;
      });
    }, charMs);
    return () => window.clearInterval(id);
  }, [chars, charMs]);

  return chars.slice(0, count).join("");
}
