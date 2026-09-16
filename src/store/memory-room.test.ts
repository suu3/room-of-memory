import { beforeEach, describe, expect, it } from "vitest";
import {
  ACT2_CHAIN,
  CUTSCENE_BAT_GRIP,
  CUTSCENE_FAREWELL,
  CUTSCENE_RADIO_BLACKOUT,
  CUTSCENES,
  MEMORIES,
  PHASE1_MEMORIES,
  SCRIPTS,
} from "@/data/memory-room";
import {
  actOf,
  actTwoProgress,
  hotspotStatus,
  isAtCurtain,
  openCutscene,
  selectBatReady,
  selectDoorReady,
  selectEndingReady,
  selectHeroNameKnown,
  selectMusicPhase,
  selectMusicPlaying,
  selectRadioSignaling,
  selectSceneInputLocked,
  selectViewpoint,
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
    useMemoryRoomStore.getState().beginInteraction("console");

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

  it("plays the result script over the minigame, then completes the memory", () => {
    useMemoryRoomStore.getState().beginInteraction("frame");
    useMemoryRoomStore.getState().finishMinigame({ cleared: true });

    const active = useMemoryRoomStore.getState().activeInteraction;
    expect(active?.phase).toBe("dialogue");
    expect(active?.scriptId).toBe("frame-photo");
    // 미니게임 화면이 대사창 뒤에 남는다
    expect(active?.keepMinigame).toBe(true);

    // 두 줄을 다 넘기면 인터랙션이 끝나고 기억이 수집된다
    useMemoryRoomStore.getState().advanceDialogue();
    expect(useMemoryRoomStore.getState().activeInteraction?.lineIndex).toBe(1);
    useMemoryRoomStore.getState().advanceDialogue();

    expect(useMemoryRoomStore.getState().activeInteraction).toBeNull();
    expect(useMemoryRoomStore.getState().collected).toEqual(["frame"]);
  });

  it("closes without collecting when the minigame is failed, and stays retryable", () => {
    useMemoryRoomStore.getState().beginInteraction("frame");
    useMemoryRoomStore.getState().finishMinigame({ cleared: false });

    // 결과 대사도 없고 수집도 없다. 못 되찾은 기억을 되찾았다고 적지 않는다
    expect(useMemoryRoomStore.getState().activeInteraction).toBeNull();
    expect(useMemoryRoomStore.getState().collected).toEqual([]);

    // 막다른 길이 되면 안 된다: 핫스팟은 그대로 눌러서 다시 붙을 수 있다
    expect(hotspotStatus(useMemoryRoomStore.getState(), "frame")).toBe("available");
    useMemoryRoomStore.getState().beginInteraction("frame");
    expect(useMemoryRoomStore.getState().activeInteraction?.memoryId).toBe("frame");
  });

  it("still collects when the player skips, since skipping reports cleared", () => {
    useMemoryRoomStore.getState().beginInteraction("frame");
    // 접근성 계약상 스킵은 cleared: true다 (src/types/minigame.ts)
    useMemoryRoomStore.getState().finishMinigame({ cleared: true });
    useMemoryRoomStore.getState().advanceDialogue();
    useMemoryRoomStore.getState().advanceDialogue();

    expect(useMemoryRoomStore.getState().collected).toEqual(["frame"]);
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
      if (!active) return;
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
    useMemoryRoomStore.getState().beginInteraction("ball");
    pushToEnd("ball");
  }

  it("아직 수집하지 않은 기억은 재생되지 않는다", () => {
    useMemoryRoomStore.getState().replayMemory("ball");

    expect(useMemoryRoomStore.getState().activePlayback).toBeNull();
  });

  it("수집한 기억은 그때의 대사를 다시 재생한다", () => {
    collectBall();
    useMemoryRoomStore.getState().replayMemory("ball");

    const playback = useMemoryRoomStore.getState().activePlayback;
    expect(playback?.kind).toBe("replay");
    expect(playback?.memoryId).toBe("ball");
    expect(playback?.lineIndex).toBe(0);
    // 도입(라디오가 꺼지는 비트)은 컷씬만의 것이다
    expect(playback?.intro).toBe(false);
    expect(playback?.cuts[0].lines).toEqual(SCRIPTS["ball-intro"].lines);
  });

  /** 이 규칙이 이 기능의 전부다. 되짚기가 재도전이 되면 안 된다. */
  it("미니게임을 다시 열지 않는다", () => {
    collectBall();
    useMemoryRoomStore.getState().replayMemory("ball");

    expect(useMemoryRoomStore.getState().activeInteraction).toBeNull();
  });

  it("결과 대사까지 이어 붙인다. 미니게임만 빠진다", () => {
    useMemoryRoomStore.getState().beginInteraction("frame");
    pushToEnd("frame");
    useMemoryRoomStore.getState().replayMemory("frame");

    const playback = useMemoryRoomStore.getState().activePlayback;
    expect(playback?.cuts[0].lines).toEqual(SCRIPTS["frame-photo"].lines);
    // 그때 본 사진이 대사 뒤에 선다
    expect(playback?.cuts[0].image).toBeDefined();
  });

  it("진입 대사(①)와 결과 대사(③)를 그 순서로 잇는다", () => {
    useMemoryRoomStore.getState().beginInteraction("console");
    pushToEnd("console");
    useMemoryRoomStore.getState().replayMemory("console");

    const lines = useMemoryRoomStore.getState().activePlayback?.cuts[0].lines;
    expect(lines).toEqual([...SCRIPTS["console-intro"].lines, ...SCRIPTS["console-alone"].lines]);
  });

  it("어떤 기억의 다시보기도 빈 줄로 서지 않는다. 대사가 없으면 기록이 대신 선다", () => {
    /*
     * 지금 대본은 모든 기억에 대사가 있어 lore 폴백이 실데이터로는 돌지 않지만,
     * 대본은 어드민에서 언제든 바뀐다. 대사를 다 비운 기억이 생겨도 다시보기가
     * "눌렀는데 아무 일도 없는 줄"이 되지 않는다는 계약을 여기 묶어 둔다.
     */
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

    expect(useMemoryRoomStore.getState().activePlayback?.cuts[0].lines).toEqual(
      SCRIPTS["ball-echo"].lines,
    );
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
    collectBall();
    useMemoryRoomStore.getState().replayMemory("ball");

    expect(selectMusicPlaying(useMemoryRoomStore.getState())).toBe(true);
  });

  it("2바퀴 곡은 수집 완료가 아니라 문이 열려야 든다", () => {
    // 6개를 다 모으면 gamePhase는 2지만, 문이 열리기 전까지는 아직 1바퀴의 끝자락이다
    useMemoryRoomStore.setState({ collected: PHASE1_MEMORIES.map((memory) => memory.id) });
    expect(selectMusicPhase(useMemoryRoomStore.getState())).toBe(1);

    useMemoryRoomStore.setState({ doorOpened: true });
    expect(selectMusicPhase(useMemoryRoomStore.getState())).toBe(2);
  });
});

