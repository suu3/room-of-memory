/**
 * Scenario schema — the single contract between writing (data), UI (dialogue
 * overlay), and 3D (scene direction). Scenario data lives in
 * `src/data/scenario/*.ts` and must satisfy these types.
 */

/** A speaking character. Register every character here before use. */
export type CharacterId = "narrator" | (string & {});

/** Camera/stage direction attached to a line, interpreted by the active scene. */
export interface StageDirection {
  /** Named camera position defined by the scene (e.g. "desk", "window"). */
  camera?: string;
  /** Named animation/interaction trigger the scene understands. */
  trigger?: string;
  /** BGM asset path under /assets/audio/bgm, or "stop". */
  bgm?: string;
  /** One-shot SFX asset path under /assets/audio/sfx. */
  sfx?: string;
}

/** One line of dialogue or narration. */
export interface Line {
  id: string;
  speaker: CharacterId;
  /** i18n key into the chapter's namespace. Body copy lives in src/i18n/locales. */
  textKey: string;
  direction?: StageDirection;
}

/** A player choice branching to another node. */
export interface Choice {
  /** i18n key for the choice label. */
  textKey: string;
  /** Target node id within the same chapter. */
  next: string;
  /** Optional flag set when chosen, readable via game store. */
  setFlag?: string;
}

/** A minigame gate: after the lines, play a minigame and branch on the result. */
export interface MinigameGate {
  /** Minigame id registered in src/minigames/index.ts. */
  id: string;
  /** Node to jump to on clear (or skip). */
  onClear: string;
  /** Node on fail. Absent ⇒ fail also goes to onClear. */
  onFail?: string;
  /** Flag set when cleared, `flag:<chapterId>:<name>` 형식. */
  setFlagOnClear?: string;
}

/** A node: a run of lines optionally ending in choices, a minigame, or a jump. */
export interface ScenarioNode {
  id: string;
  lines: Line[];
  /** Present ⇒ show choices after the last line. Mutually exclusive with minigame. */
  choices?: Choice[];
  /** Present ⇒ play the minigame after the last line. Mutually exclusive with choices. */
  minigame?: MinigameGate;
  /** Absent, no choices, no minigame ⇒ chapter ends. */
  next?: string;
}

/** A chapter binds a 3D scene to a scenario graph. */
export interface Chapter {
  id: string;
  /** i18n key for the chapter title. */
  titleKey: string;
  /** Scene component key registered in src/scenes. */
  scene: string;
  /** Entry node id. */
  start: string;
  nodes: Record<string, ScenarioNode>;
}
