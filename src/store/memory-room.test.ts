import { beforeEach, describe, expect, it } from "vitest";
import {
  CUTSCENE_BAT_GRIP,
  CUTSCENE_P2_CLOSE,
  CUTSCENE_P4_CLOSE,
  CUTSCENE_RADIO_BLACKOUT,
  CUTSCENE_TRIP_DOUBT,
  CUTSCENE_WORKBOOK_NAME,
  CUTSCENES,
  MEMORIES,
  MEMORY_BY_ID,
  type MemoryId,
  PHASE1_MEMORIES,
  REPLAY_MORPH_WITHIN,
  SCRIPTS,
} from "@/data/memory-room";
import { requiredVisits } from "@/data/story-phase";
import {
  ACT2_TOTAL,
  actOf,
  actTwoProgress,
  buildMemoryReplay,
  clueUnlocked,
  hotspotStatus,
  isAtCurtain,
  itemSpent,
  openCutscene,
  selectBatReady,
  selectCarrying,
  selectDeadline,
  selectDoorReady,
  selectDoorwayReady,
  selectEndingReady,
  selectExitReady,
  selectHeardSurvivorBroadcast,
  selectHeroNameKnown,
  selectIdCardFlipped,
  selectMomChatRead,
  selectMonologueHidden,
  selectMusicPhase,
  selectMusicPlaying,
  selectOnboardingStep,
  selectPackedCount,
  selectPacking,
  selectPapersOrdered,
  selectRadioSignaling,
  selectResultMusic,
  selectSceneInputLocked,
  selectSignalSilenceRunning,
  selectSinkHintRead,
  selectStillBeatDone,
  selectViewpoint,
  storyPhase,
  tripDoubted,
  useMemoryRoomStore,
} from "./memory-room";

describe("scene input locks", () => {
  beforeEach(() => useMemoryRoomStore.getState().reset());

  it("stays locked until every UI source closes", () => {
    const store = useMemoryRoomStore.getState();
    store.setUiLock("hud-menu", true);
    store.setUiLock("character-sheet", true);
    store.setUiLock("hud-menu", false);
    expect(selectSceneInputLocked(useMemoryRoomStore.getState())).toBe(true);
    store.setUiLock("character-sheet", false);
    expect(selectSceneInputLocked(useMemoryRoomStore.getState())).toBe(false);
  });

  it("locks scene input for an active interaction without UI locks", () => {
    useMemoryRoomStore.getState().beginInteraction("report-card");

    expect(selectSceneInputLocked(useMemoryRoomStore.getState())).toBe(true);
  });

  it("clears UI locks when gameplay progress resets", () => {
    const store = useMemoryRoomStore.getState();
    store.setUiLock("hud-menu", true);
    store.reset();

    expect(selectSceneInputLocked(useMemoryRoomStore.getState())).toBe(false);
    expect(useMemoryRoomStore.getState().uiLocks).toEqual([]);
  });
});

describe("앉기", () => {
  beforeEach(() => useMemoryRoomStore.getState().reset());

  it("자리에 앉고 일어선다", () => {
    const store = useMemoryRoomStore.getState();
    store.sitOnSeat("sofa-center");
    expect(useMemoryRoomStore.getState().seatedAt).toBe("sofa-center");

    // 앉은 채로 다른 자리를 누르면 그리로 옮겨 앉는다. 일어서라고 두 번 시키지 않는다.
    store.sitOnSeat("piano-bench");
    expect(useMemoryRoomStore.getState().seatedAt).toBe("piano-bench");

    store.standUp();
    expect(useMemoryRoomStore.getState().seatedAt).toBe(null);
  });

  it("대사·미니게임이 떠 있으면 앉지 않는다", () => {
    const store = useMemoryRoomStore.getState();
    store.setUiLock("character-sheet", true);
    store.sitOnSeat("desk-chair");

    expect(useMemoryRoomStore.getState().seatedAt).toBe(null);
  });

  it("리셋하면 일어선다. 몸은 시작 자리로 돌아간다", () => {
    const store = useMemoryRoomStore.getState();
    store.sitOnSeat("desk-chair");
    store.reset();

    expect(useMemoryRoomStore.getState().seatedAt).toBe(null);
  });
});

describe("바닥 클릭 이동", () => {
  beforeEach(() => useMemoryRoomStore.getState().reset());

  it("시작한 뒤에만 목표가 잡히고, 앉아 있던 몸은 일어나고 커튼 몸짓은 접힌다", () => {
    const store = useMemoryRoomStore.getState();
    store.walkTo(1, 2);
    expect(useMemoryRoomStore.getState().walkTarget).toBe(null);

    store.startGame();
    store.sitOnSeat("desk-chair");
    store.walkTo(1, 2);
    expect(useMemoryRoomStore.getState().walkTarget).toEqual({ x: 1, z: 2 });
    expect(useMemoryRoomStore.getState().seatedAt).toBe(null);

    store.grabCurtain("left");
    store.walkTo(3, 4);
    expect(useMemoryRoomStore.getState().curtainGrab).toBe(null);
    expect(useMemoryRoomStore.getState().walkTarget).toEqual({ x: 3, z: 4 });

    store.clearWalk();
    expect(useMemoryRoomStore.getState().walkTarget).toBe(null);
  });

  it("대사 중이면 걷지 않고, 워프·리셋은 목표를 지운다", () => {
    const store = useMemoryRoomStore.getState();
    store.startGame();
    store.setUiLock("character-sheet", true);
    store.walkTo(1, 2);
    expect(useMemoryRoomStore.getState().walkTarget).toBe(null);
    store.setUiLock("character-sheet", false);

    store.walkTo(1, 2);
    store.warpPlayer(0, 0);
    expect(useMemoryRoomStore.getState().walkTarget).toBe(null);

    store.walkTo(1, 2);
    store.reset();
    expect(useMemoryRoomStore.getState().walkTarget).toBe(null);
  });
});

describe("커튼 잡기", () => {
  beforeEach(() => useMemoryRoomStore.getState().reset());

  it("잡으면 창가로 가는 몸짓이 시작되고, 닿아야 커튼이 손을 따른다", () => {
    const store = useMemoryRoomStore.getState();
    store.grabCurtain("left");
    expect(useMemoryRoomStore.getState().curtainGrab).toEqual({
      side: "left",
      held: true,
      arrived: false,
    });
    expect(isAtCurtain(useMemoryRoomStore.getState())).toBe(false);

    store.arriveAtCurtain();
    expect(isAtCurtain(useMemoryRoomStore.getState())).toBe(true);

    // 놓아도 몸짓은 남는다. 팔을 내리는 건 Player가 끝낸다.
    store.releaseCurtain();
    expect(useMemoryRoomStore.getState().curtainGrab).toEqual({
      side: "left",
      held: false,
      arrived: true,
    });
    store.endCurtainGrab();
    expect(useMemoryRoomStore.getState().curtainGrab).toBe(null);
  });

  it("앉아 있거나 대사 중이면 잡지 않는다", () => {
    const store = useMemoryRoomStore.getState();
    store.sitOnSeat("desk-chair");
    store.grabCurtain("right");
    expect(useMemoryRoomStore.getState().curtainGrab).toBe(null);

    store.standUp();
    store.setUiLock("character-sheet", true);
    store.grabCurtain("right");
    expect(useMemoryRoomStore.getState().curtainGrab).toBe(null);
  });

  it("리셋과 워프는 몸짓을 지운다", () => {
    const store = useMemoryRoomStore.getState();
    store.grabCurtain("left");
    store.warpPlayer(0, 0);
    expect(useMemoryRoomStore.getState().curtainGrab).toBe(null);

    store.grabCurtain("left");
    store.reset();
    expect(useMemoryRoomStore.getState().curtainGrab).toBe(null);
  });
});

describe("minigame result dialogue", () => {
  beforeEach(() => useMemoryRoomStore.getState().reset());

  // 액자는 강도 2라 강도 1 둘(게임기·공)을 본 뒤에 열린다
  const openFrame = () => useMemoryRoomStore.setState({ collected: ["console", "ball"] });

  it("plays the result script over the minigame, then completes the memory", () => {
    openFrame();
    useMemoryRoomStore.getState().beginInteraction("frame");
    useMemoryRoomStore.getState().finishMinigame({ cleared: true });

    const active = useMemoryRoomStore.getState().activeInteraction;
    expect(active?.phase).toBe("dialogue");
    expect(active?.scriptId).toBe("frame-photo");
    // 미니게임 화면이 대사창 뒤에 남는다
    expect(active?.keepMinigame).toBe(true);

    // 줄을 끝까지 넘기면 인터랙션이 끝나고 기억이 수집된다
    const lines = SCRIPTS["frame-photo"].lines.length;
    useMemoryRoomStore.getState().advanceDialogue();
    expect(useMemoryRoomStore.getState().activeInteraction?.lineIndex).toBe(1);
    for (let step = 1; step < lines; step += 1) useMemoryRoomStore.getState().advanceDialogue();

    expect(useMemoryRoomStore.getState().activeInteraction).toBeNull();
    expect(useMemoryRoomStore.getState().collected).toEqual(["console", "ball", "frame"]);
  });

  it("closes without collecting when the minigame is failed, and stays retryable", () => {
    openFrame();
    useMemoryRoomStore.getState().beginInteraction("frame");
    useMemoryRoomStore.getState().finishMinigame({ cleared: false });

    // 결과 대사도 없고 수집도 없다. 못 되찾은 기억을 되찾았다고 적지 않는다
    expect(useMemoryRoomStore.getState().activeInteraction).toBeNull();
    expect(useMemoryRoomStore.getState().collected).toEqual(["console", "ball"]);

    // 막다른 길이 되면 안 된다: 핫스팟은 그대로 눌러서 다시 붙을 수 있다
    expect(hotspotStatus(useMemoryRoomStore.getState(), "frame")).toBe("available");
    useMemoryRoomStore.getState().beginInteraction("frame");
    expect(useMemoryRoomStore.getState().activeInteraction?.memoryId).toBe("frame");
  });

  it("still collects when the player skips, since skipping reports cleared", () => {
    openFrame();
    useMemoryRoomStore.getState().beginInteraction("frame");
    // 접근성 계약상 스킵은 cleared: true다 (src/types/minigame.ts)
    useMemoryRoomStore.getState().finishMinigame({ cleared: true });
    for (const _ of SCRIPTS["frame-photo"].lines) useMemoryRoomStore.getState().advanceDialogue();

    expect(useMemoryRoomStore.getState().collected).toEqual(["console", "ball", "frame"]);
  });
});