describe("3막: 앰플 · 배트 · 현관문", () => {
  beforeEach(() => useMemoryRoomStore.getState().reset());

  /** 2막 추리 체인을 끝낸 상태: 앰플까지 손에 넣었다. */
  function finishActTwo() {
    useMemoryRoomStore.setState({
      collected: PHASE1_MEMORIES.map((memory) => memory.id),
      revisited: [...ACT2_CHAIN],
      doorOpened: true,
    });
  }

  /** 현관 잠금(회전 미궁)을 푼 상태: 문의 두 번째 조건. */
  function unlockFrontDoor() {
    useMemoryRoomStore.setState({ solvedPuzzles: ["angle-turn"] });
  }

  it("앰플을 쥐기 전에는 3막이 아니다", () => {
    useMemoryRoomStore.setState({
      collected: PHASE1_MEMORIES.map((memory) => memory.id),
      revisited: ACT2_CHAIN.filter((id) => id !== "ampoule"),
      doorOpened: true,
    });

    expect(actOf(useMemoryRoomStore.getState())).toBe(2);
    expect(selectEndingReady(useMemoryRoomStore.getState())).toBe(false);
    expect(selectBatReady(useMemoryRoomStore.getState())).toBe(false);
  });

  it("곁가지(컴퓨터·폰·게임기)를 안 봐도 3막은 열린다", () => {
    // 선택 콘텐츠가 관문이 되면 체인을 끝낸 플레이어가 왜 막혔는지 알 길이 없다
    finishActTwo();

    expect(actOf(useMemoryRoomStore.getState())).toBe(3);
    expect(useMemoryRoomStore.getState().revisited).not.toContain("computer");
  });

  it("배트를 쥐기 전에는 현관문이 안 열린다", () => {
    finishActTwo();
    unlockFrontDoor();

    useMemoryRoomStore.getState().startEnding();

    expect(useMemoryRoomStore.getState().endingStarted).toBe(false);
  });

  it("배트를 쥐어도 현관 잠금이 남아 있으면 안 열린다", () => {
    finishActTwo();
    useMemoryRoomStore.setState({ batTaken: true });

    useMemoryRoomStore.getState().startEnding();

    expect(useMemoryRoomStore.getState().endingStarted).toBe(false);
  });

  it("배트 + 잠금 해제면 현관문이 열린다", () => {
    finishActTwo();
    unlockFrontDoor();
    useMemoryRoomStore.setState({ batTaken: true });

    useMemoryRoomStore.getState().startEnding();

    expect(useMemoryRoomStore.getState().endingStarted).toBe(true);
  });

  it("리셋하면 엔딩도 처음으로 돌아간다", () => {
    finishActTwo();
    unlockFrontDoor();
    useMemoryRoomStore.setState({ batTaken: true });
    useMemoryRoomStore.getState().startEnding();

    useMemoryRoomStore.getState().reset();

    const state = useMemoryRoomStore.getState();
    expect(state.endingStarted).toBe(false);
    expect(state.batTaken).toBe(false);
    expect(actOf(state)).toBe(1);
  });
});

