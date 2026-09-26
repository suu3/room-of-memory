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
  "mom-chat": {
    id: "mom-chat",
    mode: "overlay",
    // phone-chat과 같은 폰을 집어 드는 인터랙션: 패널 없이 기기만 떠오른다.
    // 폰 2차 (v4 3-4): 1막 내내 미뤄 둔 엄마 대화방을 다시 연다. 그날 이미 읽은 마지막 문자
    presentation: "bare",
    component: lazy(() => import("./mom-chat").then((m) => ({ default: m.MomChatMinigame }))),
    titleKey: "minigame.momChat.title",
    helpKey: "minigame.momChat.help",
  },
  "computer-logo": {
    id: "computer-logo",
    mode: "overlay",
    // 컴퓨터 3차 (v4 3-5): 앰플 라벨의 로고 조각을 메일 첨부·캐시 뉴스의 로고와 맞춘다
    presentation: "bare",
    component: lazy(() =>
      import("./computer-logo").then((m) => ({ default: m.ComputerLogoMinigame })),
    ),
    titleKey: "minigame.computerLogo.title",
    helpKey: "minigame.computerLogo.help",
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
     * 한 줄: 삼각 상성만. 시작 버튼을 누르기 전에 훑는 분량이어야 한다 (UT: "게임
     * 설명이 너무 길다"). 프레임·카운터는 몰라도 판이 돈다: 들어간 뒤 화면이 알려 준다.
     * 조작은 helpKey와 화면 안 조작판이 이미 말한다.
     */
    rulesKeys: ["minigame.fighterDuel.rules.triangle"],
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
  // ── 3D 인스펙트 (v4.1 2장): 집어 든 물건을 돌려 찾을 면을 본다 ──────────────
  "card-flip": {
    id: "card-flip",
    mode: "overlay",
    presentation: "bare",
    component: lazy(() => import("./inspect").then((m) => ({ default: m.CardFlipMinigame }))),
    titleKey: "minigame.cardFlip.title",
    helpKey: "minigame.inspect.help",
  },
  "id-card-flip": {
    id: "id-card-flip",
    mode: "overlay",
    presentation: "bare",
    component: lazy(() => import("./inspect").then((m) => ({ default: m.IdCardFlipMinigame }))),
    titleKey: "minigame.idCardFlip.title",
    helpKey: "minigame.inspect.help",
  },
  "ampoule-case": {
    id: "ampoule-case",
    mode: "overlay",
    presentation: "bare",
    component: lazy(() => import("./inspect").then((m) => ({ default: m.AmpouleCaseMinigame }))),
    titleKey: "minigame.ampouleCase.title",
    helpKey: "minigame.inspect.help",
  },
  "papers-order": {
    id: "papers-order",
    // 안방 책상 위 서류 조각을 날짜순으로 (v4.1 7장). 여행이 아니었다는 소집 공지도 이 안에 있다
    mode: "overlay",
    component: lazy(() =>
      import("./papers-order").then((m) => ({ default: m.PapersOrderMinigame })),
    ),
    titleKey: "minigame.papersOrder.title",
    helpKey: "minigame.papersOrder.help",
  },
  "sink-dial": {
    id: "sink-dial",
    // 세면대 하부장의 2자리 다이얼 (v4 3-5). 미궁 문제(PuzzleHost)로 돈다. 답은 등번호 11
    mode: "overlay",
    component: lazy(() => import("./sink-dial").then((m) => ({ default: m.SinkDialMinigame }))),
    titleKey: "minigame.sinkDial.title",
    helpKey: "minigame.sinkDial.help",
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
