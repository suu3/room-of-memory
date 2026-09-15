/** 모션을 끈 사람인가. 테스트 환경(jsdom)에는 matchMedia가 없어 false로 본다. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
