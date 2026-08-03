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
  /**
   * 미니게임이 자기 화면에서 성공 연출(파티클·결과 대사)을 이미 보여줬다는 표시.
   * 호스트는 파티클을 한 번 더 터뜨리지 않는다.
   */
  celebrated?: boolean;
}

export interface MinigameProps {
  /** Call exactly once when the minigame ends (clear, fail, or skip). */
  onComplete: (result: MinigameResult) => void;
  /**
   * 인터랙션이 시작된 게임 페이즈. 1차/2차 조사에서 같은 미니게임을 다르게
   * 연출할 때만 쓴다 (액자는 2차에서 그늘이 걷힌 사진이 나온다).
   * 스토어의 GamePhase와 같은 값이지만, 미니게임이 스토어에 의존하지 않도록
   * 호스트가 props로 내려준다. 기본값은 1.
   */
  gamePhase?: 1 | 2;
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

/**
 * 화면에 어떻게 얹히는가.
 *
 * "panel"은 제목·조작법·스킵이 달린 미니게임 카드다. "bare"는 그 껍데기 없이
 * 오브젝트만 떠오른다 — 방탈출처럼 "물건을 집어서 들여다보는" 인터랙션은
 * 시작 카드도 패널도 없어야 게임이 아니라 탐색으로 읽힌다.
 */
export type MinigamePresentation = "panel" | "bare";

export interface MinigameDefinition {
  id: string;
  mode: MinigameMode;
  /** 기본값 "panel". */
  presentation?: MinigamePresentation;
  /** Component registered in src/minigames/index.ts. */
  component: React.ComponentType<MinigameProps>;
  /** 시작 카드(게임 마운트 전)에 보여줄 제목/조작법 키. */
  titleKey: CommonTextKey;
  helpKey: CommonTextKey;
}
