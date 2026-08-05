import {
  Baseball,
  CalendarHeart,
  DeviceMobile,
  GameController,
  GridFour,
  ImageSquare,
  Radio,
} from "@phosphor-icons/react";
import type { MemoryIcon } from "@/components/ui/icons";
import { ASSETS } from "@/lib/assets";
import type { Cutscene, DialogueScript, MemoryPhaseConfig } from "@/types/interaction";

/**
 * 수집 대상. 배트는 여기 없다 — 문 옆의 배트는 모으는 물건이 아니라 2바퀴를 다
 * 돌았을 때 켜지는 엔딩 트리거다 (layout의 BAT_PLACEMENT, scenes의 EndingTrigger).
 */
export const MEMORY_IDS = [
  "console",
  "window",
  "frame",
  "radio",
  "phone",
  "calendar",
  "ball",
] as const;
export type MemoryId = (typeof MEMORY_IDS)[number];

export interface MemoryItem {
  id: MemoryId;
  /** 수집 패널에 표시할 아이콘 (Phosphor 또는 호환 커스텀) */
  icon: MemoryIcon;
  /** Phase 1: 최초 수집 클릭. 모든 아이템 필수. */
  phase1: MemoryPhaseConfig;
  /** Phase 2: 전원 수집 후 재클릭. 있는 아이템만 재클릭 대상. */
  phase2?: MemoryPhaseConfig;
}

/**
 * 라디오는 1바퀴의 마지막 관문이다 — 나머지를 다 조사해야 열린다.
 *
 * 순서를 강제하는 이유는 반전이 한 번뿐이기 때문이다. 라디오를 먼저 들으면
 * 재난방송이 세계관을 통째로 열어버려서, 남은 오브젝트의 "일상에 난 균열"이
 * 전부 이미 아는 이야기의 각주로 떨어진다.
 */
const RADIO_PREREQUISITES = MEMORY_IDS.filter((id) => id !== "radio");

/** 2바퀴는 라디오 목소리에서 시작한다 — 재점등된 나머지는 그 뒤에 열린다. */
const AFTER_RADIO_VOICE: MemoryId[] = ["radio"];

export const MEMORIES: MemoryItem[] = [
  {
    id: "console",
    icon: GameController,
    phase1: { interaction: { minigameId: "fighter-duel" } },
    phase2: { interaction: { scriptId: "console-echo" }, unlockAfter: AFTER_RADIO_VOICE },
  },
  {
    id: "window",
    icon: GridFour,
    /** 커튼을 걷으면 그림 한 장 — 미니게임이라기보다 들여다보는 오브젝트다. */
    phase1: { interaction: { minigameId: "window-view" } },
  },
  {
    id: "frame",
    icon: ImageSquare,
    phase1: { interaction: { minigameId: "photo-wipe", resultScriptId: "frame-photo" } },
    /** 2차 조사: 흩어진 사진 조각을 맞추면 그늘에 묻혔던 가족 얼굴이 드러난다. */
    phase2: {
      interaction: { minigameId: "photo-puzzle", resultScriptId: "frame-photo-echo" },
      unlockAfter: AFTER_RADIO_VOICE,
    },
  },
  {
    id: "radio",
    icon: Radio,
    /**
     * 1차: 진입 대사 → 튜닝 → 재난방송(결과 대사). 방송이 끊기면 전환 컷씬이 뜬다
     * (store의 complete가 CUTSCENE_RADIO_BLACKOUT을 연다).
     */
    phase1: {
      interaction: {
        scriptId: "radio-intro",
        minigameId: "frequency-tune",
        resultScriptId: "radio-broadcast",
      },
      unlockAfter: RADIO_PREREQUISITES,
    },
    /** 2차: 2바퀴에서 유일하게 손을 쓰는 조사. 같은 다이얼 끝에 이번엔 사람이 있다. */
    phase2: {
      interaction: {
        scriptId: "radio-voice-intro",
        minigameId: "frequency-tune",
        resultScriptId: "radio-voice",
      },
    },
  },
  {
    id: "phone",
    icon: DeviceMobile,
    phase1: { interaction: { minigameId: "phone-chat" } },
  },
  {
    id: "calendar",
    icon: CalendarHeart,
    phase1: { interaction: { minigameId: "calendar-flip" }, unlockAfter: ["phone"] },
  },
  {
    id: "ball",
    icon: Baseball,
    phase1: { interaction: { scriptId: "ball-intro", minigameId: "ball-catch" } },
    phase2: { interaction: { scriptId: "ball-echo" }, unlockAfter: AFTER_RADIO_VOICE },
  },
];