describe("수집한 기억 다시보기", () => {
  beforeEach(() => useMemoryRoomStore.getState().reset());

  /**
   * 대사든 미니게임이든 나오는 대로 밀어붙여 인터랙션 하나를 끝낸다.
   * 단계 수에 상한을 둔 이유: 시나리오 데이터가 바뀌어 끝나지 않는 인터랙션이
   * 생기면 테스트가 멎는 대신 여기서 바로 터져야 한다.
   */
  function pushToEnd(label: string) {
    for (let step = 0; step < 32; step += 1) {
      const active = useMemoryRoomStore.getState().activeInteraction;
      if (!active) {
        // 조사를 마치며 뜬 컷씬(1페이즈 회상 등)은 다시보기와 무관하니 닫고 끝낸다
        for (let n = 0; n < 8 && useMemoryRoomStore.getState().activePlayback; n += 1) {
          useMemoryRoomStore.getState().endPlayback();
        }
        return;
      }
      if (active.phase === "minigame") {
        useMemoryRoomStore.getState().finishMinigame({ cleared: true });
      } else {
        useMemoryRoomStore.getState().advanceDialogue();
      }
    }
    throw new Error(`인터랙션이 끝나지 않는다: ${label}`);
  }

  /** ball은 대사로 시작하는 기억이라 재생이 대사부터 다시 도는지 보기 좋다. */
  function collectBall() {
    // 강도 1은 성적표(강도 0) 뒤에 열린다
    useMemoryRoomStore.setState({ collected: ["report-card"] });
    useMemoryRoomStore.getState().beginInteraction("ball");
    pushToEnd("ball");
  }

  it("아직 수집하지 않은 기억은 재생되지 않는다", () => {
    useMemoryRoomStore.getState().replayMemory("ball");

    expect(useMemoryRoomStore.getState().activePlayback).toBeNull();
  });

  it("수집한 기억은 그때의 수첩 기록 한 줄로 다시 선다", () => {
    collectBall();
    useMemoryRoomStore.getState().replayMemory("ball");

    const playback = useMemoryRoomStore.getState().activePlayback;
    expect(playback?.kind).toBe("replay");
    expect(playback?.memoryId).toBe("ball");
    expect(playback?.lineIndex).toBe(0);
    // 도입(라디오가 꺼지는 비트)은 컷씬만의 것이다
    expect(playback?.intro).toBe(false);
    expect(playback?.cuts[0].lines).toEqual([{ speaker: "narrator", textKey: "lore.ball.phase1" }]);
  });

  /** 이 규칙이 이 기능의 전부다. 되짚기가 재도전이 되면 안 된다. */
  it("미니게임을 다시 열지 않는다", () => {
    collectBall();
    useMemoryRoomStore.getState().replayMemory("ball");

    expect(useMemoryRoomStore.getState().activeInteraction).toBeNull();
  });

  it("대사를 다시 틀지 않는다. 그림과 기록 한 줄만 선다", () => {
    useMemoryRoomStore.setState({ collected: ["console", "ball"] });
    useMemoryRoomStore.getState().beginInteraction("frame");
    pushToEnd("frame");
    useMemoryRoomStore.getState().replayMemory("frame");

    const playback = useMemoryRoomStore.getState().activePlayback;
    expect(playback?.cuts[0].lines).toEqual([
      { speaker: "narrator", textKey: "lore.frame.phase1" },
    ]);
    // 그때 본 사진이 대사 뒤에 선다
    expect(playback?.cuts[0].image).toBeDefined();
  });

  it("어떤 기억의 다시보기도 빈 줄로 서지 않는다", () => {
    useMemoryRoomStore.setState({
      collected: PHASE1_MEMORIES.map((memory) => memory.id),
      // 1바퀴가 없는 기억(컴퓨터)은 2바퀴 재조사가 다시보기를 여는 열쇠다
      revisited: MEMORIES.filter((memory) => !memory.phase1).map((memory) => memory.id),
    });

    for (const memory of MEMORIES) {
      useMemoryRoomStore.getState().replayMemory(memory.id);
      const playback = useMemoryRoomStore.getState().activePlayback;
      expect(playback?.cuts[0].lines.length, memory.id).toBeGreaterThan(0);
      useMemoryRoomStore.getState().endPlayback();
    }
  });

  it("2바퀴까지 본 기억은 마지막으로 본 쪽을 되돌려준다", () => {
    useMemoryRoomStore.setState({
      collected: PHASE1_MEMORIES.map((memory) => memory.id),
      revisited: ["radio", "ball"],
    });
    useMemoryRoomStore.getState().replayMemory("ball");

    expect(useMemoryRoomStore.getState().activePlayback?.cuts[0].lines).toEqual([
      { speaker: "narrator", textKey: "lore.ball.phase2" },
    ]);
  });

  it("재생이 끝나도 수집·재조사 기록이 늘지 않는다", () => {
    collectBall();
    const before = useMemoryRoomStore.getState();
    const collected = [...before.collected];
    const revisited = [...before.revisited];

    useMemoryRoomStore.getState().replayMemory("ball");
    for (let step = 0; step < 32 && useMemoryRoomStore.getState().activePlayback; step += 1) {
      useMemoryRoomStore.getState().advancePlayback();
    }

    const after = useMemoryRoomStore.getState();
    expect(after.collected).toEqual(collected);
    expect(after.revisited).toEqual(revisited);
    expect(after.activePlayback).toBeNull();
  });

  it("다른 인터랙션이 진행 중이면 재생을 시작하지 않는다", () => {
    collectBall();
    useMemoryRoomStore.getState().beginInteraction("console");

    useMemoryRoomStore.getState().replayMemory("ball");

    expect(useMemoryRoomStore.getState().activePlayback).toBeNull();
  });

  it("다시보기 중에는 BGM이 멎지 않는다. 정적은 컷씬의 것이다", () => {
    useMemoryRoomStore.getState().startGame();
    // 곡은 스위치를 켠 뒤부터다 (selectMusicPlaying)
    useMemoryRoomStore.getState().toggleLights();
    collectBall();
    useMemoryRoomStore.getState().replayMemory("ball");

    expect(selectMusicPlaying(useMemoryRoomStore.getState())).toBe(true);
  });

  it("타이틀 곡은 resultMusic이 걸린 결과 대사 동안만, 방 곡이 흐르는 자리에서만 든다", () => {
    useMemoryRoomStore.getState().startGame();
    useMemoryRoomStore.getState().toggleLights();
    const resultDialogue = {
      memoryId: "frame" as const,
      gamePhase: 1 as const,
      phase: "dialogue" as const,
      scriptId: "frame-photo",
      keepMinigame: true,
      lineIndex: 0,
    };

    useMemoryRoomStore.setState({ activeInteraction: resultDialogue });
    expect(selectResultMusic(useMemoryRoomStore.getState())).toBe("title");

    // 미니게임 앞의 진입 대사는 아니다
    useMemoryRoomStore.setState({
      activeInteraction: { ...resultDialogue, keepMinigame: undefined },
    });
    expect(selectResultMusic(useMemoryRoomStore.getState())).toBeNull();

    // 걸려 있지 않은 결과 대사는 방 곡 그대로
    useMemoryRoomStore.setState({
      activeInteraction: { ...resultDialogue, memoryId: "ball", scriptId: "ball-alone" },
    });
    expect(selectResultMusic(useMemoryRoomStore.getState())).toBeNull();

    // 곡이 멎은 자리(엔딩)에서는 정적을 깨지 않는다
    useMemoryRoomStore.setState({ activeInteraction: resultDialogue, endingStarted: true });
    expect(selectResultMusic(useMemoryRoomStore.getState())).toBeNull();
  });

  it("2바퀴 곡은 수집 완료가 아니라 문이 열려야 든다", () => {
    // 6개를 다 모으면 gamePhase는 2지만, 문이 열리기 전까지는 아직 1바퀴의 끝자락이다
    useMemoryRoomStore.setState({ collected: PHASE1_MEMORIES.map((memory) => memory.id) });
    expect(selectMusicPhase(useMemoryRoomStore.getState())).toBe(1);

    useMemoryRoomStore.setState({ doorOpened: true });
    expect(selectMusicPhase(useMemoryRoomStore.getState())).toBe(2);
  });
});

