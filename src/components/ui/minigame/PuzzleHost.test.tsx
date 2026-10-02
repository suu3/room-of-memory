/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { i18n } from "@/i18n/config";
import { useMemoryRoomStore } from "@/store/memory-room";
import { RemarkLine } from "../dialogue/RemarkLine";
import { PuzzleHost } from "./PuzzleHost";

vi.mock("./SuccessBurst", () => ({ SuccessBurst: () => null }));

beforeEach(async () => {
  vi.useFakeTimers();
  await i18n.changeLanguage("ko");
  useMemoryRoomStore.getState().reset();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("피아노를 풀면 결과 카드가 서고, 계속을 눌러야 문제가 닫힌다", () => {
  act(() => useMemoryRoomStore.getState().openPuzzle("piano-melody"));
  render(<PuzzleHost />);
  expect(screen.queryByText("풀었다")).toBeNull();

  // 씬 쪽 판(CanvasMinigameHost)이 풀렸다고 알린다
  act(() => useMemoryRoomStore.getState().settlePuzzle());

  expect(screen.getByText("풀었다")).toBeTruthy();
  expect(screen.getByText(i18n.t("minigame.pianoMelody.solved"))).toBeTruthy();
  // 풀린 판에는 돌아가기가 없다: 닫을 길은 계속뿐이다
  expect(screen.queryByText(i18n.t("minigame.back"))).toBeNull();
  expect(useMemoryRoomStore.getState().solvedPuzzles).toEqual([]);

  act(() => vi.advanceTimersByTime(700));
  fireEvent.click(screen.getByText(i18n.t("minigame.result.continue")));

  const state = useMemoryRoomStore.getState();
  expect(state.activePuzzle).toBeNull();
  expect(state.solvedPuzzles).toContain("piano-melody");
});

it("결과 카드의 계속은 Space로도 눌리고, 아래 판의 Space 리스너까지는 가지 않는다", () => {
  act(() => useMemoryRoomStore.getState().openPuzzle("piano-melody"));
  render(<PuzzleHost />);
  act(() => useMemoryRoomStore.getState().settlePuzzle());
  // Space를 조작 키로 쓰는 판: 창 전역에서 기본 동작을 막는다
  const game = vi.fn((event: KeyboardEvent) => event.preventDefault());
  window.addEventListener("keydown", game);

  // 버튼이 서기 전에는 듣지 않는다 (결과를 읽기 전에 눌리는 걸 막는 창)
  fireEvent.keyDown(document.body, { code: "Space", key: " " });
  expect(useMemoryRoomStore.getState().activePuzzle).toBe("piano-melody");

  act(() => vi.advanceTimersByTime(700));
  game.mockClear();
  fireEvent.keyDown(document.body, { code: "Space", key: " " });
  window.removeEventListener("keydown", game);

  expect(game).not.toHaveBeenCalled();
  expect(useMemoryRoomStore.getState().activePuzzle).toBeNull();
  expect(useMemoryRoomStore.getState().solvedPuzzles).toContain("piano-melody");
});

it("악보 조각 없이 피아노를 열면 빈 마디의 혼잣말이 바닥에 먼저 서고, 건반을 눌러도 같은 줄이다", () => {
  act(() => useMemoryRoomStore.getState().openPuzzle("piano-melody"));
  render(
    <>
      <PuzzleHost />
      <RemarkLine />
    </>,
  );
  const line = i18n.t("minigame.pianoMelody.missing");
  // 여는 순간 선다: 판이 "치는 화면"이 아니라 "보는 화면"으로 읽혀야 한다
  // 판의 안내 칩이 아니라 혼잣말 줄이다
  expect(screen.getByText(line).closest("[role=status]")).toBeNull();
  expect(screen.getByText(line).className).toContain("font-pixel");

  // 떠 있는 동안 건반을 두드려도(blockPuzzle) 줄을 새로 띄우지 않는다
  const first = useMemoryRoomStore.getState().remark;
  act(() => useMemoryRoomStore.getState().blockPuzzle());
  expect(useMemoryRoomStore.getState().remark).toBe(first);
  cleanup();

  act(() => {
    useMemoryRoomStore.getState().closePuzzle();
    useMemoryRoomStore.getState().takeItem("piano-sheet");
    useMemoryRoomStore.getState().openPuzzle("piano-melody");
  });
  render(<RemarkLine />);
  expect(screen.queryByText(line)).toBeNull();
});
