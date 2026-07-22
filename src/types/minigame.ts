/**
 * Minigame contract — every minigame is a self-contained component that
 * reports its outcome through `onComplete`. The VN engine (not the minigame)
 * decides what the result means: which node comes next, which flags get set.
 */

import type { ParseKeys } from "i18next";

/** common 네임스페이스에서 유효한 번역 키만 허용. */
export type CommonTextKey = ParseKeys<"common">;

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
  /** 시작 카드(게임 마운트 전)에 보여줄 제목/조작법 키. */
  titleKey: CommonTextKey;
  helpKey: CommonTextKey;
}
