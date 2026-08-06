/** scripts/content/load.mjs의 타입 선언. */
import type { GameContent } from "@/types/content";

export const REPO_ROOT: string;
export const CONTENT_DIR: string;

export function sourcePath(key: string): string;
export function loadContent(): Promise<GameContent>;

/** 미니게임 레지스트리(src/minigames/index.ts)에 등록된 id들. */
export function loadMinigameIds(): Promise<string[]>;