describe("2막 진행도: 밝기 상승 곡선의 분모", () => {
  beforeEach(() => useMemoryRoomStore.getState().reset());

  it("필수 체인만 센다. 곁가지는 분자에도 분모에도 없다", () => {
    useMemoryRoomStore.setState({ revisited: ["radio", "computer", "console"] });

    // 셋을 봤지만 체인에 든 것은 라디오뿐이다
    expect(actTwoProgress(useMemoryRoomStore.getState())).toBeCloseTo(1 / ACT2_CHAIN.length);
  });

  it("체인을 다 돌면 1이다", () => {
    useMemoryRoomStore.setState({ revisited: [...ACT2_CHAIN] });

    expect(actTwoProgress(useMemoryRoomStore.getState())).toBe(1);
  });

  it("체인은 앰플에서 거슬러 올라간 순서다", () => {
    // 의존이 먼저 오고 앰플이 마지막: 어느 칸도 자기 선행 조건보다 앞서지 않는다
    expect(ACT2_CHAIN[ACT2_CHAIN.length - 1]).toBe("ampoule");
    expect(ACT2_CHAIN).toContain("radio");
    expect(ACT2_CHAIN).not.toContain("computer");
  });
});

describe("1바퀴 마지막 관문: 라디오", () => {
  beforeEach(() => useMemoryRoomStore.getState().reset());

  /** 라디오를 뺀 나머지를 다 조사한 상태. */
  function collectAllButRadio() {
    useMemoryRoomStore.setState({
      collected: PHASE1_MEMORIES.map((memory) => memory.id).filter((id) => id !== "radio"),
    });
  }

  it("나머지를 다 조사하기 전에는 라디오를 만질 수 없다", () => {
    expect(hotspotStatus(useMemoryRoomStore.getState(), "radio")).toBe("locked");

    useMemoryRoomStore.getState().beginInteraction("radio");

    expect(useMemoryRoomStore.getState().activeInteraction).toBeNull();
  });

  it("나머지 6개를 마치면 라디오가 열린다", () => {
    collectAllButRadio();

    expect(hotspotStatus(useMemoryRoomStore.getState(), "radio")).toBe("available");
  });

  it("진입 대사 → 튜닝 → 재난방송 순으로 흐른다", () => {
    collectAllButRadio();
    useMemoryRoomStore.getState().beginInteraction("radio");

    expect(useMemoryRoomStore.getState().activeInteraction?.scriptId).toBe("radio-intro");
    useMemoryRoomStore.getState().advanceDialogue();
    useMemoryRoomStore.getState().advanceDialogue();
    expect(useMemoryRoomStore.getState().activeInteraction?.phase).toBe("minigame");

    useMemoryRoomStore.getState().finishMinigame({ cleared: true });

    const active = useMemoryRoomStore.getState().activeInteraction;
    expect(active?.scriptId).toBe("radio-broadcast");
    expect(active?.keepMinigame).toBe(true);
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

    expect(selectRadioSignaling(useMemoryRoomStore.getState())).toBe(true);
    // 목소리를 잡고 나면 더는 부르지 않는다
    useMemoryRoomStore.setState({ revisited: ["radio"] });
    expect(selectRadioSignaling(useMemoryRoomStore.getState())).toBe(false);
  });

  it("컷씬 중에는 BGM이 멎는다", () => {
    useMemoryRoomStore.getState().startGame();
    // 새 게임은 불 꺼진 인트로에서 시작한다. 스위치를 켜야 조사가 열린다
    useMemoryRoomStore.getState().toggleLights();
    finishFirstRound();

    expect(selectMusicPlaying(useMemoryRoomStore.getState())).toBe(false);
    useMemoryRoomStore.getState().endPlayback();
    expect(selectMusicPlaying(useMemoryRoomStore.getState())).toBe(true);
  });
});

