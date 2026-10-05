/**
 * 이 파일은 생성물이다. 직접 고치지 말 것.
 *
 * 원본은 content/*.yaml, 생성은 `pnpm content:build` (dev 서버의 /admin에서
 * 저장해도 같은 것이 돈다). 손으로 고치면 다음 생성 때 그대로 덮인다.
 */

import {
  BagIcon,
  BaseballIcon,
  CalendarHeartIcon,
  DesktopIcon,
  DeviceMobileIcon,
  ExamIcon,
  FileTextIcon,
  GameControllerIcon,
  GridFourIcon,
  IdentificationCardIcon,
  ImageSquareIcon,
  NoteIcon,
  PackageIcon,
  RadioIcon,
  SneakerIcon,
  SyringeIcon,
} from "@phosphor-icons/react";
import type { MemoryIcon } from "@/types/icon";
import type { Cutscene, DialogueScript, MemoryPhaseConfig } from "@/types/interaction";

/** 기억 id: content/memories.yaml에 적힌 순서 그대로. 패널에도 이 순서로 뜬다. */
export const MEMORY_IDS = [
  "report-card",
  "console",
  "ball",
  "frame",
  "phone",
  "calendar",
  "window",
  "radio",
  "duffel",
  "fridge",
  "shoes",
  "cards",
  "computer",
  "ampoule",
  "research-note",
  "id-card",
] as const;

export type MemoryId = (typeof MEMORY_IDS)[number];

export interface MemoryItem {
  id: MemoryId;
  /** 수집 패널에 표시할 아이콘 (Phosphor 또는 호환 커스텀) */
  icon: MemoryIcon;
  /** 1차 조사 (p1). 없으면 1바퀴 내내 잠겨 있는 2바퀴 전용 기억이다. */
  phase1?: MemoryPhaseConfig;
  /** 2차 조사. 열리는 페이즈는 from이 정한다. */
  phase2?: MemoryPhaseConfig;
  /** 3차 조사: 2차를 마친 뒤의 되짚기. */
  phase3?: MemoryPhaseConfig;
}