export const MEMORY_GOAL = MEMORIES.length;

export const STAGE_IDS = ["dark", "dim", "gold"] as const;
export type StageId = (typeof STAGE_IDS)[number];

export interface RoomStage {
  id: StageId;
  /** 방 배경 라디얼 그라디언트 (씬 라이팅 램프 토큰만 사용) */
  background: string;
  /** 창가에서 스며드는 금빛 산광 강도 */
  glowOpacity: number;
  /** 방 곳곳에 흩뿌려진 금빛 산란 강도 */
  scatterOpacity: number;
  vignetteOpacity: number;
}

/**
 * 배경 그라디언트 3단계. 어느 단계를 쓸지는 밝기(0~1)와 바퀴 수가 정하며,
 * 그 판단은 `roomStageIndex`(src/scenes/memory-room/visual-state.ts)가 한다.
 */
export const ROOM_STAGES: RoomStage[] = [
  {
    id: "dark",
    background:
      "radial-gradient(120% 90% at 50% 34%, var(--color-scene-storm) 0%, var(--color-scene-slate) 48%, var(--color-scene-abyss) 100%)",
    glowOpacity: 0.5,
    scatterOpacity: 0.3,
    vignetteOpacity: 0.55,
  },
  {
    id: "dim",
    background:
      "radial-gradient(120% 90% at 55% 32%, var(--color-scene-storm) 0%, var(--color-scene-dusk) 48%, var(--color-scene-slate) 100%)",
    glowOpacity: 0.68,
    scatterOpacity: 0.6,
    vignetteOpacity: 0.42,
  },
  {
    id: "gold",
    background:
      "radial-gradient(120% 95% at 58% 30%, var(--color-scene-olive) 0%, var(--color-scene-dusk) 46%, var(--color-scene-coal) 100%)",
    glowOpacity: 0.9,
    scatterOpacity: 1,
    vignetteOpacity: 0.3,
  },
];

export const MEMORY_BY_ID = Object.fromEntries(
  MEMORIES.map((memory) => [memory.id, memory]),
) as Record<MemoryId, MemoryItem>;

/** 해당 게임 페이즈에서 아이템에 적용되는 설정. Phase 2 미대상이면 undefined. */
export function phaseConfigOf(id: MemoryId, gamePhase: 1 | 2): MemoryPhaseConfig | undefined {
  const item = MEMORY_BY_ID[id];
  return gamePhase === 1 ? item.phase1 : item.phase2;
}

