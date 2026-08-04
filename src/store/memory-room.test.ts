import { beforeEach, describe, expect, it } from "vitest";
import { MEMORIES } from "@/data/memory-room";
import {
  hotspotStatus,
  selectEndingReady,
  selectSceneInputLocked,
  useMemoryRoomStore,
} from "./memory-room";

describe("scene input locks", () => {
  beforeEach(() => useMemoryRoomStore.getState().reset());

  it("stays locked until every UI source closes", () => {
    const store = useMemoryRoomStore.getState();
    store.setUiLock("hud-menu", true);
    store.setUiLock("memory-panel", true);
    store.setUiLock("hud-menu", false);
    expect(selectSceneInputLocked(useMemoryRoomStore.getState())).toBe(true);
    store.setUiLock("memory-panel", false);
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

describe("replaying a collected memory", () => {
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

    expect(useMemoryRoomStore.getState().activeInteraction).toBeNull();
  });

  it("수집한 기억은 처음 봤던 대사를 다시 재생한다", () => {
    collectBall();
    useMemoryRoomStore.getState().replayMemory("ball");

    const active = useMemoryRoomStore.getState().activeInteraction;
    expect(active?.memoryId).toBe("ball");
    expect(active?.phase).toBe("dialogue");
    expect(active?.replaying).toBe(true);
    expect(active?.lineIndex).toBe(0);
  });

  it("재생이 끝나도 수집·재조사 기록이 늘지 않는다", () => {
    collectBall();
    const before = useMemoryRoomStore.getState();
    const collected = [...before.collected];
    const revisited = [...before.revisited];

    useMemoryRoomStore.getState().replayMemory("ball");
    pushToEnd("ball(replay)");

    const after = useMemoryRoomStore.getState();
    expect(after.collected).toEqual(collected);
    expect(after.revisited).toEqual(revisited);
    expect(after.activeInteraction).toBeNull();
  });

  it("다른 인터랙션이 진행 중이면 재생을 시작하지 않는다", () => {
    collectBall();
    useMemoryRoomStore.getState().beginInteraction("console");
    const active = useMemoryRoomStore.getState().activeInteraction;

    useMemoryRoomStore.getState().replayMemory("ball");

    expect(useMemoryRoomStore.getState().activeInteraction).toBe(active);
  });
});

describe("ending trigger", () => {
  beforeEach(() => useMemoryRoomStore.getState().reset());

  /** 2바퀴를 다 돈 상태 — 배트가 켜지는 조건. */
  function finishBothRounds() {
    const all = MEMORIES.map((memory) => memory.id);
    useMemoryRoomStore.setState({
      collected: all,
      revisited: MEMORIES.filter((memory) => memory.phase2).map((memory) => memory.id),
    });
  }

  it("2바퀴를 다 돌기 전에는 엔딩이 시작되지 않는다", () => {
    useMemoryRoomStore.setState({ collected: MEMORIES.map((memory) => memory.id) });
    expect(selectEndingReady(useMemoryRoomStore.getState())).toBe(false);

    useMemoryRoomStore.getState().startEnding();

    expect(useMemoryRoomStore.getState().endingStarted).toBe(false);
  });

  it("2바퀴를 다 돌면 배트를 쥘 수 있다", () => {
    finishBothRounds();
    expect(selectEndingReady(useMemoryRoomStore.getState())).toBe(true);

    useMemoryRoomStore.getState().startEnding();

    expect(useMemoryRoomStore.getState().endingStarted).toBe(true);
  });

  it("리셋하면 엔딩도 처음으로 돌아간다", () => {
    finishBothRounds();
    useMemoryRoomStore.getState().startEnding();

    useMemoryRoomStore.getState().reset();

    expect(useMemoryRoomStore.getState().endingStarted).toBe(false);
    expect(selectEndingReady(useMemoryRoomStore.getState())).toBe(false);
  });
});