/** 대사든 미니게임이든 나오는 대로 밀어붙여 지금 인터랙션을 끝낸다. */
function finishInteraction(label: string) {
  for (let step = 0; step < 32; step += 1) {
    const active = useMemoryRoomStore.getState().activeInteraction;
    if (!active) return;
    if (active.phase === "minigame")
      useMemoryRoomStore.getState().finishMinigame({ cleared: true });
    else useMemoryRoomStore.getState().advanceDialogue();
  }
  throw new Error(`인터랙션이 끝나지 않는다: ${label}`);
}

/** 그 조사 칸들을 마친 진행. */
function progressOf(refs: readonly { id: MemoryId; visit: number }[]) {
  const pick = (visit: number) => refs.filter((ref) => ref.visit === visit).map((ref) => ref.id);
  return { collected: pick(1), revisited: pick(2), rechecked: pick(3) };
}

type PhaseStart = "turning" | "p2" | "p3" | "p4" | "resolve";

/** 그 페이즈에 막 들어선 순간 (곁가지 없이, 앞 페이즈의 필수 조사만 마친 상태). */
function enterPhase(phase: PhaseStart) {
  const order: PhaseStart[] = ["turning", "p2", "p3", "p4", "resolve"];
  const at = order.indexOf(phase);
  const refs = [...requiredVisits("p1")];
  if (at >= 1) refs.push(...requiredVisits("turning"));
  if (at >= 2) refs.push(...requiredVisits("p2"));
  if (at >= 3) refs.push(...requiredVisits("p3"));
  if (at >= 4) refs.push(...requiredVisits("p4"));
  useMemoryRoomStore.setState({
    ...progressOf(refs),
    introDone: true,
    doorOpened: at >= 1,
    openedDoorways:
      at >= 3 ? ["living-bathroom", "living-parents"] : at >= 1 ? ["living-bathroom"] : [],
    inventory: at >= 3 ? ["parents-key"] : [],
    solvedPuzzles: at >= 3 ? ["sink-dial"] : [],
  });
  expect(storyPhase(useMemoryRoomStore.getState())).toBe(phase);
}

const status = (id: MemoryId) => hotspotStatus(useMemoryRoomStore.getState(), id);

describe("v4 페이즈: 진행에서 파생된다", () => {
  beforeEach(() => useMemoryRoomStore.getState().reset());

  it("새 게임은 인트로, 불을 켜면 p1", () => {
    useMemoryRoomStore.getState().startGame();
    expect(storyPhase(useMemoryRoomStore.getState())).toBe("intro");
    useMemoryRoomStore.getState().toggleLights();
    expect(storyPhase(useMemoryRoomStore.getState())).toBe("p1");
  });

  it("기한은 방송 뒤부터 나흘이고, 하루 안의 일이라 페이즈가 넘어가도 줄지 않는다", () => {
    enterPhase("turning");
    expect(selectDeadline(useMemoryRoomStore.getState())).toBeNull();
    enterPhase("p2");
    expect(selectDeadline(useMemoryRoomStore.getState())).toBe(4);
    enterPhase("p3");
    expect(selectDeadline(useMemoryRoomStore.getState())).toBe(4);
    enterPhase("resolve");
    expect(selectDeadline(useMemoryRoomStore.getState())).toBe(4);
  });

  it("막은 문과 비트가 긋는다: 방문이 열리면 2막, 정적 비트 뒤가 3막", () => {
    enterPhase("turning");
    expect(actOf(useMemoryRoomStore.getState())).toBe(1);
    enterPhase("p4");
    expect(actOf(useMemoryRoomStore.getState())).toBe(2);
    enterPhase("resolve");
    expect(actOf(useMemoryRoomStore.getState())).toBe(3);
    expect(selectEndingReady(useMemoryRoomStore.getState())).toBe(true);
  });
});

describe("1페이즈 첫머리: 문제집 → 수첩", () => {
  beforeEach(() => {
    useMemoryRoomStore.getState().reset();
    useMemoryRoomStore.setState({ introDone: true });
  });

  const step = () => selectOnboardingStep(useMemoryRoomStore.getState());

  it("불 켜기 전에는 안내가 없다", () => {
    useMemoryRoomStore.setState({ introDone: false });
    expect(step()).toBeNull();
  });

  it("이름을 알기 전에는 문제집만 부르고 강도 0도 잠겨 있다", () => {
    expect(step()).toBe("workbook");
    expect(status("report-card")).toBe("locked");
    expect(status("console")).toBe("locked");
    expect(status("ball")).toBe("locked");
    useMemoryRoomStore.getState().beginInteraction("console");
    expect(useMemoryRoomStore.getState().activeInteraction).toBeNull();
  });

  it("문제집 뒤표지를 보면 강도 0(성적표)이 열리고 수첩이 부른다. 막지는 않는다", () => {
    useMemoryRoomStore.getState().discover("hero-name");
    expect(step()).toBe("notebook");
    expect(status("report-card")).toBe("available");
    // 야구 회상(강도 1)은 성적표 뒤다
    expect(status("console")).toBe("locked");
    expect(status("ball")).toBe("locked");
  });

  it("문제집에서 이름을 찾고 내려놓는 순간 자기소개가 한 번 흐른다", () => {
    useMemoryRoomStore.setState({ activeClue: "workbook" });
    useMemoryRoomStore.getState().discover("hero-name");
    // 인스펙트 화면 위로는 겹치지 않는다
    expect(useMemoryRoomStore.getState().activePlayback).toBeNull();
    useMemoryRoomStore.getState().closeClue();
    expect(useMemoryRoomStore.getState().activePlayback?.cutsceneId).toBe(CUTSCENE_WORKBOOK_NAME);

    // 다시 집어 들었다 내려놓아도 또 흐르지 않는다
    useMemoryRoomStore.setState({ activePlayback: null, activeClue: "workbook" });
    useMemoryRoomStore.getState().discover("hero-name");
    useMemoryRoomStore.getState().closeClue();
    expect(useMemoryRoomStore.getState().activePlayback).toBeNull();
  });

  it("수첩을 한 번 펼치면 안내가 끝난다", () => {
    useMemoryRoomStore.getState().discover("hero-name");
    useMemoryRoomStore.getState().setCharacterSheetOpen(true, "lore");
    useMemoryRoomStore.getState().setCharacterSheetOpen(false);
    expect(step()).toBeNull();
  });

  it("수첩을 안 열어도 기억을 하나 보면 안내가 끝난다", () => {
    useMemoryRoomStore.setState({ discoveries: ["hero-name"], collected: ["console"] });
    expect(step()).toBeNull();
  });

  it("리셋하면 수첩도 처음 보는 것으로 돌아간다", () => {
    useMemoryRoomStore.getState().setCharacterSheetOpen(true);
    useMemoryRoomStore.getState().reset();
    expect(useMemoryRoomStore.getState().notebookOpened).toBe(false);
  });
});

describe("1페이즈: 강도 순서대로 열린다", () => {
  beforeEach(() => {
    useMemoryRoomStore.getState().reset();
    useMemoryRoomStore.setState({ introDone: true });
  });

  const collect = (...ids: MemoryId[]) => useMemoryRoomStore.setState({ collected: ids });

  it("처음에는 강도 0(성적표)만 열린다", () => {
    useMemoryRoomStore.setState({ discoveries: ["hero-name"] });
    expect(status("report-card")).toBe("available");
    for (const id of [
      "console",
      "ball",
      "frame",
      "phone",
      "calendar",
      "window",
      "radio",
    ] as const) {
      expect(status(id)).toBe("locked");
    }
  });

  it("성적표를 보면 강도 1(게임기·공)이 열린다", () => {
    collect("report-card");
    expect(status("console")).toBe("available");
    expect(status("ball")).toBe("available");
    expect(status("frame")).toBe("locked");
  });

  it("강도 1 둘을 보면 강도 2(액자·폰)가 열린다", () => {
    collect("console");
    expect(status("frame")).toBe("locked");
    collect("console", "ball");
    expect(status("frame")).toBe("available");
    expect(status("phone")).toBe("available");
    expect(status("calendar")).toBe("locked");
    expect(status("window")).toBe("locked");
  });

  it("달력은 폰 뒤, 창문은 강도 2 둘 뒤에 열린다", () => {
    collect("console", "ball", "phone");
    expect(status("calendar")).toBe("available");
    expect(status("window")).toBe("locked");
    collect("console", "ball", "phone", "frame");
    expect(status("window")).toBe("available");
  });

  it("라디오는 일곱을 다 봐야 열린다", () => {
    collect("console", "ball", "phone", "frame", "calendar", "window");
    expect(status("radio")).toBe("locked");
    collect("report-card", "console", "ball", "phone", "frame", "calendar", "window");
    expect(status("radio")).toBe("available");
  });

  it("1페이즈의 컴퓨터는 꺼진 배경이다. 잠겨 있고 본 적도 없다", () => {
    expect(status("computer")).toBe("locked");
    useMemoryRoomStore.getState().sayRemark("computer-off");
    expect(useMemoryRoomStore.getState().remark?.id).toBe("computer-off");
  });

  it("이미 본 기억의 혼잣말은 어느 기억인지 같이 남긴다", () => {
    useMemoryRoomStore.getState().sayRemark("seen", "cards" as MemoryId);
    const remark = useMemoryRoomStore.getState().remark;
    expect(remark?.id).toBe("seen");
    expect(remark?.memoryId).toBe("cards");
  });
});