describe("현관의 배트: 대사를 거쳐 손에 들어온다", () => {
  beforeEach(() => useMemoryRoomStore.getState().reset());

  function readyForBat() {
    useMemoryRoomStore.setState({
      collected: PHASE1_MEMORIES.map((memory) => memory.id),
      revisited: [...ACT2_CHAIN],
      doorOpened: true,
    });
  }

  it("앰플이 없으면 쥐어도 아무 일도 없다", () => {
    useMemoryRoomStore.getState().takeBat();

    expect(useMemoryRoomStore.getState().activePlayback).toBeNull();
    expect(useMemoryRoomStore.getState().batTaken).toBe(false);
  });

  it("쥐면 먼저 대사가 뜬다. 라디오 도입 없이", () => {
    readyForBat();
    useMemoryRoomStore.getState().takeBat();

    const playback = useMemoryRoomStore.getState().activePlayback;
    expect(playback?.kind).toBe("cutscene");
    expect(playback?.cutsceneId).toBe(CUTSCENE_BAT_GRIP);
    // 지직거리다 꺼지는 도입은 라디오 컷씬만의 것이다
    expect(playback?.intro).toBe(false);
    expect(useMemoryRoomStore.getState().batTaken).toBe(false);
  });

  it("대사를 끝까지 넘기면 그때 배트가 손에 들어온다", () => {
    readyForBat();
    useMemoryRoomStore.getState().takeBat();

    for (let step = 0; step < 16 && useMemoryRoomStore.getState().activePlayback; step += 1) {
      useMemoryRoomStore.getState().advancePlayback();
    }

    expect(useMemoryRoomStore.getState().activePlayback).toBeNull();
    expect(useMemoryRoomStore.getState().batTaken).toBe(true);
  });

  it("대사를 건너뛰어도 배트는 손에 들어온다", () => {
    // 스킵은 유효한 결말이다. 배트까지 같이 무르면 죽은 버튼이 된다
    readyForBat();
    useMemoryRoomStore.getState().takeBat();
    useMemoryRoomStore.getState().endPlayback();

    expect(useMemoryRoomStore.getState().batTaken).toBe(true);
  });

  it("다른 재생이 도는 중에는 쥘 수 없다", () => {
    readyForBat();
    useMemoryRoomStore.setState({ activePlayback: openCutscene(CUTSCENE_RADIO_BLACKOUT) });

    useMemoryRoomStore.getState().takeBat();

    expect(useMemoryRoomStore.getState().activePlayback?.cutsceneId).toBe(CUTSCENE_RADIO_BLACKOUT);
    // 라디오 컷씬이 끝나도 배트 대사가 아니었으니 배트는 벽에 그대로 서 있다
    useMemoryRoomStore.getState().endPlayback();
    expect(useMemoryRoomStore.getState().batTaken).toBe(false);
  });

  it("앰플을 되찾는 순간 작별의 회상이 뜬다", () => {
    useMemoryRoomStore.setState({
      collected: PHASE1_MEMORIES.map((memory) => memory.id),
      revisited: ACT2_CHAIN.filter((id) => id !== "ampoule"),
      doorOpened: true,
    });

    useMemoryRoomStore.getState().beginInteraction("ampoule");
    // 진입 대사("…열어보자")가 끝나면 서랍을 여는 손(ampoule-pickup)이 선다
    const advance = () => {
      for (
        let step = 0;
        step < 16 && useMemoryRoomStore.getState().activeInteraction?.phase === "dialogue";
        step += 1
      ) {
        useMemoryRoomStore.getState().advanceDialogue();
      }
    };
    advance();
    expect(useMemoryRoomStore.getState().activeInteraction?.phase).toBe("minigame");
    // 대사만으로는 앰플이 손에 들어오지 않는다. 집어야 한다
    expect(useMemoryRoomStore.getState().revisited).not.toContain("ampoule");

    useMemoryRoomStore.getState().finishMinigame({ cleared: true });
    // 집은 뒤의 대사(ampoule-found)가 든 채로 흐르고, 그게 끝나야 조사가 닫힌다
    expect(useMemoryRoomStore.getState().activeInteraction?.scriptId).toBe("ampoule-found");
    advance();

    const state = useMemoryRoomStore.getState();
    expect(state.activeInteraction).toBeNull();
    expect(state.revisited).toContain("ampoule");
    expect(state.activePlayback?.cutsceneId).toBe(CUTSCENE_FAREWELL);
  });
});

