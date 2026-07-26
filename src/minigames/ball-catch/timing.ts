export type SwingResult = "hit" | "early" | "late";

export function classifySwing(progress: number, window: readonly [number, number]): SwingResult {
  if (progress < window[0]) return "early";
  if (progress > window[1]) return "late";
  return "hit";
}

export function remainingChances(misses: number, maximum: number): number {
  return Math.max(0, maximum - misses);
}