describe("분기점: 라디오", () => {
  beforeEach(() => useMemoryRoomStore.getState().reset());

  function collectAllButRadio() {
    useMemoryRoomStore.setState({
      introDone: true,
      collected: PHASE1_MEMORIES.map((memory) => memory.id).filter((id) => id !== "radio"),
    });
  }

  it("진입 대사 → 튜닝 → 라디오가 꺼지고 재난방송 컷씬 순으로 흐른다", () => {
    collectAllButRadio();
    useMemoryRoomStore.getState().beginInteraction("radio");

    expect(useMemoryRoomStore.getState().activeInteraction?.scriptId).toBe("radio-intro");
    useMemoryRoomStore.getState().advanceDialogue();
    useMemoryRoomStore.getState().advanceDialogue();
    expect(useMemoryRoomStore.getState().activeInteraction?.phase).toBe("minigame");

    useMemoryRoomStore.getState().finishMinigame({ cleared: true });

    // 결과 대사 없이 판이 닫히고, 라디오가 꺼지는 도입부터 컷씬이 흐른다
    const state = useMemoryRoomStore.getState();
    expect(state.activeInteraction).toBeNull();
    expect(state.activePlayback?.cutsceneId).toBe(CUTSCENE_RADIO_BLACKOUT);
    expect(state.activePlayback?.intro).toBe(true);
    // 꺼진 라디오 앞의 한 줄 → 정적 → 방송(속말과 함께)
    const [noise, silence, broadcast] = state.activePlayback?.cuts ?? [];
    expect(noise?.black).toBe(true);
    expect(silence?.lines).toHaveLength(0);
    expect(silence?.holdMs).toBeGreaterThan(0);
    expect(broadcast?.lines[0]?.speaker).toBe("broadcast");
    expect(broadcast?.whisperKeys?.length).toBe(2);
  });

  it("라디오 2차는 곧장 생존자 방송이다. 끝나면 방문이 금빛이다", () => {
    enterPhase("turning");
    // 과거편에서 돌아온 정적: 라디오는 꺼져 있고 2차도 안 열린다
    expect(selectRadioSignaling(useMemoryRoomStore.getState())).toBe(false);
    useMemoryRoomStore.getState().beginInteraction("radio");
    expect(useMemoryRoomStore.getState().activePlayback).toBeNull();
    useMemoryRoomStore.getState().catchSignal();
    expect(selectRadioSignaling(useMemoryRoomStore.getState())).toBe(true);
    expect(selectDoorReady(useMemoryRoomStore.getState())).toBe(false);

    useMemoryRoomStore.getState().beginInteraction("radio");
    const playback = useMemoryRoomStore.getState().activePlayback;
    expect(playback?.cutsceneId).toBe("survivor-broadcast");
    // 3페이지 웹툰이고, 첫 칸은 16:9에 마이크를 탁, 탁 두드린다
    expect(playback?.cuts[0].page).toBe(1);
    expect(playback?.cuts[0].ratio).toBe("16:9");
    expect(playback?.cuts[0].sfx).toBe("mittTap");
    expect(selectHeardSurvivorBroadcast(useMemoryRoomStore.getState())).toBe(true);

    useMemoryRoomStore.getState().endPlayback();
    expect(selectDoorReady(useMemoryRoomStore.getState())).toBe(true);
    useMemoryRoomStore.getState().openRoomDoor();
    expect(storyPhase(useMemoryRoomStore.getState())).toBe("p2");
  });
});

describe("2페이즈: 거실과 컴퓨터 → 엄마 대화방", () => {
  beforeEach(() => useMemoryRoomStore.getState().reset());

  it("거실 넷과 컴퓨터는 순서 없이 열리고, 폰 2차만 컴퓨터를 기다린다", () => {
    enterPhase("p2");
    for (const id of ["duffel", "fridge", "shoes", "cards", "computer"] as const) {
      expect(status(id)).toBe("available");
    }
    expect(status("phone")).toBe("locked");
    useMemoryRoomStore.setState({
      revisited: [...useMemoryRoomStore.getState().revisited, "computer"],
    });
    expect(status("phone")).toBe("available");
    // 3페이즈의 것들은 아직이다
    expect(status("ampoule")).toBe("locked");
  });

  it("곁가지(게임기·공의 2차)는 열려 있지만 페이즈를 막지 않는다", () => {
    enterPhase("p2");
    expect(status("console")).toBe("available");
    expect(status("ball")).toBe("available");
    expect(requiredVisits("p2").map((ref) => ref.id)).not.toContain("console");
  });

  it("마지막 필수 조사를 마치는 순간 p2-close가 흐르고 3페이즈다", () => {
    enterPhase("p2");
    const allButPhone = requiredVisits("p2").filter((ref) => ref.id !== "phone");
    useMemoryRoomStore.setState({
      revisited: [...useMemoryRoomStore.getState().revisited, ...allButPhone.map((ref) => ref.id)],
    });
    expect(storyPhase(useMemoryRoomStore.getState())).toBe("p2");

    useMemoryRoomStore.getState().beginInteraction("phone");
    expect(useMemoryRoomStore.getState().activeInteraction?.scriptId).toBe("phone-mom-intro");
    finishInteraction("phone");

    const state = useMemoryRoomStore.getState();
    expect(selectMomChatRead(state)).toBe(true);
    expect(storyPhase(state)).toBe("p3");
    expect(state.activePlayback?.cutsceneId).toBe(CUTSCENE_P2_CLOSE);
  });
});

describe("v4.1 추리: 캐리어 개수와 컷씬 줄", () => {
  beforeEach(() => useMemoryRoomStore.getState().reset());

  it("신발장과 아빠 메일을 둘 다 보면 trip-doubt가 흐른다. 한쪽만으로는 안 흐른다", () => {
    enterPhase("p2");
    useMemoryRoomStore.getState().beginInteraction("shoes");
    finishInteraction("shoes");
    expect(tripDoubted(useMemoryRoomStore.getState())).toBe(false);
    expect(useMemoryRoomStore.getState().activePlayback).toBeNull();

    useMemoryRoomStore.getState().beginInteraction("computer");
    finishInteraction("computer");
    const state = useMemoryRoomStore.getState();
    expect(tripDoubted(state)).toBe(true);
    expect(state.activePlayback?.cutsceneId).toBe(CUTSCENE_TRIP_DOUBT);
  });

  it("한 조사가 컷씬 둘을 부르면 줄을 서서 차례로 흐른다 (trip-doubt → p2-close)", () => {
    enterPhase("p2");
    const allButComputer = requiredVisits("p2").filter((ref) => ref.id !== "computer");
    useMemoryRoomStore.setState({
      revisited: [
        ...useMemoryRoomStore.getState().revisited,
        ...allButComputer.map((ref) => ref.id),
      ],
    });
    useMemoryRoomStore.getState().beginInteraction("computer");
    finishInteraction("computer");

    expect(useMemoryRoomStore.getState().activePlayback?.cutsceneId).toBe(CUTSCENE_TRIP_DOUBT);
    expect(useMemoryRoomStore.getState().queuedPlaybacks.map((p) => p.cutsceneId)).toEqual([
      CUTSCENE_P2_CLOSE,
    ]);
    // 건너뛰어도 줄의 다음 것이 선다
    useMemoryRoomStore.getState().endPlayback();
    expect(useMemoryRoomStore.getState().activePlayback?.cutsceneId).toBe(CUTSCENE_P2_CLOSE);
    useMemoryRoomStore.getState().endPlayback();
    expect(useMemoryRoomStore.getState().activePlayback).toBeNull();
    expect(useMemoryRoomStore.getState().queuedPlaybacks).toEqual([]);
  });

  it("거꾸로 꽂힌 책은 아빠 메일(컴퓨터 3차)을 읽은 뒤에야 집힌다", () => {
    enterPhase("p3");
    expect(clueUnlocked(useMemoryRoomStore.getState(), "shelf-book")).toBe(false);
    useMemoryRoomStore.setState({ rechecked: ["computer"] });
    expect(clueUnlocked(useMemoryRoomStore.getState(), "shelf-book")).toBe(true);
  });
});