describe("2막: 라디오가 유일한 관문, 그다음은 체인", () => {
  beforeEach(() => useMemoryRoomStore.getState().reset());

  function startActTwo() {
    useMemoryRoomStore.setState({ collected: PHASE1_MEMORIES.map((memory) => memory.id) });
  }

  it("라디오만 열려 있고 나머지 재조사는 잠겨 있다", () => {
    startActTwo();
    const state = useMemoryRoomStore.getState();

    expect(hotspotStatus(state, "radio")).toBe("available");
    for (const id of ["fridge", "duffel", "frame", "shoes", "cards", "ball"] as const) {
      expect(hotspotStatus(state, id)).toBe("locked");
    }
  });

  it("라디오 목소리를 잡아도 문을 열기 전에는 나머지가 잠겨 있다", () => {
    // 문이 열리는 것이 2막의 시작이다. 추리는 방과 거실을 오가는 일이라,
    // 문도 안 열었는데 방 안에서 2막이 다 돌면 거실이 부록이 된다
    startActTwo();
    useMemoryRoomStore.setState({ revisited: ["radio"] });
    const state = useMemoryRoomStore.getState();

    for (const id of ["fridge", "duffel", "frame", "ball"] as const) {
      expect(hotspotStatus(state, id)).toBe("locked");
    }
  });

  it("문이 열리면 거실의 준비 둘부터 켜진다", () => {
    startActTwo();
    useMemoryRoomStore.setState({ revisited: ["radio"], doorOpened: true });
    const state = useMemoryRoomStore.getState();

    expect(hotspotStatus(state, "fridge")).toBe("available");
    expect(hotspotStatus(state, "duffel")).toBe("available");
    // 액자는 준비를 마쳐야 켜진다. 거실에서 방으로 부르는 고리다
    expect(hotspotStatus(state, "frame")).toBe("locked");
  });

  it("추리 체인은 거실 → 방 → 거실 → 방 → 거실로 접힌다", () => {
    startActTwo();
    const step = (...revisited: string[]) =>
      useMemoryRoomStore.setState({ revisited: revisited as never, doorOpened: true });

    step("radio", "fridge", "duffel");
    expect(hotspotStatus(useMemoryRoomStore.getState(), "frame")).toBe("available");
    // 액자를 보기 전에는 거실 단서가 안 열린다
    expect(hotspotStatus(useMemoryRoomStore.getState(), "shoes")).toBe("locked");

    step("radio", "fridge", "duffel", "frame");
    expect(hotspotStatus(useMemoryRoomStore.getState(), "shoes")).toBe("available");
    expect(hotspotStatus(useMemoryRoomStore.getState(), "cards")).toBe("available");
    expect(hotspotStatus(useMemoryRoomStore.getState(), "ball")).toBe("locked");

    step("radio", "fridge", "duffel", "frame", "shoes", "cards");
    expect(hotspotStatus(useMemoryRoomStore.getState(), "ball")).toBe("available");
    expect(hotspotStatus(useMemoryRoomStore.getState(), "ampoule")).toBe("locked");

    step("radio", "fridge", "duffel", "frame", "shoes", "cards", "ball");
    expect(hotspotStatus(useMemoryRoomStore.getState(), "ampoule")).toBe("available");
  });

  it("곁가지는 라디오 뒤에 바로 열린다. 체인을 기다리지 않는다", () => {
    startActTwo();
    useMemoryRoomStore.setState({ revisited: ["radio"], doorOpened: true });
    const state = useMemoryRoomStore.getState();

    expect(hotspotStatus(state, "console")).toBe("available");
    expect(hotspotStatus(state, "computer")).toBe("available");
    // 폰만 한 칸 뒤다. 컴퓨터의 여행 메일이 서야 엄마 문자가 근거를 얻는다
    expect(hotspotStatus(state, "phone")).toBe("locked");
    useMemoryRoomStore.setState({ revisited: ["radio", "computer"] });
    expect(hotspotStatus(useMemoryRoomStore.getState(), "phone")).toBe("available");
  });

  it("2차 조사 대상 목록", () => {
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
      "console",
      "phone",
      "radio",
      "shoes",
    ]);
  });
});

