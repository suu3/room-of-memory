/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it } from "vitest";
import { progressAt } from "@/data/story-phase";
import { i18n } from "@/i18n/config";
import { useMemoryRoomStore } from "@/store/memory-room";
import { HudGuideDock } from "./HudGuide";

beforeEach(async () => {
  await i18n.changeLanguage("ko");
  useMemoryRoomStore.getState().reset();
  useMemoryRoomStore.setState({
    ...(progressAt("p1") as object),
    discoveries: ["hero-name"],
    notebookOpened: true,
  } as never);
});

afterEach(cleanup);

it("보통 모드의 목표 줄은 어느 물건인지 짚지 않는다", () => {
  useMemoryRoomStore.setState({ difficulty: "normal" });
  render(<HudGuideDock />);
  expect(screen.getByRole("status").textContent).toContain("빛나는 물건");
});

it("이지 모드의 목표 줄은 공간과 물건의 이름을 짚는다", () => {
  useMemoryRoomStore.setState({ difficulty: "guided" });
  render(<HudGuideDock />);
  const text = screen.getByRole("status").textContent ?? "";
  expect(text).toContain("내 방에 있는");
  expect(text).toContain("조사해 보세요");
});
