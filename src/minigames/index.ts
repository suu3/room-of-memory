import type { MinigameDefinition } from "@/types/minigame";

/**
 * 미니게임 레지스트리. 새 미니게임은 src/minigames/<id>/index.tsx로 만들고
 * lazy import로 등록한다 (게이트 도달 직전 로드 — .claude/rules/minigames.md):
 *
 *   "lock-pick": {
 *     id: "lock-pick",
 *     mode: "overlay",
 *     component: lazy(() =>
 *       import("./lock-pick").then((m) => ({ default: m.LockPickMinigame })),
 *     ),
 *   },
 */
export const MINIGAMES: Record<string, MinigameDefinition> = {};

export function getMinigame(id: string): MinigameDefinition | undefined {
  return MINIGAMES[id];
}