export const MEMORIES: MemoryItem[] = [
  {
    id: "report-card",
    icon: ExamIcon,
    phase1: {
      interaction: { scriptId: "report-card-intro" },
      replayStill: "/assets/images/still-report-card.webp",
    },
  },
  {
    id: "console",
    icon: GameControllerIcon,
    phase1: {
      interaction: {
        scriptId: "console-intro",
        minigameId: "fighter-duel",
        resultScriptId: "console-alone",
      },
      unlockAfter: [{ id: "report-card", visit: 1 }],
      replayStill: "/assets/images/mg-cutscene-console-flashback.webp?v=2",
      cutscene: "console-flashback",
    },
    phase2: {
      interaction: { scriptId: "console-echo" },
      replayStill: "/assets/images/mg-cutscene-console-flashback.webp?v=2",
      from: "p2",
      side: true,
    },
  },
  {
    id: "ball",
    icon: BaseballIcon,
    phase1: {
      interaction: {
        scriptId: "ball-intro",
        minigameId: "ball-catch",
        resultScriptId: "ball-alone",
      },
      unlockAfter: [{ id: "report-card", visit: 1 }],
      replayStill: "/assets/images/mg-ball-catch-sunset-field.webp?v=2",
      cutscene: "ball-flashback",
    },
    phase2: {
      interaction: { scriptId: "ball-echo" },
      replayStill: "/assets/images/mg-ball-catch-sunset-field.webp?v=2",
      from: "p2",
      side: true,
    },
  },
  {
    id: "frame",
    icon: ImageSquareIcon,
    phase1: {
      interaction: {
        minigameId: "photo-wipe",
        resultScriptId: "frame-photo",
        resultMusic: "title",
      },
      unlockAfter: [
        { id: "console", visit: 1 },
        { id: "ball", visit: 1 },
      ],
      replayStill: "/assets/images/mg-photo-wipe-phase-1.webp?v=20260912",
    },
    phase2: {
      interaction: { minigameId: "photo-puzzle" },
      unlockAfter: [
        { id: "research-note", visit: 2 },
        { id: "id-card", visit: 2 },
      ],
      replayStill: "/assets/images/mg-photo-wipe-phase-2.webp?v=20260912",
      from: "p4",
      cutscene: "still-beat",
    },
  },
  {
    id: "phone",
    icon: DeviceMobileIcon,
    phase1: {
      interaction: { minigameId: "phone-chat", resultScriptId: "phone-stopped" },
      unlockAfter: [
        { id: "console", visit: 1 },
        { id: "ball", visit: 1 },
      ],
      replayStill: "/assets/images/still-phone.webp?v=2",
    },
    phase2: {
      interaction: {
        scriptId: "phone-mom-intro",
        minigameId: "mom-chat",
        resultScriptId: "phone-mom-read",
        resultMusic: "title",
      },
      unlockAfter: [{ id: "computer", visit: 2 }],
      replayStill: "/assets/images/still-phone.webp?v=2",
      from: "p2",
    },
  },
  {
    id: "calendar",
    icon: CalendarHeartIcon,
    phase1: {
      interaction: {
        scriptId: "calendar-intro",
        minigameId: "calendar-flip",
        resultScriptId: "calendar-tally",
      },
      unlockAfter: [{ id: "phone", visit: 1 }],
      replayStill: "/assets/images/mg-calendar-flip-11.webp",
    },
  },
  {
    id: "window",
    icon: GridFourIcon,
    phase1: {
      interaction: { minigameId: "window-view", resultScriptId: "window-silence" },
      unlockAfter: [
        { id: "frame", visit: 1 },
        { id: "phone", visit: 1 },
      ],
      replayStill: "/assets/images/mg-window-view-outside.webp",
    },
  },
  {
    id: "radio",
    icon: RadioIcon,
    phase1: {
      interaction: { scriptId: "radio-intro", minigameId: "frequency-tune" },
      unlockAfter: [
        { id: "report-card", visit: 1 },
        { id: "console", visit: 1 },
        { id: "ball", visit: 1 },
        { id: "frame", visit: 1 },
        { id: "phone", visit: 1 },
        { id: "calendar", visit: 1 },
        { id: "window", visit: 1 },
      ],
      replayStill: "/assets/images/cutscene-day-8.webp",
    },
    phase2: {
      replayStill: "/assets/images/cutscene-survivor-1.webp?v=2",
      from: "turning",
      cutscene: "survivor-broadcast",
    },
  },
  {
    id: "duffel",
    icon: BagIcon,
    phase2: {
      interaction: { scriptId: "duffel-pack" },
      replayStill: "/assets/images/still-duffel.webp",
      from: "p2",
    },
    phase3: {
      interaction: { scriptId: "duffel-take" },
      replayStill: "/assets/images/still-duffel.webp",
      from: "resolve",
    },
  },
  {
    id: "fridge",
    icon: PackageIcon,
    phase2: {
      interaction: { scriptId: "fridge-open" },
      replayStill: "/assets/images/still-fridge.webp",
      from: "p2",
    },
  },
  {
    id: "shoes",
    icon: SneakerIcon,
    phase2: {
      interaction: { scriptId: "shoes-open" },
      replayStill: "/assets/images/still-shoes.webp",
      from: "p2",
    },
  },
  {
    id: "cards",
    icon: NoteIcon,
    phase2: {
      interaction: {
        scriptId: "cards-intro",
        minigameId: "card-flip",
        resultScriptId: "cards-memo",
      },
      replayStill: "/assets/images/still-cards-{lng}.webp",
      from: "p2",
    },
  },
  {
    id: "computer",
    icon: DesktopIcon,
    phase2: {
      interaction: {
        scriptId: "computer-power-on",
        minigameId: "computer-browse",
        resultScriptId: "computer-archive",
      },
      replayStill: "/assets/images/still-computer.webp",
      from: "p2",
    },
    phase3: {
      interaction: {
        scriptId: "computer-logo-intro",
        minigameId: "computer-logo",
        resultScriptId: "computer-logo-found",
      },
      unlockAfter: [{ id: "ampoule", visit: 2 }],
      replayStill: "/assets/images/still-computer.webp",
      from: "p3",
    },
  },
  {
    id: "ampoule",
    icon: SyringeIcon,
    phase2: {
      interaction: {
        scriptId: "ampoule-note",
        minigameId: "ampoule-case",
        resultScriptId: "ampoule-found",
      },
      replayStill: "/assets/images/still-ampoule-vial.webp",
      from: "p3",
    },
    phase3: {
      interaction: {
        scriptId: "ampoule-take",
        minigameId: "ampoule-pickup",
        resultScriptId: "ampoule-taken",
      },
      replayStill: "/assets/images/still-ampoule.webp",
      from: "resolve",
    },
  },
  {
    id: "research-note",
    icon: FileTextIcon,
    phase2: {
      interaction: {
        scriptId: "research-note-intro",
        minigameId: "papers-order",
        resultScriptId: "research-note-read",
      },
      replayStill: "/assets/images/still-research-note.webp",
      from: "p4",
    },
  },
  {
    id: "id-card",
    icon: IdentificationCardIcon,
    phase2: {
      interaction: {
        scriptId: "id-card-look",
        minigameId: "id-card-flip",
        resultScriptId: "id-card-found",
      },
      replayStill: "/assets/images/still-id-card-{lng}.webp",
      from: "p4",
    },
  },
];