describe("3페이즈: 앰플 → 로고 → 하부장 → 안방 열쇠", () => {
  beforeEach(() => useMemoryRoomStore.getState().reset());

  it("앰플이 먼저, 컴퓨터 3차는 앰플 뒤에 열린다", () => {
    enterPhase("p3");
    expect(status("ampoule")).toBe("available");
    // 컴퓨터는 2차를 봤고 3차가 앰플을 기다린다
    expect(status("computer")).toBe("locked");
    useMemoryRoomStore.setState({
      revisited: [...useMemoryRoomStore.getState().revisited, "ampoule"],
    });
    expect(status("computer")).toBe("available");
  });

  it("앰플은 대사 → 집기 → 결과 대사 순이고, 작별의 회상은 없다", () => {
    enterPhase("p3");
    useMemoryRoomStore.getState().beginInteraction("ampoule");
    finishInteraction("ampoule");
    const state = useMemoryRoomStore.getState();
    expect(state.revisited).toContain("ampoule");
    expect(state.activePlayback).toBeNull();
  });

  it("악보 조각 없이 피아노를 열면 판은 서되 빈 마디의 한 줄이 먼저 뜨고, 그때부터 조각이 부른다", () => {
    enterPhase("p3");
    expect(useMemoryRoomStore.getState().pianoGapSeen).toBe(false);
    useMemoryRoomStore.getState().openPuzzle("piano-melody");
    let state = useMemoryRoomStore.getState();
    expect(state.activePuzzle).toBe("piano-melody");
    expect(state.pianoGapSeen).toBe(true);
    expect(state.remark?.id).toBe("needs-item");

    // 조각을 들고 열면 줄 없이 곧장 판이다
    useMemoryRoomStore.getState().closePuzzle();
    useMemoryRoomStore.setState({ remark: null, inventory: ["piano-sheet"] });
    useMemoryRoomStore.getState().openPuzzle("piano-melody");
    state = useMemoryRoomStore.getState();
    expect(state.activePuzzle).toBe("piano-melody");
    expect(state.remark).toBeNull();
  });

  it("아빠 힌트 전에는 하부장을 못 연다. 힌트 뒤에 열면 안방 열쇠가 손에 들어온다", () => {
    enterPhase("p3");
    useMemoryRoomStore.getState().openPuzzle("sink-dial");
    expect(useMemoryRoomStore.getState().activePuzzle).toBeNull();

    useMemoryRoomStore.setState({
      revisited: [...useMemoryRoomStore.getState().revisited, "ampoule"],
      rechecked: ["computer"],
    });
    // 메일만으로는 모른다: 거꾸로 꽂힌 책의 "11"을 봐야 번호를 안다 (v4.1)
    expect(selectSinkHintRead(useMemoryRoomStore.getState())).toBe(false);
    useMemoryRoomStore.getState().openPuzzle("sink-dial");
    expect(useMemoryRoomStore.getState().activePuzzle).toBeNull();
    useMemoryRoomStore.getState().discover("sink-code");
    expect(selectSinkHintRead(useMemoryRoomStore.getState())).toBe(true);
    useMemoryRoomStore.getState().openPuzzle("sink-dial");
    expect(useMemoryRoomStore.getState().activePuzzle).toBe("sink-dial");
    useMemoryRoomStore.getState().finishPuzzle({ cleared: true });

    const state = useMemoryRoomStore.getState();
    expect(state.inventory).toContain("parents-key");
    expect(state.remark?.id).toBe("sink-open");
    expect(selectDoorwayReady("living-parents")(state)).toBe(true);
    state.openDoorway("living-parents");
    expect(storyPhase(useMemoryRoomStore.getState())).toBe("p4");
  });

  it("하부장이 열리면 카메라가 열쇠로 밀고 들어간다. 그동안 입력은 잠기고, 놓으면 풀린다", () => {
    enterPhase("p3");
    useMemoryRoomStore.setState({
      revisited: [...useMemoryRoomStore.getState().revisited, "ampoule"],
      rechecked: ["computer"],
    });
    useMemoryRoomStore.getState().discover("sink-code");
    useMemoryRoomStore.getState().openPuzzle("sink-dial");
    expect(useMemoryRoomStore.getState().cameraHold).toBeNull();

    // 못 풀고 내려놓으면 카메라는 그대로다
    useMemoryRoomStore.getState().finishPuzzle({ cleared: false });
    expect(useMemoryRoomStore.getState().cameraHold).toBeNull();

    useMemoryRoomStore.getState().openPuzzle("sink-dial");
    useMemoryRoomStore.getState().finishPuzzle({ cleared: true });
    const held = useMemoryRoomStore.getState();
    expect(held.cameraHold).toBe("sink-cabinet");
    expect(selectSceneInputLocked(held)).toBe(true);

    held.endCameraHold();
    const released = useMemoryRoomStore.getState();
    expect(released.cameraHold).toBeNull();
    expect(selectSceneInputLocked(released)).toBe(false);
    // 놓는 것은 한 번뿐이다. 다시 놓아도 아무 일도 없다
    released.endCameraHold();
    expect(useMemoryRoomStore.getState()).toBe(released);
  });

  it("리셋하면 붙들린 카메라도 놓는다", () => {
    useMemoryRoomStore.setState({ cameraHold: "sink-cabinet" });
    useMemoryRoomStore.getState().reset();
    expect(useMemoryRoomStore.getState().cameraHold).toBeNull();
  });
});

describe("4페이즈: 안방 → 액자 → 정적 비트", () => {
  beforeEach(() => useMemoryRoomStore.getState().reset());

  it("안방(p4)은 곡이 없다. 정적 비트를 지나 결심에 들어서면 다시 든다 (The Birds)", () => {
    enterPhase("p3");
    useMemoryRoomStore.setState({ started: true });
    expect(selectMusicPlaying(useMemoryRoomStore.getState())).toBe(true);

    enterPhase("p4");
    useMemoryRoomStore.setState({ started: true });
    expect(selectMusicPlaying(useMemoryRoomStore.getState())).toBe(false);

    enterPhase("resolve");
    useMemoryRoomStore.setState({ started: true });
    expect(selectMusicPlaying(useMemoryRoomStore.getState())).toBe(true);
  });

  it("서류 순서와 출입증을 마치면 p4-close가 흐르고 액자 2차가 열린다", () => {
    enterPhase("p4");
    expect(status("frame")).toBe("locked");
    useMemoryRoomStore.setState({
      revisited: [...useMemoryRoomStore.getState().revisited, "research-note"],
    });
    expect(selectPapersOrdered(useMemoryRoomStore.getState())).toBe(true);
    expect(selectIdCardFlipped(useMemoryRoomStore.getState())).toBe(false);
    useMemoryRoomStore.getState().beginInteraction("id-card");
    finishInteraction("id-card");

    const state = useMemoryRoomStore.getState();
    expect(state.activePlayback?.cutsceneId).toBe(CUTSCENE_P4_CLOSE);
    expect(status("frame")).toBe("available");
  });

  it("액자 2차가 끝나면 정적 비트가 흐르고, 그게 끝나야 배트가 빛난다", () => {
    enterPhase("p4");
    useMemoryRoomStore.setState({
      revisited: [...useMemoryRoomStore.getState().revisited, "research-note", "id-card"],
    });
    useMemoryRoomStore.getState().beginInteraction("frame");
    finishInteraction("frame");

    const beat = useMemoryRoomStore.getState().activePlayback;
    expect(beat?.cutsceneId).toBe("still-beat");
    // 첫 컷은 대사 없는 정적이다
    expect(beat?.holding).toBe(true);
    expect(selectStillBeatDone(useMemoryRoomStore.getState())).toBe(true);
    expect(selectBatReady(useMemoryRoomStore.getState())).toBe(false);
    // 음악도 멎어 있다 (컷씬)
    expect(selectMusicPlaying(useMemoryRoomStore.getState())).toBe(false);

    useMemoryRoomStore.getState().endPlayback();
    expect(selectBatReady(useMemoryRoomStore.getState())).toBe(true);
  });
});

describe("결심: 챙길 것(가방 · 앰플 · 배트) · 현관문", () => {
  beforeEach(() => useMemoryRoomStore.getState().reset());

  it("피아노를 안 풀어도, 곁가지를 안 봐도 결심에 닿는다", () => {
    enterPhase("resolve");
    const state = useMemoryRoomStore.getState();
    expect(state.solvedPuzzles).not.toContain("piano-melody");
    expect(state.revisited).not.toContain("console");
  });

  it("배트를 쥐기 전에는 현관문이 안 열린다", () => {
    enterPhase("resolve");
    useMemoryRoomStore.getState().startEnding();
    expect(useMemoryRoomStore.getState().endingStarted).toBe(false);
  });

  it("결심에 들어서면 가방·앰플·배트가 한꺼번에 열린다. 순서는 없다", () => {
    enterPhase("resolve");
    const state = useMemoryRoomStore.getState();
    expect(hotspotStatus(state, "duffel" as MemoryId)).toBe("available");
    expect(hotspotStatus(state, "ampoule" as MemoryId)).toBe("available");
    expect(selectBatReady(state)).toBe(true);
    expect(selectPacking(state)).toBe(true);
    expect(selectPackedCount(state)).toBe(0);
  });

  it("배트만 쥐어서는 현관문이 안 열린다: 가방과 앰플도 챙겨야 한다", () => {
    enterPhase("resolve");
    useMemoryRoomStore.setState({ batTaken: true, rechecked: ["duffel" as MemoryId] });
    expect(selectPackedCount(useMemoryRoomStore.getState())).toBe(2);
    expect(selectExitReady(useMemoryRoomStore.getState())).toBe(false);
    useMemoryRoomStore.getState().startEnding();
    expect(useMemoryRoomStore.getState().endingStarted).toBe(false);
  });

  it("셋을 다 챙기면 현관문이 열린다. 잠금 퍼즐은 없다", () => {
    enterPhase("resolve");
    const { rechecked } = useMemoryRoomStore.getState();
    useMemoryRoomStore.setState({
      batTaken: true,
      rechecked: [...rechecked, "duffel" as MemoryId, "ampoule" as MemoryId],
    });
    expect(selectPacking(useMemoryRoomStore.getState())).toBe(false);
    expect(selectExitReady(useMemoryRoomStore.getState())).toBe(true);
    useMemoryRoomStore.getState().startEnding();
    expect(useMemoryRoomStore.getState().endingStarted).toBe(true);
    expect(storyPhase(useMemoryRoomStore.getState())).toBe("ending");
  });

  it("리셋하면 엔딩도 처음으로 돌아간다", () => {
    enterPhase("resolve");
    const { rechecked } = useMemoryRoomStore.getState();
    useMemoryRoomStore.setState({
      batTaken: true,
      rechecked: [...rechecked, "duffel" as MemoryId, "ampoule" as MemoryId],
    });
    useMemoryRoomStore.getState().startEnding();
    expect(useMemoryRoomStore.getState().endingStarted).toBe(true);

    useMemoryRoomStore.getState().reset();

    const state = useMemoryRoomStore.getState();
    expect(state.endingStarted).toBe(false);
    expect(state.batTaken).toBe(false);
    expect(state.rechecked).toEqual([]);
    expect(actOf(state)).toBe(1);
  });
});

