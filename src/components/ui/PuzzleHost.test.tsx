/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { i18n } from "@/i18n/config";
import { useMemoryRoomStore } from "@/store/memory-room";
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

it("악보 조각 없이 피아노 앞에 앉으면 지워진 마디 안내가 선다", () => {
  act(() => useMemoryRoomStore.getState().openPuzzle("piano-melody"));
  render(<PuzzleHost />);
  expect(screen.getByText(i18n.t("minigame.pianoMelody.missing"))).toBeTruthy();
  cleanup();

  act(() => {
    useMemoryRoomStore.getState().closePuzzle();
    useMemoryRoomStore.getState().takeItem("piano-sheet");
    useMemoryRoomStore.getState().openPuzzle("piano-melody");
  });
  render(<PuzzleHost />);
  expect(screen.queryByText(i18n.t("minigame.pianoMelody.missing"))).toBeNull();
});