/** 대사 스크립트 레지스트리 — 본문은 i18n 리소스(memoryRoom.scripts.*)에 있다. */
export const SCRIPTS: Record<string, DialogueScript> = {
  "console-echo": {
    id: "console-echo",
    lines: [{ speaker: "hero", textKey: "scripts.console-echo.line1", expression: "smile" }],
  },
  /** 1차 라디오 진입 — 마지막 남은 물건 앞에 선 한마디. */
  "radio-intro": {
    id: "radio-intro",
    lines: [
      { speaker: "hero", textKey: "scripts.radio-intro.line1" },
      { speaker: "hero", textKey: "scripts.radio-intro.line2" },
    ],
  },
  /**
   * 재난방송. 화자가 도해가 아니라 라디오라 초상이 붙지 않는다 —
   * 이 게임에서 도해 아닌 목소리가 대사창을 쓰는 첫 자리다.
   */
  "radio-broadcast": {
    id: "radio-broadcast",
    lines: [
      { speaker: "broadcast", textKey: "scripts.radio-broadcast.line1" },
      { speaker: "broadcast", textKey: "scripts.radio-broadcast.line2" },
      { speaker: "broadcast", textKey: "scripts.radio-broadcast.line3" },
      { speaker: "broadcast", textKey: "scripts.radio-broadcast.line4" },
    ],
  },
  /** 2차 라디오 진입 — 저 혼자 지직거리는 라디오 앞에 다시 앉는다. */
  "radio-voice-intro": {
    id: "radio-voice-intro",
    lines: [{ speaker: "hero", textKey: "scripts.radio-voice-intro.line1" }],
  },
  /** 2차 결과 — 컷씬에서 스쳤던 목소리가 이번엔 또렷하게 잡힌다. */
  "radio-voice": {
    id: "radio-voice",
    lines: [
      { speaker: "signal", textKey: "scripts.radio-voice.line1" },
      { speaker: "signal", textKey: "scripts.radio-voice.line2" },
      { speaker: "hero", textKey: "scripts.radio-voice.line3", expression: "surprised" },
      { speaker: "hero", textKey: "scripts.radio-voice.line4" },
    ],
  },
  /** 액자를 다 닦은 뒤의 결과 대사 (1차). */
  "frame-photo": {
    id: "frame-photo",
    lines: [
      { speaker: "hero", textKey: "scripts.frame-photo.line1", expression: "smile" },
      { speaker: "hero", textKey: "scripts.frame-photo.line2" },
    ],
  },
  /** 2차 조사에서 가족 얼굴이 드러난 뒤의 결과 대사. */
  "frame-photo-echo": {
    id: "frame-photo-echo",
    lines: [
      { speaker: "hero", textKey: "scripts.frame-photo-echo.line1", expression: "surprised" },
      { speaker: "hero", textKey: "scripts.frame-photo-echo.line2", expression: "smile" },
    ],
  },
  "ball-intro": {
    id: "ball-intro",
    lines: [
      { speaker: "hero", textKey: "scripts.ball-intro.line1", expression: "surprised" },
      { speaker: "hero", textKey: "scripts.ball-intro.line2", expression: "smile" },
    ],
  },
  /** 2차 조사: 벽에 혼자 던지던 공이 "같이 던질 사람"의 물건으로 돌아온다. */
  "ball-echo": {
    id: "ball-echo",
    lines: [
      { speaker: "hero", textKey: "scripts.ball-echo.line1" },
      { speaker: "hero", textKey: "scripts.ball-echo.line2", expression: "smile" },
    ],
  },
};

/**
 * 재난방송이 끊긴 자리에서 도는 전환 컷씬 — 게임 중 일러스트가 화면을 통째로
 * 차지하는 유일한 자리다. 특별한 순간이라는 신호이므로 두 번 쓰지 않는다.
 *
 * 톤은 차가운 현재다. 따뜻한 과거 회상은 여기 없다 — 2바퀴에서 되찾을 온기를
 * 미리 써버리면 상승 구간이 밋밋해진다.
 */
export const CUTSCENE_RADIO_BLACKOUT = "radio-blackout";

export const CUTSCENES: Record<string, Cutscene> = {
  [CUTSCENE_RADIO_BLACKOUT]: {
    id: CUTSCENE_RADIO_BLACKOUT,
    cuts: [
      {
        image: ASSETS.images.cutsceneRadioRoom,
        lines: [{ speaker: "hero", textKey: "cutscenes.radio-blackout.cut1" }],
      },
      {
        image: ASSETS.images.cutsceneRadioHands,
        lines: [{ speaker: "hero", textKey: "cutscenes.radio-blackout.cut2" }],
        /** 말이 끊긴 자리에 남는 정적. 다음 컷의 목소리가 여기서 이질적으로 들어온다. */
        holdMs: 3200,
      },
      {
        image: ASSETS.images.cutsceneRadioSignal,
        lines: [
          { speaker: "signal", textKey: "cutscenes.radio-blackout.cut3" },
          {
            speaker: "hero",
            textKey: "cutscenes.radio-blackout.cut3Reply",
            expression: "surprised",
          },
        ],
      },
    ],
  },
};