describe("밝기 상승 곡선의 분모", () => {
  beforeEach(() => useMemoryRoomStore.getState().reset());

  it("필수 조사만 센다. 곁가지는 분자에도 분모에도 없다", () => {
    useMemoryRoomStore.setState({ revisited: ["radio", "console", "ball"] });
    expect(actTwoProgress(useMemoryRoomStore.getState())).toBeCloseTo(1 / ACT2_TOTAL);
  });

  it("결심에 닿으면 1이다", () => {
    enterPhase("resolve");
    expect(actTwoProgress(useMemoryRoomStore.getState())).toBe(1);
  });
});

describe("전환 컷씬", () => {
  beforeEach(() => useMemoryRoomStore.getState().reset());

  /** 재난방송이 끝나 1바퀴를 완주한 직후 상태로 밀어넣는다. */
  function finishFirstRound() {
    useMemoryRoomStore.setState({
      collected: PHASE1_MEMORIES.map((memory) => memory.id).filter((id) => id !== "radio"),
    });
    useMemoryRoomStore.getState().beginInteraction("radio");
    for (let step = 0; step < 32; step += 1) {
      const active = useMemoryRoomStore.getState().activeInteraction;
      if (!active) return;
      if (active.phase === "minigame")
        useMemoryRoomStore.getState().finishMinigame({ cleared: true });
      else useMemoryRoomStore.getState().advanceDialogue();
    }
    throw new Error("라디오 인터랙션이 끝나지 않는다");
  }

  it("1바퀴를 완주하면 컷씬이 열린다", () => {
    finishFirstRound();

    const cutscene = useMemoryRoomStore.getState().activePlayback;
    expect(cutscene?.kind).toBe("cutscene");
    expect(cutscene?.cutsceneId).toBe(CUTSCENE_RADIO_BLACKOUT);
    // 첫 컷보다 라디오가 꺼지는 도입이 먼저다
    expect(cutscene?.intro).toBe(true);
  });

  it("컷씬이 떠 있는 동안에는 다른 조사를 시작할 수 없다", () => {
    finishFirstRound();

    expect(selectSceneInputLocked(useMemoryRoomStore.getState())).toBe(true);
    useMemoryRoomStore.getState().beginInteraction("radio");
    expect(useMemoryRoomStore.getState().activeInteraction).toBeNull();
  });

  it("도입 → 컷 → 정적 → 마지막 컷을 지나면 닫힌다", () => {
    finishFirstRound();
    const cuts = CUTSCENES[CUTSCENE_RADIO_BLACKOUT].cuts;
    const steps: string[] = [];

    for (let step = 0; step < 64; step += 1) {
      const active = useMemoryRoomStore.getState().activePlayback;
      if (!active) break;
      steps.push(
        active.intro ? "intro" : active.holding ? "hold" : `${active.cutIndex}:${active.lineIndex}`,
      );
      useMemoryRoomStore.getState().advancePlayback();
    }

    const expected = [
      "intro",
      ...cuts.flatMap((cut, cutIndex) => [
        ...cut.lines.map((_line, lineIndex) => `${cutIndex}:${lineIndex}`),
        ...(cut.holdMs ? ["hold"] : []),
      ]),
    ];
    expect(steps).toEqual(expected);
    expect(useMemoryRoomStore.getState().activePlayback).toBeNull();
  });

  it("라디오 목소리를 잡아야 방문이 열린다", () => {
    // 순서: 1바퀴 끝 → 라디오가 다시 켜짐 → 목소리(revisited) → 문. 1바퀴를 다
    // 돌았다고 바로 열리면 라디오가 부르는 연출이 통째로 건너뛰어진다
    finishFirstRound();
    expect(selectDoorReady(useMemoryRoomStore.getState())).toBe(false);

    useMemoryRoomStore.setState({ revisited: ["radio"] });

    expect(selectDoorReady(useMemoryRoomStore.getState())).toBe(true);
  });

  it("한 번 연 문은 다시 열 대상이 아니다", () => {
    finishFirstRound();
    useMemoryRoomStore.setState({ revisited: ["radio"] });
    useMemoryRoomStore.getState().openRoomDoor();

    expect(useMemoryRoomStore.getState().doorOpened).toBe(true);
    expect(selectDoorReady(useMemoryRoomStore.getState())).toBe(false);
  });

  it("컷씬이 끝나면 라디오가 저 혼자 지직거린다", () => {
    finishFirstRound();
    expect(selectRadioSignaling(useMemoryRoomStore.getState())).toBe(false);

    useMemoryRoomStore.getState().endPlayback();

    // 곧장 깨어나지 않는다. 정적이 먼저 흐른다 (SignalCatch가 시간을 잰다)
    expect(selectRadioSignaling(useMemoryRoomStore.getState())).toBe(false);
    useMemoryRoomStore.setState({ started: true });
    expect(selectSignalSilenceRunning(useMemoryRoomStore.getState())).toBe(true);
    useMemoryRoomStore.getState().catchSignal();
    expect(selectRadioSignaling(useMemoryRoomStore.getState())).toBe(true);
    expect(selectSignalSilenceRunning(useMemoryRoomStore.getState())).toBe(false);
    // 목소리를 잡고 나면 더는 부르지 않는다
    useMemoryRoomStore.setState({ revisited: ["radio"] });
    expect(selectRadioSignaling(useMemoryRoomStore.getState())).toBe(false);
  });

  it("전환 구간은 통째로 정적이다. 곡은 방문이 열려야 다시 든다", () => {
    useMemoryRoomStore.getState().startGame();
    expect(selectMusicPlaying(useMemoryRoomStore.getState())).toBe(false);
    // 새 게임은 불 꺼진 인트로에서 시작한다. 스위치를 켜야 조사가 열리고 곡이 든다
    useMemoryRoomStore.getState().toggleLights();
    expect(selectMusicPlaying(useMemoryRoomStore.getState())).toBe(true);
    finishFirstRound();

    // 컷씬 중
    expect(selectMusicPlaying(useMemoryRoomStore.getState())).toBe(false);
    // 컷씬이 끝나도 라디오가 저 혼자 말을 거는 동안은 정적이 이어진다
    useMemoryRoomStore.getState().endPlayback();
    expect(selectMusicPlaying(useMemoryRoomStore.getState())).toBe(false);

    // 방문이 열리는 순간, 2막 곡이 그 정적 위에 처음 든다
    useMemoryRoomStore.setState({ revisited: ["radio"] });
    useMemoryRoomStore.getState().openRoomDoor();
    expect(selectMusicPlaying(useMemoryRoomStore.getState())).toBe(true);
    expect(selectMusicPhase(useMemoryRoomStore.getState())).toBe(2);
  });
});

describe("현관의 배트: 대사를 거쳐 손에 들어온다", () => {
  beforeEach(() => useMemoryRoomStore.getState().reset());

  it("결심 전에는 쥐어도 아무 일도 없다", () => {
    enterPhase("p4");
    useMemoryRoomStore.getState().takeBat();

    expect(useMemoryRoomStore.getState().activePlayback).toBeNull();
    expect(useMemoryRoomStore.getState().batTaken).toBe(false);
  });

  it("쥐면 먼저 대사가 뜬다. 라디오 도입 없이", () => {
    enterPhase("resolve");
    useMemoryRoomStore.getState().takeBat();

    const playback = useMemoryRoomStore.getState().activePlayback;
    expect(playback?.kind).toBe("cutscene");
    expect(playback?.cutsceneId).toBe(CUTSCENE_BAT_GRIP);
    expect(playback?.intro).toBe(false);
    expect(useMemoryRoomStore.getState().batTaken).toBe(false);
  });

  it("대사를 끝까지 넘기면 그때 배트가 손에 들어온다", () => {
    enterPhase("resolve");
    useMemoryRoomStore.getState().takeBat();

    for (let step = 0; step < 16 && useMemoryRoomStore.getState().activePlayback; step += 1) {
      useMemoryRoomStore.getState().advancePlayback();
    }

    expect(useMemoryRoomStore.getState().activePlayback).toBeNull();
    expect(useMemoryRoomStore.getState().batTaken).toBe(true);
  });

  it("대사를 건너뛰어도 배트는 손에 들어온다", () => {
    enterPhase("resolve");
    useMemoryRoomStore.getState().takeBat();
    useMemoryRoomStore.getState().endPlayback();

    expect(useMemoryRoomStore.getState().batTaken).toBe(true);
  });

  it("다른 재생이 도는 중에는 쥘 수 없다", () => {
    enterPhase("resolve");
    useMemoryRoomStore.setState({ activePlayback: openCutscene(CUTSCENE_RADIO_BLACKOUT) });

    useMemoryRoomStore.getState().takeBat();

    expect(useMemoryRoomStore.getState().activePlayback?.cutsceneId).toBe(CUTSCENE_RADIO_BLACKOUT);
    useMemoryRoomStore.getState().endPlayback();
    expect(useMemoryRoomStore.getState().batTaken).toBe(false);
  });
});

