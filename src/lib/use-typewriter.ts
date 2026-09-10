"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export interface TypewriterState {
  /** 지금까지 찍힌 부분 문자열. */
  typed: string;
  /** 전부 찍혔는지 (reduced-motion이면 처음부터 true). */
  done: boolean;
  /** 남은 글자를 즉시 채운다. 대사창 클릭 한 번으로 건너뛰기. */
  skip: () => void;
}

/**
 * 타자기식 글자 단위 reveal (DESIGN.md > Motion).
 * 텍스트가 바뀌면 처음부터 다시 친다. prefers-reduced-motion이면 즉시 완성.
 */
export function useTypewriterState(text: string, charMs = 70): TypewriterState {
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

  const skip = useCallback(() => setCount(chars.length), [chars.length]);

  return { typed: chars.slice(0, count).join(""), done: count >= chars.length, skip };
}

/** 찍히는 텍스트만 필요할 때의 축약형. */
export function useTypewriter(text: string, charMs = 70): string {
  return useTypewriterState(text, charMs).typed;
}
