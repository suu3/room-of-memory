/** Curtain clip: hand reaches at frame 30, pulls during frames 38–62 (30 fps). */
const REACH_END = 29 / 30;
const PULL_START = 37 / 30;
const PULL_END = 61 / 30;
const GRIP_SECONDS = 0.3;
const RELEASE_SECONDS = 0.65;

export function createCurtainMotion(progress: number) {
  return { elapsed: 0, time: 0, shown: progress, release: 0, weight: 1, ready: false, done: false };
}

export type CurtainMotion = ReturnType<typeof createCurtainMotion>;

/** Mutate a frame-local state; no React updates while scrubbing the baked clip. */
export function advanceCurtainMotion(
  motion: CurtainMotion,
  held: boolean,
  progress: number,
  delta: number,
) {
  const step = Math.max(0, Math.min(delta, 0.05));
  motion.elapsed += step;
  motion.ready = motion.elapsed >= REACH_END + GRIP_SECONDS;
  if (!motion.ready) {
    // Reach first, then move continuously to the grip at the curtain's current opening.
    const grip = Math.max(0, (motion.elapsed - REACH_END) / GRIP_SECONDS);
    const eased = grip * grip * (3 - 2 * grip);
    const gripTime = PULL_START + (PULL_END - PULL_START) * motion.shown;
    motion.time = Math.min(motion.elapsed, REACH_END) + (gripTime - REACH_END) * eased;
    return;
  }
  motion.shown = held
    ? progress
    : motion.shown + (progress - motion.shown) * (1 - Math.exp(-5.5 * step));
  motion.time = PULL_START + (PULL_END - PULL_START) * motion.shown;
  // A tap can arrive before the queued curtain target reaches the next render.
  const settled =
    Math.abs(motion.shown - progress) < 0.01 && motion.elapsed > REACH_END + GRIP_SECONDS + 0.2;
  if (held) motion.release = 0;
  else if (settled) motion.release = Math.min(RELEASE_SECONDS, motion.release + step);
  const release = motion.release / RELEASE_SECONDS;
  motion.weight = 1 - release * release * (3 - 2 * release);
  motion.done = release >= 1;
}