/** 대사 스크립트 레지스트리: 본문은 i18n 리소스(memoryRoom.scripts.*)에 있다. */
export const SCRIPTS: Record<string, DialogueScript> = {
  "report-card-intro": {
    id: "report-card-intro",
    lines: [
      { speaker: "hero", textKey: "scripts.report-card-intro.line1" },
      { speaker: "hero", textKey: "scripts.report-card-intro.line2", expression: "sad" },
      { speaker: "hero", textKey: "scripts.report-card-intro.line3" },
      { speaker: "mom", textKey: "scripts.report-card-intro.line4" },
      { speaker: "dad", textKey: "scripts.report-card-intro.line5" },
      {
        speaker: "hero",
        textKey: "scripts.report-card-intro.line6",
        expression: "puzzled",
        recall: true,
      },
      { speaker: "hero", textKey: "scripts.report-card-intro.line7" },
      { speaker: "hero", textKey: "scripts.report-card-intro.line8" },
    ],
  },
  "ball-intro": {
    id: "ball-intro",
    lines: [
      { speaker: "hero", textKey: "scripts.ball-intro.line1" },
      { speaker: "hero", textKey: "scripts.ball-intro.line2", expression: "smile" },
      { speaker: "hero", textKey: "scripts.ball-intro.line3" },
      { speaker: "hero", textKey: "scripts.ball-intro.line4", expression: "smile" },
      { speaker: "hero", textKey: "scripts.ball-intro.line5" },
      { speaker: "hero", textKey: "scripts.ball-intro.line6" },
    ],
  },
  "ball-alone": {
    id: "ball-alone",
    lines: [{ speaker: "hero", textKey: "scripts.ball-alone.line1" }],
  },
  "console-intro": {
    id: "console-intro",
    lines: [
      { speaker: "hero", textKey: "scripts.console-intro.line1", expression: "smile" },
      { speaker: "hero", textKey: "scripts.console-intro.line2", expression: "smile" },
    ],
  },
  "console-alone": {
    id: "console-alone",
    lines: [
      { speaker: "hero", textKey: "scripts.console-alone.line1", expression: "smile" },
      { speaker: "hero", textKey: "scripts.console-alone.line2", expression: "sad" },
    ],
  },
  "console-echo": {
    id: "console-echo",
    lines: [
      { speaker: "hero", textKey: "scripts.console-echo.line1" },
      { speaker: "hero", textKey: "scripts.console-echo.line2", expression: "sad" },
      { speaker: "hero", textKey: "scripts.console-echo.line3", expression: "smile" },
    ],
  },
  "frame-photo": {
    id: "frame-photo",
    lines: [
      { speaker: "hero", textKey: "scripts.frame-photo.line1", expression: "smile" },
      { speaker: "hero", textKey: "scripts.frame-photo.line2", expression: "smile" },
      { speaker: "hero", textKey: "scripts.frame-photo.line3", expression: "puzzled" },
    ],
  },
  "phone-stopped": {
    id: "phone-stopped",
    lines: [
      { speaker: "hero", textKey: "scripts.phone-stopped.line1" },
      { speaker: "hero", textKey: "scripts.phone-stopped.line2", expression: "puzzled" },
    ],
  },
  "window-silence": {
    id: "window-silence",
    lines: [
      { speaker: "hero", textKey: "scripts.window-silence.line1", expression: "sad" },
      { speaker: "hero", textKey: "scripts.window-silence.line2", expression: "sad" },
    ],
  },
  "calendar-intro": {
    id: "calendar-intro",
    lines: [{ speaker: "hero", textKey: "scripts.calendar-intro.line1" }],
  },
  "calendar-tally": {
    id: "calendar-tally",
    lines: [
      { speaker: "hero", textKey: "scripts.calendar-tally.line1", expression: "puzzled" },
      { speaker: "hero", textKey: "scripts.calendar-tally.line2", expression: "sad" },
    ],
  },
  "radio-intro": {
    id: "radio-intro",
    lines: [
      { speaker: "hero", textKey: "scripts.radio-intro.line1" },
      { speaker: "hero", textKey: "scripts.radio-intro.line2", expression: "sad" },
    ],
  },
  "duffel-pack": {
    id: "duffel-pack",
    lines: [
      { speaker: "hero", textKey: "scripts.duffel-pack.line1" },
      { speaker: "hero", textKey: "scripts.duffel-pack.line2" },
      { speaker: "hero", textKey: "scripts.duffel-pack.line3" },
      { speaker: "hero", textKey: "scripts.duffel-pack.line4" },
      { speaker: "dad", textKey: "scripts.duffel-pack.line5" },
      { speaker: "hero", textKey: "scripts.duffel-pack.line6", recall: true },
      { speaker: "hero", textKey: "scripts.duffel-pack.line7" },
      { speaker: "hero", textKey: "scripts.duffel-pack.line8" },
    ],
  },
  "duffel-take": {
    id: "duffel-take",
    lines: [
      { speaker: "hero", textKey: "scripts.duffel-take.line1" },
      { speaker: "hero", textKey: "scripts.duffel-take.line2" },
    ],
  },
  "fridge-open": {
    id: "fridge-open",
    lines: [
      { speaker: "hero", textKey: "scripts.fridge-open.line1" },
      { speaker: "hero", textKey: "scripts.fridge-open.line2", expression: "puzzled" },
      { speaker: "hero", textKey: "scripts.fridge-open.line3" },
      { speaker: "hero", textKey: "scripts.fridge-open.line4", recall: true },
      { speaker: "mom", textKey: "scripts.fridge-open.line5" },
      { speaker: "hero", textKey: "scripts.fridge-open.line6", recall: true },
      { speaker: "mom", textKey: "scripts.fridge-open.line7" },
      { speaker: "hero", textKey: "scripts.fridge-open.line8", expression: "puzzled" },
    ],
  },
  "shoes-open": {
    id: "shoes-open",
    lines: [
      { speaker: "hero", textKey: "scripts.shoes-open.line1" },
      { speaker: "hero", textKey: "scripts.shoes-open.line2", expression: "puzzled" },
      { speaker: "dad", textKey: "scripts.shoes-open.line3" },
      { speaker: "hero", textKey: "scripts.shoes-open.line4", expression: "puzzled" },
      { speaker: "hero", textKey: "scripts.shoes-open.line5", expression: "puzzled" },
    ],
  },
  "cards-intro": {
    id: "cards-intro",
    lines: [
      { speaker: "hero", textKey: "scripts.cards-intro.line1" },
      { speaker: "hero", textKey: "scripts.cards-intro.line2" },
      { speaker: "hero", textKey: "scripts.cards-intro.line3" },
      { speaker: "dad", textKey: "scripts.cards-intro.line4" },
      { speaker: "mom", textKey: "scripts.cards-intro.line5" },
      { speaker: "hero", textKey: "scripts.cards-intro.line6", recall: true },
      { speaker: "hero", textKey: "scripts.cards-intro.line7", expression: "sad" },
      { speaker: "hero", textKey: "scripts.cards-intro.line8" },
    ],
  },
  "cards-memo": {
    id: "cards-memo",
    lines: [
      { speaker: "hero", textKey: "scripts.cards-memo.line1" },
      { speaker: "hero", textKey: "scripts.cards-memo.line2", expression: "puzzled" },
      { speaker: "hero", textKey: "scripts.cards-memo.line3", expression: "puzzled" },
    ],
  },
  "computer-power-on": {
    id: "computer-power-on",
    lines: [
      { speaker: "hero", textKey: "scripts.computer-power-on.line1" },
      { speaker: "hero", textKey: "scripts.computer-power-on.line2" },
      { speaker: "hero", textKey: "scripts.computer-power-on.line3" },
    ],
  },
  "computer-archive": {
    id: "computer-archive",
    lines: [
      { speaker: "hero", textKey: "scripts.computer-archive.line1" },
      { speaker: "hero", textKey: "scripts.computer-archive.line2", expression: "puzzled" },
      { speaker: "hero", textKey: "scripts.computer-archive.line3" },
    ],
  },
  "phone-mom-intro": {
    id: "phone-mom-intro",
    lines: [
      { speaker: "hero", textKey: "scripts.phone-mom-intro.line1", expression: "sad" },
      { speaker: "hero", textKey: "scripts.phone-mom-intro.line2", expression: "sad" },
      { speaker: "hero", textKey: "scripts.phone-mom-intro.line3", expression: "sad" },
    ],
  },
  "phone-mom-read": {
    id: "phone-mom-read",
    lines: [
      { speaker: "hero", textKey: "scripts.phone-mom-read.line1", expression: "puzzled" },
      { speaker: "hero", textKey: "scripts.phone-mom-read.line2", expression: "sad" },
    ],
  },
  "ball-echo": {
    id: "ball-echo",
    lines: [
      { speaker: "hero", textKey: "scripts.ball-echo.line1", expression: "sad" },
      { speaker: "hero", textKey: "scripts.ball-echo.line2", expression: "smile" },
    ],
  },
  "ampoule-note": {
    id: "ampoule-note",
    lines: [
      { speaker: "hero", textKey: "scripts.ampoule-note.line1" },
      { speaker: "hero", textKey: "scripts.ampoule-note.line2" },
      { speaker: "hero", textKey: "scripts.ampoule-note.line3" },
    ],
  },
  "ampoule-found": {
    id: "ampoule-found",
    lines: [
      { speaker: "hero", textKey: "scripts.ampoule-found.line1", expression: "puzzled" },
      { speaker: "hero", textKey: "scripts.ampoule-found.line2" },
      { speaker: "hero", textKey: "scripts.ampoule-found.line3", expression: "puzzled" },
    ],
  },
  "ampoule-take": {
    id: "ampoule-take",
    lines: [{ speaker: "hero", textKey: "scripts.ampoule-take.line1" }],
  },
  "ampoule-taken": {
    id: "ampoule-taken",
    lines: [{ speaker: "hero", textKey: "scripts.ampoule-taken.line1" }],
  },
  "computer-logo-intro": {
    id: "computer-logo-intro",
    lines: [
      { speaker: "hero", textKey: "scripts.computer-logo-intro.line1", expression: "puzzled" },
    ],
  },
  "computer-logo-found": {
    id: "computer-logo-found",
    lines: [
      { speaker: "hero", textKey: "scripts.computer-logo-found.line1" },
      { speaker: "hero", textKey: "scripts.computer-logo-found.line2" },
      { speaker: "hero", textKey: "scripts.computer-logo-found.line3" },
      { speaker: "dad", textKey: "scripts.computer-logo-found.line4" },
      { speaker: "hero", textKey: "scripts.computer-logo-found.line5", recall: true },
      { speaker: "dad", textKey: "scripts.computer-logo-found.line6" },
      { speaker: "hero", textKey: "scripts.computer-logo-found.line7", expression: "sad" },
      { speaker: "hero", textKey: "scripts.computer-logo-found.line8", expression: "puzzled" },
    ],
  },
  "research-note-intro": {
    id: "research-note-intro",
    lines: [
      { speaker: "hero", textKey: "scripts.research-note-intro.line1" },
      { speaker: "hero", textKey: "scripts.research-note-intro.line2" },
      { speaker: "mom", textKey: "scripts.research-note-intro.line3" },
      { speaker: "hero", textKey: "scripts.research-note-intro.line4", expression: "sad" },
      { speaker: "hero", textKey: "scripts.research-note-intro.line5" },
    ],
  },
  "research-note-read": {
    id: "research-note-read",
    lines: [
      { speaker: "hero", textKey: "scripts.research-note-read.line1" },
      { speaker: "hero", textKey: "scripts.research-note-read.line2", expression: "surprised" },
      { speaker: "hero", textKey: "scripts.research-note-read.line3", expression: "sad" },
    ],
  },
  "id-card-look": {
    id: "id-card-look",
    lines: [{ speaker: "hero", textKey: "scripts.id-card-look.line1" }],
  },
  "id-card-found": {
    id: "id-card-found",
    lines: [
      { speaker: "hero", textKey: "scripts.id-card-found.line1" },
      { speaker: "hero", textKey: "scripts.id-card-found.line2", expression: "surprised" },
    ],
  },
};

