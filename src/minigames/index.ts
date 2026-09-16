import { lazy } from "react";
import type { MinigameDefinition } from "@/types/minigame";

/**
 * 미니게임 레지스트리. 새 미니게임은 src/minigames/<id>/index.tsx로 만들고
 * lazy import로 등록한다 (게이트 도달 직전 로드: .claude/rules/minigames.md).
 * 부착은 src/data/memory-room.ts의 phase 설정에 `interaction: { minigameId }`로.
 */
export const MINIGAMES: Record<string, MinigameDefinition> = {
  "frequency-tune": {
    id: "frequency-tune",
    mode: "overlay",
    component: lazy(() =>
      import("./frequency-tune").then((m) => ({ default: m.FrequencyTuneMinigame })),
    ),
    titleKey: "minigame.frequencyTune.title",
    helpKey: "minigame.frequencyTune.help",
    failKey: "minigame.frequencyTune.fail",
  },
  "radio-quiz": {
    id: "radio-quiz",
    mode: "overlay",
    // 1바퀴 라디오 전용: 주파수 잡기(frequency-tune 재사용) 뒤에 글자 맞추기가 이어진다.
    // 시작 카드는 첫 단계(주파수) 기준으로 안내한다. 질문은 잡고 나서야 온다.
    component: lazy(() => import("./radio-quiz").then((m) => ({ default: m.RadioQuizMinigame }))),
    titleKey: "minigame.frequencyTune.title",
    helpKey: "minigame.frequencyTune.help",
    failKey: "minigame.frequencyTune.fail",
  },
  "photo-wipe": {
    id: "photo-wipe",
    mode: "overlay",
    component: lazy(() => import("./photo-wipe").then((m) => ({ default: m.PhotoWipeMinigame }))),
    titleKey: "minigame.photoWipe.title",
    helpKey: "minigame.photoWipe.help",
    failKey: "minigame.photoWipe.fail",
  },
  "photo-puzzle": {
    id: "photo-puzzle",
    mode: "overlay",
    component: lazy(() =>
      import("./photo-puzzle").then((m) => ({ default: m.PhotoPuzzleMinigame })),
    ),
    titleKey: "minigame.photoPuzzle.title",
    helpKey: "minigame.photoPuzzle.help",
  },
  "calendar-flip": {
    id: "calendar-flip",
    mode: "overlay",
    presentation: "bare",
    component: lazy(() =>
      import("./calendar-flip").then((m) => ({ default: m.CalendarFlipMinigame })),
    ),
    titleKey: "minigame.calendarFlip.title",
    helpKey: "minigame.calendarFlip.help",
  },
  "phone-chat": {
    id: "phone-chat",
    mode: "overlay",
    presentation: "bare",
    component: lazy(() => import("./phone-chat").then((m) => ({ default: m.PhoneChatMinigame }))),
    titleKey: "minigame.phoneChat.title",
    helpKey: "minigame.phoneChat.help",
  },
  "computer-browse": {
    id: "computer-browse",
    mode: "overlay",
    // 책상 위 컴퓨터를 들여다보는 인터랙션: 패널 없이 모니터만 떠오른다
    presentation: "bare",
    component: lazy(() =>
      import("./computer-browse").then((m) => ({ default: m.ComputerBrowseMinigame })),
    ),
    titleKey: "minigame.computerBrowse.title",
    helpKey: "minigame.computerBrowse.help",
  },
  "phone-lock": {
    id: "phone-lock",
    mode: "overlay",
    // phone-chat과 같은 폰을 집어 드는 인터랙션: 패널 없이 기기만 떠오른다
    presentation: "bare",
    component: lazy(() => import("./phone-lock").then((m) => ({ default: m.PhoneLockMinigame }))),
    titleKey: "minigame.phoneLock.title",
    helpKey: "minigame.phoneLock.help",
  },
  "fighter-duel": {
    id: "fighter-duel",
    mode: "overlay",
    component: lazy(() =>
      import("./fighter-duel").then((m) => ({ default: m.FighterDuelMinigame })),
    ),
    titleKey: "minigame.fighterDuel.title",
    helpKey: "minigame.fighterDuel.help",
    /*
     * 두 줄: 상성과 필살기 횟수. 미니게임 하나 붙잡고 읽을 분량이 아니라 시작
     * 버튼을 누르기 전에 훑는 분량이어야 한다 (UT: "미니겜이니까 더 짧아도 될 듯").
     *
     * 조작은 바로 위 helpKey가 이미 말하므로 여기 다시 적지 않는다. 나머지는
     * 화면이 스스로 말한다: 남은 시간은 게이지가 줄어드는 것으로, 페인트는 자세가
     * 바뀌는 순간 붉은 글씨로, 간파·콤보는 들어간 뒤에 뜬다. 몰라도 판이 도는
     * 규칙은 카드에 적지 않는다.
     */
    rulesKeys: ["minigame.fighterDuel.rules.triangle", "minigame.fighterDuel.rules.special"],
    failKey: "minigame.fighterDuel.fail",
  },
  "window-view": {
    id: "window-view",
    mode: "overlay",
    presentation: "bare",
    component: lazy(() => import("./window-view").then((m) => ({ default: m.WindowViewMinigame }))),
    titleKey: "minigame.windowView.title",
    helpKey: "minigame.windowView.help",
  },
  "card-odd": {
    id: "card-odd",
    mode: "overlay",
    component: lazy(() => import("./card-odd").then((m) => ({ default: m.CardOddMinigame }))),
    titleKey: "minigame.cardOdd.title",
    helpKey: "minigame.cardOdd.help",
    /*
     * rulesKeys를 일부러 비운다. 이건 미니게임이 아니라 미궁 문제라, 무엇이 틀린
     * 카드인지 시작 카드에서 알려주면 문제가 통째로 사라진다. 카드가 지키는 규칙은
     * 방의 다른 오브젝트 대사에 흩어 두고, 여기서는 답 형식만 말한다.
     */
  },
  "angle-turn": {
    id: "angle-turn",
    mode: "overlay",
    component: lazy(() => import("./angle-turn").then((m) => ({ default: m.AngleTurnMinigame }))),
    titleKey: "minigame.angleTurn.title",
    helpKey: "minigame.angleTurn.help",
    // card-odd와 같은 이유로 rulesKeys를 비운다. 각도를 읽는 법은 캐비닛 위 시계에 있다
  },
  "piano-melody": {
    id: "piano-melody",
    // 씬의 피아노 그 자리에서 돈다: 뚜껑이 젖혀지고 카메라가 건반 앞에 붙박이로 선다.
    // 판을 세우는 것은 씬 쪽 호스트(src/scenes/memory-room/CanvasMinigameHost.tsx)다
    mode: "canvas",
    presentation: "bare",
    component: lazy(() =>
      import("./piano-melody").then((m) => ({ default: m.PianoMelodyMinigame })),
    ),
    titleKey: "minigame.pianoMelody.title",
    helpKey: "minigame.pianoMelody.help",
    // 규칙은 악보가 다 말한다. 적힌 대로 누르면 된다는 걸 목록으로 또 적을 이유가 없다.
    // failKey도 없다: 틀리면 처음으로 되감길 뿐, 이 문제에 "실패"라는 끝은 없다
  },
  "ampoule-pickup": {
    id: "ampoule-pickup",
    // 유일한 canvas 모드: 씬의 냉장고 그 자리에서 서랍이 열리고 앰플이 손에 들린다.
    // 호스트는 씬 쪽(src/scenes/memory-room/CanvasMinigameHost.tsx). 카드 없이 물건만.
    mode: "canvas",
    presentation: "bare",
    component: lazy(() =>
      import("./ampoule-pickup").then((m) => ({ default: m.AmpoulePickupMinigame })),
    ),
    titleKey: "minigame.ampoulePickup.title",
    helpKey: "minigame.ampoulePickup.help",
  },
  "ball-catch": {
    id: "ball-catch",
    mode: "overlay",
    component: lazy(() => import("./ball-catch").then((m) => ({ default: m.BallCatchMinigame }))),
    titleKey: "minigame.ballCatch.title",
    helpKey: "minigame.ballCatch.help",
    failKey: "minigame.ballCatch.fail",
  },
};

export function getMinigame(id: string): MinigameDefinition | undefined {
  return MINIGAMES[id];
}
