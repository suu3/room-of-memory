import { beforeEach, describe, expect, it } from "vitest";
import {
  CUTSCENE_BAT_FAREWELL,
  CUTSCENE_RADIO_BLACKOUT,
  CUTSCENES,
  MEMORIES,
  PHASE1_MEMORIES,
  SCRIPTS,
} from "@/data/memory-room";
import {
  hotspotStatus,
  openCutscene,
  selectDoorReady,
  selectEndingReady,
  selectMusicPhase,
  selectMusicPlaying,
  selectRadioSignaling,
  selectSceneInputLocked,
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

    // 결과 대사도 없고 수집도 없다 — 못 되찾은 기억을 되찾았다고 적지 않는다
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

  /** 이 규칙이 이 기능의 전부다 — 되짚기가 재도전이 되면 안 된다. */
  it("미니게임을 다시 열지 않는다", () => {
    collectBall();
    useMemoryRoomStore.getState().replayMemory("ball");

    expect(useMemoryRoomStore.getState().activeInteraction).toBeNull();
  });

  it("결과 대사까지 이어 붙인다 — 미니게임만 빠진다", () => {
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

  it("어떤 기억의 다시보기도 빈 줄로 서지 않는다 — 대사가 없으면 기록이 대신 선다", () => {
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

  it("다시보기 중에는 BGM이 멎지 않는다 — 정적은 컷씬의 것이다", () => {
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

describe("ending trigger", () => {
  beforeEach(() => useMemoryRoomStore.getState().reset());

  /** 2바퀴를 다 돈 상태 — 배트가 켜지는 조건. */
  function finishBothRounds() {
    useMemoryRoomStore.setState({
      collected: PHASE1_MEMORIES.map((memory) => memory.id),
      revisited: MEMORIES.filter((memory) => memory.phase2).map((memory) => memory.id),
    });
  }

  /** 현관 잠금(회전 미궁)을 푼 상태 — 엔딩의 두 번째 조건. */
  function unlockFrontDoor() {
    useMemoryRoomStore.setState({ solvedPuzzles: ["angle-turn"] });
  }

  it("2바퀴를 다 돌기 전에는 엔딩이 시작되지 않는다", () => {
    useMemoryRoomStore.setState({ collected: PHASE1_MEMORIES.map((memory) => memory.id) });
    expect(selectEndingReady(useMemoryRoomStore.getState())).toBe(false);

    useMemoryRoomStore.getState().startEnding();

    expect(useMemoryRoomStore.getState().endingStarted).toBe(false);
  });

  it("2바퀴를 다 돌아도 현관 잠금(회전 미궁)이 남아 있으면 엔딩이 안 열린다", () => {
    finishBothRounds();
    expect(selectEndingReady(useMemoryRoomStore.getState())).toBe(true);

    useMemoryRoomStore.getState().startEnding();

    // v2: 엔딩은 기억 완주 + 현관 잠금 해제, 두 조건이다 (docs/content-design-v2.md 7장)
    expect(useMemoryRoomStore.getState().endingStarted).toBe(false);
  });

  it("2바퀴 완주 + 잠금 해제면 현관문이 열린다", () => {
    finishBothRounds();
    unlockFrontDoor();

    useMemoryRoomStore.getState().startEnding();

    expect(useMemoryRoomStore.getState().endingStarted).toBe(true);
  });

  it("리셋하면 엔딩도 처음으로 돌아간다", () => {
    finishBothRounds();
    unlockFrontDoor();
    useMemoryRoomStore.getState().startEnding();

    useMemoryRoomStore.getState().reset();

    expect(useMemoryRoomStore.getState().endingStarted).toBe(false);
    expect(selectEndingReady(useMemoryRoomStore.getState())).toBe(false);
  });
});

describe("1바퀴 마지막 관문 — 라디오", () => {
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
    finishFirstRound();

    expect(selectMusicPlaying(useMemoryRoomStore.getState())).toBe(false);
    useMemoryRoomStore.getState().endPlayback();
    expect(selectMusicPlaying(useMemoryRoomStore.getState())).toBe(true);
  });
});

describe("배트 — 대사를 거쳐 문이 열린다", () => {
  beforeEach(() => useMemoryRoomStore.getState().reset());

  function readyForBat() {
    useMemoryRoomStore.setState({
      collected: PHASE1_MEMORIES.map((memory) => memory.id),
      revisited: ["radio"],
    });
  }

  it("준비되기 전에는 쥐어도 아무 일도 없다", () => {
    useMemoryRoomStore.getState().grabBat();

    expect(useMemoryRoomStore.getState().activePlayback).toBeNull();
    expect(useMemoryRoomStore.getState().doorOpened).toBe(false);
  });

  it("쥐면 문 대신 대사가 먼저 뜬다 — 라디오 도입 없이", () => {
    readyForBat();
    useMemoryRoomStore.getState().grabBat();

    const playback = useMemoryRoomStore.getState().activePlayback;
    expect(playback?.kind).toBe("cutscene");
    expect(playback?.cutsceneId).toBe(CUTSCENE_BAT_FAREWELL);
    // 지직거리다 꺼지는 도입은 라디오 컷씬만의 것이다
    expect(playback?.intro).toBe(false);
    expect(useMemoryRoomStore.getState().doorOpened).toBe(false);
  });

  it("대사를 끝까지 넘기면 그때 문이 열린다", () => {
    readyForBat();
    useMemoryRoomStore.getState().grabBat();

    for (let step = 0; step < 16 && useMemoryRoomStore.getState().activePlayback; step += 1) {
      useMemoryRoomStore.getState().advancePlayback();
    }

    expect(useMemoryRoomStore.getState().activePlayback).toBeNull();
    expect(useMemoryRoomStore.getState().doorOpened).toBe(true);
  });

  it("대사를 건너뛰어도 문은 열린다", () => {
    // 스킵은 유효한 결말이다 — 문까지 같이 무르면 배트가 죽은 버튼이 된다
    readyForBat();
    useMemoryRoomStore.getState().grabBat();
    useMemoryRoomStore.getState().endPlayback();

    expect(useMemoryRoomStore.getState().doorOpened).toBe(true);
  });

  it("다른 재생이 도는 중에는 쥘 수 없다", () => {
    readyForBat();
    useMemoryRoomStore.setState({ activePlayback: openCutscene(CUTSCENE_RADIO_BLACKOUT) });

    useMemoryRoomStore.getState().grabBat();

    expect(useMemoryRoomStore.getState().activePlayback?.cutsceneId).toBe(CUTSCENE_RADIO_BLACKOUT);
    // 라디오 컷씬이 끝나도 배트 대사가 아니었으니 문은 닫힌 채다
    useMemoryRoomStore.getState().endPlayback();
    expect(useMemoryRoomStore.getState().doorOpened).toBe(false);
  });
});

describe("2바퀴 — 라디오가 유일한 관문", () => {
  beforeEach(() => useMemoryRoomStore.getState().reset());

  function startSecondRound() {
    useMemoryRoomStore.setState({ collected: PHASE1_MEMORIES.map((memory) => memory.id) });
  }

  it("라디오만 열려 있고 나머지 재조사는 잠겨 있다", () => {
    startSecondRound();
    const state = useMemoryRoomStore.getState();

    expect(hotspotStatus(state, "radio")).toBe("available");
    for (const id of ["ball", "console", "frame", "phone", "computer"] as const) {
      expect(hotspotStatus(state, id)).toBe("locked");
    }
  });

  it("라디오 목소리를 잡아도 문을 열기 전에는 나머지가 잠겨 있다", () => {
    // 문이 열리는 것이 2바퀴의 시작이다 — 단서 수집은 방과 거실을 오가는 일이라,
    // 문도 안 열었는데 방 안에서 2바퀴가 다 돌면 거실이 부록이 된다
    startSecondRound();
    useMemoryRoomStore.setState({ revisited: ["radio"] });
    const state = useMemoryRoomStore.getState();

    for (const id of ["ball", "console", "frame", "phone", "computer"] as const) {
      expect(hotspotStatus(state, id)).toBe("locked");
    }
  });

  it("문이 열리면 나머지가 재점등된다", () => {
    startSecondRound();
    useMemoryRoomStore.setState({ revisited: ["radio"], doorOpened: true });
    const state = useMemoryRoomStore.getState();

    for (const id of ["ball", "console", "frame", "computer"] as const) {
      expect(hotspotStatus(state, id)).toBe("available");
    }
    // 폰만 한 칸 뒤다 — 컴퓨터의 여행 메일이 서야 엄마 문자가 근거를 얻는다
    expect(hotspotStatus(state, "phone")).toBe("locked");
    useMemoryRoomStore.setState({ revisited: ["radio", "computer"] });
    expect(hotspotStatus(useMemoryRoomStore.getState(), "phone")).toBe("available");
  });

  it("2차 조사 대상은 라디오와 재점등 5종뿐이다", () => {
    const revisitable = MEMORIES.filter((memory) => memory.phase2).map((memory) => memory.id);

    expect(revisitable.sort()).toEqual(["ball", "computer", "frame", "console", "phone", "radio"]);
  });
});

describe("미궁 문제 (거실)", () => {
  beforeEach(() => useMemoryRoomStore.getState().reset());

  it("붙잡고 → 풀면 solvedPuzzles에 남고, 다시는 안 열린다", () => {
    useMemoryRoomStore.getState().openPuzzle("card-odd");
    expect(useMemoryRoomStore.getState().activePuzzle).toBe("card-odd");

    useMemoryRoomStore.getState().finishPuzzle({ cleared: true });

    const state = useMemoryRoomStore.getState();
    expect(state.activePuzzle).toBeNull();
    expect(state.solvedPuzzles).toEqual(["card-odd"]);

    state.openPuzzle("card-odd");
    expect(useMemoryRoomStore.getState().activePuzzle).toBeNull();
  });

  it("내려놓으면 아무것도 안 남는다 — 물건은 다시 클릭할 수 있다", () => {
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

    useMemoryRoomStore.getState().openPuzzle("card-odd");

    expect(useMemoryRoomStore.getState().activePuzzle).toBeNull();
  });

  it("문제가 떠 있는 동안 씬 입력이 잠긴다", () => {
    useMemoryRoomStore.getState().openPuzzle("card-odd");

    expect(selectSceneInputLocked(useMemoryRoomStore.getState())).toBe(true);
  });

  it("리셋하면 푼 문제도 처음으로 돌아간다", () => {
    useMemoryRoomStore.getState().openPuzzle("angle-turn");
    useMemoryRoomStore.getState().finishPuzzle({ cleared: true });

    useMemoryRoomStore.getState().reset();

    expect(useMemoryRoomStore.getState().solvedPuzzles).toEqual([]);
  });
});
