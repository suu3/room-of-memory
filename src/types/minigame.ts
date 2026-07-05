/**
 * Minigame contract — every minigame is a self-contained component that
 * reports its outcome through `onComplete`. The VN engine (not the minigame)
 * decides what the result means: which node comes next, which flags get set.
 */

export interface MinigameResult {
  /** Did the player clear it? Failure is a valid outcome, not an error. */
  cleared: boolean;
  /** Optional score for minigames with gradations. */
  score?: number;
}

export interface MinigameProps {
  /** Call exactly once when the minigame ends (clear, fail, or skip). */
  onComplete: (result: MinigameResult) => void;
  /**
   * Player asked to skip (accessibility requirement — every minigame must
   * call onComplete({ cleared: true }) when skipped).
   */
  onSkip?: () => void;
}

/**
 * How the minigame renders. "canvas" mounts inside the r3f <Canvas> of the
 * current scene; "overlay" mounts as a DOM layer above it. A minigame is one
 * or the other, never both.
 */
export type MinigameMode = "canvas" | "overlay";

export interface MinigameDefinition {
  id: string;
  mode: MinigameMode;
  /** Component registered in src/minigames/index.ts. */
  component: React.ComponentType<MinigameProps>;
}