describe("2차 이후 조사 대상", () => {
  it("2차가 있는 기억 목록", () => {
    const revisitable = MEMORIES.filter((memory) => memory.phase2)
      .map((memory) => memory.id)
      .sort();

    expect(revisitable).toEqual([
      "ampoule",
      "ball",
      "cards",
      "computer",
      "duffel",
      "frame",
      "fridge",
      "id-card",
      "console",
      "phone",
      "radio",
      "research-note",
      "shoes",
    ]);
  });

  it("3차는 컴퓨터(로고)와, 떠나기 전 챙기는 가방·앰플이다", () => {
    expect(MEMORIES.filter((memory) => memory.phase3).map((memory) => memory.id)).toEqual([
      "duffel",
      "computer",
      "ampoule",
    ]);
    expect(requiredVisits("resolve").map((ref) => ref.id)).toEqual(["duffel", "ampoule"]);
  });
});

describe("미궁 문제: 피아노 멜로디 자물쇠", () => {
  beforeEach(() => useMemoryRoomStore.getState().reset());

  it("붙잡고 → 풀면 solvedPuzzles에 남고, 다시는 안 열린다", () => {
    useMemoryRoomStore.getState().openPuzzle("piano-melody");
    expect(useMemoryRoomStore.getState().activePuzzle).toBe("piano-melody");

    useMemoryRoomStore.getState().finishPuzzle({ cleared: true });

    const state = useMemoryRoomStore.getState();
    expect(state.activePuzzle).toBeNull();
    expect(state.solvedPuzzles).toContain("piano-melody");

    state.openPuzzle("piano-melody");
    expect(useMemoryRoomStore.getState().activePuzzle).toBeNull();
  });

  it("내려놓으면 아무것도 안 남는다. 물건은 다시 클릭할 수 있다", () => {
    useMemoryRoomStore.getState().openPuzzle("piano-melody");
    useMemoryRoomStore.getState().closePuzzle();

    const state = useMemoryRoomStore.getState();
    expect(state.activePuzzle).toBeNull();
    expect(state.solvedPuzzles).toEqual([]);

    state.openPuzzle("piano-melody");
    expect(useMemoryRoomStore.getState().activePuzzle).toBe("piano-melody");
  });

  it("풀린 순간에는 결과 카드가 서고, 넘기기 전까지 보상도 닫기도 없다", () => {
    const store = useMemoryRoomStore.getState();
    store.openPuzzle("piano-melody");
    store.settlePuzzle();

    let state = useMemoryRoomStore.getState();
    expect(state.puzzleCleared).toBe(true);
    expect(state.activePuzzle).toBe("piano-melody");
    expect(state.solvedPuzzles).toEqual([]);

    // 풀린 판은 내려놓을 수 없다: 푼 것이 사라지면 안 된다
    state.closePuzzle();
    expect(useMemoryRoomStore.getState().activePuzzle).toBe("piano-melody");

    // 카드의 "계속"
    state.finishPuzzle({ cleared: true });
    state = useMemoryRoomStore.getState();
    expect(state.puzzleCleared).toBe(false);
    expect(state.activePuzzle).toBeNull();
    expect(state.solvedPuzzles).toContain("piano-melody");
    expect(state.remark?.id).toBe("piano-done");
  });

  it("다른 화면이 떠 있으면 문제가 열리지 않는다", () => {
    useMemoryRoomStore.getState().openClue("drawer-note");

    useMemoryRoomStore.getState().openPuzzle("piano-melody");

    expect(useMemoryRoomStore.getState().activePuzzle).toBeNull();
  });

  it("문제가 떠 있는 동안 씬 입력이 잠긴다", () => {
    useMemoryRoomStore.getState().openPuzzle("piano-melody");

    expect(selectSceneInputLocked(useMemoryRoomStore.getState())).toBe(true);
  });

  it("리셋하면 푼 문제도 처음으로 돌아간다", () => {
    useMemoryRoomStore.getState().openPuzzle("piano-melody");
    useMemoryRoomStore.getState().finishPuzzle({ cleared: true });

    useMemoryRoomStore.getState().reset();

    expect(useMemoryRoomStore.getState().solvedPuzzles).toEqual([]);
  });
});

describe("discoveries", () => {
  beforeEach(() => useMemoryRoomStore.getState().reset());

  it("문제집 뒤표지를 보면 이름을 알게 되고, 두 번 봐도 한 번만 적힌다", () => {
    expect(selectHeroNameKnown(useMemoryRoomStore.getState())).toBe(false);

    useMemoryRoomStore.getState().discover("hero-name");
    useMemoryRoomStore.getState().discover("hero-name");

    expect(useMemoryRoomStore.getState().discoveries).toEqual(["hero-name"]);
    expect(selectHeroNameKnown(useMemoryRoomStore.getState())).toBe(true);
  });

  it("문제집은 처음부터 집어 들 수 있다: 조사를 기다리는 단서가 아니다", () => {
    useMemoryRoomStore.getState().openClue("workbook");

    expect(useMemoryRoomStore.getState().activeClue).toBe("workbook");
  });

  it("새 게임을 시작하면 이름도 다시 모른다", () => {
    useMemoryRoomStore.getState().discover("hero-name");
    useMemoryRoomStore.getState().reset();

    expect(useMemoryRoomStore.getState().discoveries).toEqual([]);
  });
});

describe("1인칭 구간: 인트로와 2막 도입", () => {
  beforeEach(() => useMemoryRoomStore.getState().reset());

  it("타이틀에서는 1인칭이 아니다. 새 게임을 시작하면 불 꺼진 방의 인트로다", () => {
    expect(selectViewpoint(useMemoryRoomStore.getState())).toBeNull();

    useMemoryRoomStore.getState().startGame();

    const state = useMemoryRoomStore.getState();
    expect(state.lightsOn).toBe(false);
    expect(selectViewpoint(state)).toBe("intro");
  });

  it("스위치를 켜는 첫 순간이 인트로의 끝이다. 그 뒤로는 그냥 스위치다", () => {
    useMemoryRoomStore.getState().startGame();
    useMemoryRoomStore.getState().toggleLights();

    let state = useMemoryRoomStore.getState();
    expect(state.lightsOn).toBe(true);
    expect(state.introDone).toBe(true);
    expect(selectViewpoint(state)).toBeNull();

    useMemoryRoomStore.getState().toggleLights();
    state = useMemoryRoomStore.getState();
    expect(state.lightsOn).toBe(false);
    expect(selectViewpoint(state)).toBeNull();
  });

  it("인트로를 지난 저장본으로 시작하면 불을 건드리지 않는다", () => {
    useMemoryRoomStore.setState({ introDone: true, lightsOn: false });
    useMemoryRoomStore.getState().startGame();

    expect(useMemoryRoomStore.getState().lightsOn).toBe(false);
    expect(selectViewpoint(useMemoryRoomStore.getState())).toBeNull();
  });

  it("1인칭에 있는 동안은 조사·앉기·커튼이 막힌다. 할 일은 스위치 하나다", () => {
    useMemoryRoomStore.getState().startGame();

    useMemoryRoomStore.getState().beginInteraction("console");
    useMemoryRoomStore.getState().sitOnSeat("desk-chair");
    useMemoryRoomStore.getState().grabCurtain("left");

    const state = useMemoryRoomStore.getState();
    expect(state.activeInteraction).toBeNull();
    expect(state.seatedAt).toBeNull();
    expect(state.curtainGrab).toBeNull();
    // 단서 화면(거울 포함)도 안 열린다. 어둠 속에 다른 볼거리를 두면 스위치를 안 찾는다
    useMemoryRoomStore.getState().openClue("mirror");
    expect(useMemoryRoomStore.getState().activeClue).toBeNull();

    useMemoryRoomStore.getState().toggleLights();
    useMemoryRoomStore.getState().openClue("mirror");
    expect(useMemoryRoomStore.getState().activeClue).toBe("mirror");
  });

  it("방문이 열리면 문 넘기가 시작되고, 거실에 처음 들어서는 순간 끝난다", () => {
    useMemoryRoomStore.setState({
      started: true,
      introDone: true,
      collected: PHASE1_MEMORIES.map((memory) => memory.id),
      revisited: ["radio"],
    });
    expect(selectViewpoint(useMemoryRoomStore.getState())).toBeNull();

    useMemoryRoomStore.getState().openRoomDoor();
    expect(selectViewpoint(useMemoryRoomStore.getState())).toBe("doorway");

    useMemoryRoomStore.getState().setSpace("living");
    const state = useMemoryRoomStore.getState();
    expect(state.doorwayDone).toBe(true);
    expect(selectViewpoint(state)).toBeNull();

    // 그 뒤의 왕복은 이동이다. 다시 방으로, 다시 거실로 가도 1인칭에 안 들어간다
    useMemoryRoomStore.getState().setSpace("room");
    useMemoryRoomStore.getState().setSpace("living");
    expect(selectViewpoint(useMemoryRoomStore.getState())).toBeNull();
  });

  it("현관문을 열면(엔딩) 문턱을 넘는 1인칭이다. 리셋하면 타이틀로 돌아와 풀린다", () => {
    useMemoryRoomStore.setState({ started: true, introDone: true, doorwayDone: true });
    expect(selectViewpoint(useMemoryRoomStore.getState())).toBeNull();

    useMemoryRoomStore.setState({ endingStarted: true });
    expect(selectViewpoint(useMemoryRoomStore.getState())).toBe("exit");

    useMemoryRoomStore.getState().reset();
    expect(selectViewpoint(useMemoryRoomStore.getState())).toBeNull();
  });

  it("문이 열리기 전에 거실 판정이 켜져도(개발 도구) 문 넘기를 마친 것으로 적지 않는다", () => {
    useMemoryRoomStore.setState({ started: true, introDone: true });
    useMemoryRoomStore.getState().setSpace("living");

    expect(useMemoryRoomStore.getState().doorwayDone).toBe(false);
  });

  it("엔딩이 시작되면 다른 구간이 남았어도 문턱 넘기다. 새 게임은 두 구간을 다시 연다", () => {
    useMemoryRoomStore.setState({ started: true, introDone: false, endingStarted: true });
    expect(selectViewpoint(useMemoryRoomStore.getState())).toBe("exit");

    useMemoryRoomStore.setState({ introDone: true, doorwayDone: true, lightsOn: false });
    useMemoryRoomStore.getState().reset();
    const state = useMemoryRoomStore.getState();
    expect(state.introDone).toBe(false);
    expect(state.doorwayDone).toBe(false);
    expect(state.lightsOn).toBe(true);
  });
});