describe("미궁 문제: 현관 잠금", () => {
  beforeEach(() => useMemoryRoomStore.getState().reset());

  it("붙잡고 → 풀면 solvedPuzzles에 남고, 다시는 안 열린다", () => {
    useMemoryRoomStore.getState().openPuzzle("angle-turn");
    expect(useMemoryRoomStore.getState().activePuzzle).toBe("angle-turn");

    useMemoryRoomStore.getState().finishPuzzle({ cleared: true });

    const state = useMemoryRoomStore.getState();
    expect(state.activePuzzle).toBeNull();
    expect(state.solvedPuzzles).toEqual(["angle-turn"]);

    state.openPuzzle("angle-turn");
    expect(useMemoryRoomStore.getState().activePuzzle).toBeNull();
  });

  it("내려놓으면 아무것도 안 남는다. 물건은 다시 클릭할 수 있다", () => {
    useMemoryRoomStore.getState().openPuzzle("angle-turn");
    useMemoryRoomStore.getState().closePuzzle();

    const state = useMemoryRoomStore.getState();
    expect(state.activePuzzle).toBeNull();
    expect(state.solvedPuzzles).toEqual([]);

    state.openPuzzle("angle-turn");
    expect(useMemoryRoomStore.getState().activePuzzle).toBe("angle-turn");
  });

  it("다른 화면이 떠 있으면 문제가 열리지 않는다", () => {
    useMemoryRoomStore.getState().openClue("drawer-note");

    useMemoryRoomStore.getState().openPuzzle("angle-turn");

    expect(useMemoryRoomStore.getState().activePuzzle).toBeNull();
  });

  it("문제가 떠 있는 동안 씬 입력이 잠긴다", () => {
    useMemoryRoomStore.getState().openPuzzle("angle-turn");

    expect(selectSceneInputLocked(useMemoryRoomStore.getState())).toBe(true);
  });

  it("리셋하면 푼 문제도 처음으로 돌아간다", () => {
    useMemoryRoomStore.getState().openPuzzle("angle-turn");
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

  it("타이틀에서는 등 뒤 시점이 아니다. 새 게임을 시작하면 불 꺼진 방의 인트로다", () => {
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

  it("등 뒤 시점에 있는 동안은 조사·앉기·커튼이 막힌다. 할 일은 스위치 하나다", () => {
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

    useMemoryRoomStore.getState().setInLivingRoom(true);
    const state = useMemoryRoomStore.getState();
    expect(state.doorwayDone).toBe(true);
    expect(selectViewpoint(state)).toBeNull();

    // 그 뒤의 왕복은 이동이다. 다시 방으로, 다시 거실로 가도 등 뒤 시점에 안 들어간다
    useMemoryRoomStore.getState().setInLivingRoom(false);
    useMemoryRoomStore.getState().setInLivingRoom(true);
    expect(selectViewpoint(useMemoryRoomStore.getState())).toBeNull();
  });

  it("문이 열리기 전에 거실 판정이 켜져도(개발 도구) 문 넘기를 마친 것으로 적지 않는다", () => {
    useMemoryRoomStore.setState({ started: true, introDone: true });
    useMemoryRoomStore.getState().setInLivingRoom(true);

    expect(useMemoryRoomStore.getState().doorwayDone).toBe(false);
  });

  it("엔딩이 시작되면 등 뒤 시점에서 나온다. 새 게임은 두 구간을 다시 연다", () => {
    useMemoryRoomStore.setState({ started: true, introDone: false, endingStarted: true });
    expect(selectViewpoint(useMemoryRoomStore.getState())).toBeNull();

    useMemoryRoomStore.setState({ introDone: true, doorwayDone: true, lightsOn: false });
    useMemoryRoomStore.getState().reset();
    const state = useMemoryRoomStore.getState();
    expect(state.introDone).toBe(false);
    expect(state.doorwayDone).toBe(false);
    expect(state.lightsOn).toBe(true);
  });
});