export const CUTSCENES: Record<string, Cutscene> = {
  "workbook-name": {
    id: "workbook-name",
    cuts: [
      {
        lines: [
          { speaker: "hero", textKey: "cutscenes.workbook-name.cut1.line1" },
          { speaker: "hero", textKey: "cutscenes.workbook-name.cut1.line2" },
          { speaker: "hero", textKey: "cutscenes.workbook-name.cut1.line3" },
        ],
      },
    ],
  },
  "console-flashback": {
    id: "console-flashback",
    cuts: [
      {
        image: "/assets/images/mg-cutscene-console-flashback.webp?v=2",
        holdMs: 1200,
        lines: [
          { speaker: "hero", textKey: "cutscenes.console-flashback.cut1.line1" },
          { speaker: "hero", textKey: "cutscenes.console-flashback.cut1.line2" },
          {
            speaker: "hero",
            textKey: "cutscenes.console-flashback.cut1.line3",
            expression: "smile",
          },
          { speaker: "hero", textKey: "cutscenes.console-flashback.cut1.line4" },
          { speaker: "hero", textKey: "cutscenes.console-flashback.cut1.line5" },
        ],
      },
    ],
  },
  "ball-flashback": {
    id: "ball-flashback",
    cuts: [
      {
        image: "/assets/images/mg-cutscene-ball-flashback.webp?v=5",
        holdMs: 1500,
        lines: [
          { speaker: "hero", textKey: "cutscenes.ball-flashback.cut1.line1" },
          { speaker: "hero", textKey: "cutscenes.ball-flashback.cut1.line2" },
          { speaker: "hero", textKey: "cutscenes.ball-flashback.cut1.line3", expression: "sad" },
          { speaker: "hero", textKey: "cutscenes.ball-flashback.cut1.line4" },
          { speaker: "hero", textKey: "cutscenes.ball-flashback.cut1.line5" },
        ],
      },
    ],
  },
  "radio-blackout": {
    id: "radio-blackout",
    cuts: [
      {
        black: true,
        lines: [
          { speaker: "hero", textKey: "cutscenes.radio-blackout.cut1.line1", expression: "sad" },
        ],
      },
      {
        black: true,
        holdMs: 2000,
        lines: [],
      },
      {
        black: true,
        whisperKeys: [
          "cutscenes.radio-blackout.cut3.whisper1",
          "cutscenes.radio-blackout.cut3.whisper2",
          "cutscenes.radio-blackout.cut3.whisper3",
        ],
        lines: [
          { speaker: "broadcast", textKey: "cutscenes.radio-blackout.cut3.line1" },
          { speaker: "broadcast", textKey: "cutscenes.radio-blackout.cut3.line2" },
          { speaker: "broadcast", textKey: "cutscenes.radio-blackout.cut3.line3" },
          { speaker: "hero", textKey: "cutscenes.radio-blackout.cut3.line4", expression: "sad" },
        ],
      },
      {
        image: "/assets/images/cutscene-day-1.webp?v=3",
        lines: [
          { speaker: "hero", textKey: "cutscenes.radio-blackout.cut4.line1" },
          { speaker: "hero", textKey: "cutscenes.radio-blackout.cut4.line2" },
          { speaker: "hero", textKey: "cutscenes.radio-blackout.cut4.line3" },
        ],
      },
      {
        image: "/assets/images/cutscene-day-2.webp?v=2",
        lines: [
          { speaker: "hero", textKey: "cutscenes.radio-blackout.cut5.line1" },
          { speaker: "hero", textKey: "cutscenes.radio-blackout.cut5.line2" },
          { speaker: "hero", textKey: "cutscenes.radio-blackout.cut5.line3" },
          { speaker: "hero", textKey: "cutscenes.radio-blackout.cut5.line4" },
        ],
      },
      {
        image: "/assets/images/cutscene-day-3.webp?v=3",
        lines: [
          { speaker: "hero", textKey: "cutscenes.radio-blackout.cut6.line1" },
          { speaker: "hero", textKey: "cutscenes.radio-blackout.cut6.line2" },
        ],
      },
      {
        image: "/assets/images/cutscene-day-4.webp?v=3",
        holdMs: 1200,
        shake: true,
        lines: [],
      },
      {
        image: "/assets/images/cutscene-day-5.webp?v=4",
        holdMs: 1500,
        lines: [],
      },
      {
        image: "/assets/images/cutscene-day-6.webp?v=4",
        lines: [
          { speaker: "hero", textKey: "cutscenes.radio-blackout.cut9.line1" },
          { speaker: "hero", textKey: "cutscenes.radio-blackout.cut9.line2" },
        ],
      },
      {
        image: "/assets/images/cutscene-day-7.webp?v=3",
        lines: [
          { speaker: "hero", textKey: "cutscenes.radio-blackout.cut10.line1" },
          { speaker: "hero", textKey: "cutscenes.radio-blackout.cut10.line2" },
          { speaker: "hero", textKey: "cutscenes.radio-blackout.cut10.line3" },
        ],
      },
      {
        image: "/assets/images/cutscene-day-8.webp",
        lines: [
          { speaker: "hero", textKey: "cutscenes.radio-blackout.cut11.line1" },
          { speaker: "hero", textKey: "cutscenes.radio-blackout.cut11.line2" },
          { speaker: "hero", textKey: "cutscenes.radio-blackout.cut11.line3" },
        ],
      },
      {
        black: true,
        lines: [
          { speaker: "hero", textKey: "cutscenes.radio-blackout.cut12.line1" },
          { speaker: "hero", textKey: "cutscenes.radio-blackout.cut12.line2" },
        ],
      },
    ],
  },
  "survivor-broadcast": {
    id: "survivor-broadcast",
    cuts: [
      {
        image: "/assets/images/cutscene-survivor-1.webp?v=2",
        holdMs: 1500,
        page: 1,
        ratio: "16:9",
        sfx: "mittTap",
        lines: [],
      },
      {
        image: "/assets/images/cutscene-survivor-2.webp?v=2",
        holdMs: 1500,
        page: 1,
        ratio: "3:4",
        lines: [],
      },
      {
        image: "/assets/images/cutscene-survivor-3.webp?v=3",
        holdMs: 1500,
        page: 1,
        ratio: "3:4",
        lines: [],
      },
      {
        image: "/assets/images/cutscene-survivor-4.webp?v=4",
        page: 1,
        ratio: "16:9",
        sfx: "radioStatic",
        lines: [{ speaker: "signal", textKey: "cutscenes.survivor-broadcast.cut4.line1" }],
      },
      {
        image: "/assets/images/cutscene-survivor-5.webp?v=2",
        page: 2,
        ratio: "3:4",
        sfx: "radioStatic",
        lines: [{ speaker: "signal", textKey: "cutscenes.survivor-broadcast.cut5.line1" }],
      },
      {
        image: "/assets/images/cutscene-survivor-6.webp?v=3",
        holdMs: 1500,
        page: 2,
        ratio: "3:4",
        lines: [],
      },
      {
        image: "/assets/images/cutscene-survivor-7.webp?v=2",
        page: 2,
        ratio: "16:9",
        sfx: "radioStatic",
        lines: [{ speaker: "signal", textKey: "cutscenes.survivor-broadcast.cut7.line1" }],
      },
      {
        image: "/assets/images/cutscene-survivor-8.webp?v=6",
        page: 3,
        ratio: "16:9",
        sfx: "radioStatic",
        lines: [{ speaker: "signal", textKey: "cutscenes.survivor-broadcast.cut8.line1" }],
      },
      {
        image: "/assets/images/cutscene-survivor-9.webp?v=2",
        page: 3,
        ratio: "3:4",
        sfx: "radioStatic",
        lines: [{ speaker: "signal", textKey: "cutscenes.survivor-broadcast.cut9.line1" }],
      },
      {
        image: "/assets/images/cutscene-survivor-10.webp?v=3",
        holdMs: 1500,
        page: 3,
        ratio: "3:4",
        sfx: "radioSignOff",
        lines: [],
      },
      {
        lines: [
          {
            speaker: "hero",
            textKey: "cutscenes.survivor-broadcast.cut11.line1",
            expression: "surprised",
          },
          { speaker: "hero", textKey: "cutscenes.survivor-broadcast.cut11.line2" },
        ],
      },
    ],
  },
  "trip-doubt": {
    id: "trip-doubt",
    cuts: [
      {
        lines: [
          { speaker: "hero", textKey: "cutscenes.trip-doubt.cut1.line1", expression: "puzzled" },
          { speaker: "hero", textKey: "cutscenes.trip-doubt.cut1.line2", expression: "puzzled" },
          { speaker: "hero", textKey: "cutscenes.trip-doubt.cut1.line3" },
        ],
      },
    ],
  },
  "time-gap": {
    id: "time-gap",
    cuts: [
      {
        lines: [
          { speaker: "hero", textKey: "cutscenes.time-gap.cut1.line1", expression: "puzzled" },
          { speaker: "hero", textKey: "cutscenes.time-gap.cut1.line2", expression: "sad" },
        ],
      },
    ],
  },
  "p2-close": {
    id: "p2-close",
    cuts: [
      {
        lines: [{ speaker: "hero", textKey: "cutscenes.p2-close.cut1.line1" }],
      },
    ],
  },
  "p4-close": {
    id: "p4-close",
    cuts: [
      {
        lines: [
          { speaker: "hero", textKey: "cutscenes.p4-close.cut1.line1", expression: "puzzled" },
          { speaker: "hero", textKey: "cutscenes.p4-close.cut1.line2" },
          { speaker: "hero", textKey: "cutscenes.p4-close.cut1.line3" },
        ],
      },
    ],
  },
  "piano-flashback": {
    id: "piano-flashback",
    cuts: [
      {
        image: "/assets/images/cutscene-piano-flashback.webp",
        lines: [
          { speaker: "hero", textKey: "cutscenes.piano-flashback.cut1.line1" },
          { speaker: "hero", textKey: "cutscenes.piano-flashback.cut1.line2" },
          { speaker: "mom", textKey: "cutscenes.piano-flashback.cut1.line3" },
          { speaker: "hero", textKey: "cutscenes.piano-flashback.cut1.line4", recall: true },
          { speaker: "dad", textKey: "cutscenes.piano-flashback.cut1.line5" },
          { speaker: "hero", textKey: "cutscenes.piano-flashback.cut1.line6" },
        ],
      },
      {
        lines: [{ speaker: "hero", textKey: "cutscenes.piano-flashback.cut2.line1" }],
      },
    ],
  },
  "still-beat": {
    id: "still-beat",
    cuts: [
      {
        holdMs: 2600,
        lines: [],
      },
      {
        lines: [
          { speaker: "hero", textKey: "cutscenes.still-beat.cut2.line1" },
          { speaker: "hero", textKey: "cutscenes.still-beat.cut2.line2" },
        ],
      },
    ],
  },
  "bat-grip": {
    id: "bat-grip",
    cuts: [
      {
        lines: [
          { speaker: "hero", textKey: "cutscenes.bat-grip.cut1.line1" },
          { speaker: "hero", textKey: "cutscenes.bat-grip.cut1.line2", expression: "sad" },
          { speaker: "hero", textKey: "cutscenes.bat-grip.cut1.line3", expression: "sad" },
          { speaker: "hero", textKey: "cutscenes.bat-grip.cut1.line4" },
        ],
      },
    ],
  },
};