describe("방탈출 축 (임시): 물건과 문", () => {
  beforeEach(() => useMemoryRoomStore.getState().reset());

  const openTheRoomDoor = () =>
    useMemoryRoomStore.setState({
      started: true,
      introDone: true,
      collected: PHASE1_MEMORIES.map((memory) => memory.id),
      revisited: ["radio"],
      doorOpened: true,
    });

  it("물건은 한 번만 집히고, 새 게임에서 사라진다", () => {
    useMemoryRoomStore.getState().takeItem("parents-key");
    useMemoryRoomStore.getState().takeItem("parents-key");
    expect(useMemoryRoomStore.getState().inventory).toEqual(["parents-key"]);

    useMemoryRoomStore.getState().reset();
    expect(useMemoryRoomStore.getState().inventory).toEqual([]);
  });

  it("거실 너머의 문은 방문이 열린 뒤에만, 규칙의 물건이 있어야 열린다", () => {
    // 방문이 닫혀 있으면 화장실 문도 안 열린다
    useMemoryRoomStore.getState().openDoorway("living-bathroom");
    expect(useMemoryRoomStore.getState().openedDoorways).toEqual([]);

    openTheRoomDoor();
    expect(selectDoorwayReady("living-bathroom")(useMemoryRoomStore.getState())).toBe(true);
    expect(selectDoorwayReady("living-parents")(useMemoryRoomStore.getState())).toBe(false);
    useMemoryRoomStore.getState().openDoorway("living-bathroom");
    useMemoryRoomStore.getState().openDoorway("living-parents");
    expect(useMemoryRoomStore.getState().openedDoorways).toEqual(["living-bathroom"]);

    // 세면대의 열쇠를 집으면 안방 문이 켜진다
    useMemoryRoomStore.getState().takeItem("parents-key");
    expect(selectDoorwayReady("living-parents")(useMemoryRoomStore.getState())).toBe(true);
    useMemoryRoomStore.getState().openDoorway("living-parents");
    expect(useMemoryRoomStore.getState().openedDoorways).toEqual([
      "living-bathroom",
      "living-parents",
    ]);
    // 열린 문은 더는 "열 수 있는" 문이 아니다 (금빛이 꺼진다)
    expect(selectDoorwayReady("living-parents")(useMemoryRoomStore.getState())).toBe(false);
  });

  it("방문은 openDoorway로 못 연다. 그 문은 라디오 목소리가 연다", () => {
    openTheRoomDoor();
    useMemoryRoomStore.setState({ doorOpened: false });
    useMemoryRoomStore.getState().openDoorway("room-living");
    expect(useMemoryRoomStore.getState().doorOpened).toBe(false);
  });
});

describe("warpPlayer puts down what the player was looking into", () => {
  it("closes an open puzzle so the piano camera does not stay behind", () => {
    const store = useMemoryRoomStore.getState();
    store.reset();
    store.startGame();
    store.openPuzzle("piano-melody");
    expect(useMemoryRoomStore.getState().activePuzzle).toBe("piano-melody");

    store.warpPlayer(0, 0);
    expect(useMemoryRoomStore.getState().activePuzzle).toBe(null);
    expect(useMemoryRoomStore.getState().warpTarget).toEqual({ x: 0, z: 0 });
  });

  it("leaves a dialogue-stage interaction alone", () => {
    const store = useMemoryRoomStore.getState();
    store.reset();
    store.startGame();
    store.warpPlayer(1, 1);
    expect(useMemoryRoomStore.getState().activeInteraction).toBe(null);
  });
});

/*
 * 액자는 같은 장면의 그림을 두 장 가진 유일한 기억이다. 2바퀴에 되짚으면 1막의 한
 * 장으로 열었다가 2막의 한 장으로 밀어 넘긴다 (PhotoMorph). 겹쳐 세우는 사각형까지
 * 함께 실려야 넘어가는 동안 물체가 둘로 보이지 않는다.
 */
describe("다시보기의 사진 밀림", () => {
  it("2바퀴의 액자는 1막 사진에서 열리고, 겹쳐 세울 자리를 함께 싣는다", () => {
    const cut = buildMemoryReplay("frame", 2)?.cuts[0];
    expect(cut?.morphFrom).toBe(MEMORY_BY_ID.frame.phase1?.replayStill);
    expect(cut?.image).toBe(MEMORY_BY_ID.frame.phase2?.replayStill);
    expect(cut?.morphFrom).not.toBe(cut?.image);
    expect(cut?.morphWithin).toEqual(REPLAY_MORPH_WITHIN.frame);
  });

  it("1바퀴에는 밀림이 없다. 되짚을 앞 그림이 아직 없다", () => {
    expect(buildMemoryReplay("frame", 1)?.cuts[0].morphFrom).toBeUndefined();
  });

  it("한쪽 바퀴에만 그림이 있는 기억은 그냥 선다: 갈 곳 없는 밀림을 만들지 않는다", () => {
    // 사인볼은 1막에만 그림이 있다. 2막에는 밀려 들어올 그림이 없다
    const cut = buildMemoryReplay("ball", 2)?.cuts[0];
    expect(MEMORY_BY_ID.ball.phase1?.replayStill).toBeDefined();
    expect(MEMORY_BY_ID.ball.phase2?.replayStill).toBeUndefined();
    expect(cut?.morphFrom).toBeUndefined();
    expect(cut?.morphWithin).toBeUndefined();
  });
});

describe("selectMonologueHidden", () => {
  beforeEach(() => useMemoryRoomStore.getState().reset());

  it("메뉴 패널이 내려와 있는 동안 혼잣말이 물러난다. 좁은 화면에서 패널이 그 줄을 덮는다", () => {
    expect(selectMonologueHidden(useMemoryRoomStore.getState())).toBe(false);
    useMemoryRoomStore.getState().setUiLock("hud-menu", true);
    expect(selectMonologueHidden(useMemoryRoomStore.getState())).toBe(true);
    useMemoryRoomStore.getState().setUiLock("hud-menu", false);
    expect(selectMonologueHidden(useMemoryRoomStore.getState())).toBe(false);
  });

  it("다른 잠금(타이틀 등)은 혼잣말을 건드리지 않는다", () => {
    useMemoryRoomStore.getState().setUiLock("title", true);
    expect(selectMonologueHidden(useMemoryRoomStore.getState())).toBe(false);
  });
});

describe("다 쓴 물건", () => {
  beforeEach(() => useMemoryRoomStore.getState().reset());

  it("안방 열쇠는 안방 문이 열리면, 악보는 피아노를 풀면 할 일을 다 한다", () => {
    const state = {
      openedDoorways: [] as ("living-parents" | "living-bathroom")[],
      solvedPuzzles: [] as ("piano-melody" | "sink-dial")[],
    };
    expect(itemSpent(state, "parents-key")).toBe(false);
    expect(itemSpent({ ...state, openedDoorways: ["living-parents"] }, "parents-key")).toBe(true);
    expect(itemSpent(state, "piano-sheet")).toBe(false);
    expect(itemSpent({ ...state, solvedPuzzles: ["piano-melody"] }, "piano-sheet")).toBe(true);
  });

  it("쓴 물건만 들고 있으면 소지품 줄이 서지 않는다. 인벤토리 기록은 남는다", () => {
    useMemoryRoomStore.setState({ inventory: ["parents-key"], openedDoorways: [] });
    expect(selectCarrying(useMemoryRoomStore.getState())).toBe(true);
    useMemoryRoomStore.setState({ openedDoorways: ["living-parents"] });
    expect(selectCarrying(useMemoryRoomStore.getState())).toBe(false);
    expect(useMemoryRoomStore.getState().inventory).toEqual(["parents-key"]);
  });
});
