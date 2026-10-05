/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it } from "vitest";
import { i18n } from "@/i18n/config";
import { useMemoryRoomStore } from "@/store/memory-room";
import { NotebookDeductions } from "./NotebookDeductions";

beforeEach(async () => {
  await i18n.changeLanguage("ko");
  useMemoryRoomStore.getState().reset();
});

afterEach(cleanup);

it("이어 낸 추리만 남는다: 어긋났던 말, 이은 기록 두 장, 도해의 한 줄", () => {
  useMemoryRoomStore.setState({
    revisited: ["fridge", "shoes", "computer", "phone"],
    deduced: ["trip-doubt"],
  });
  render(<NotebookDeductions />);

  expect(screen.getByText(/2박 3일, 가볍게 근교만 돌다 올 거야/)).toBeTruthy();
  expect(screen.getByText("채워 둔 것들")).toBeTruthy();
  expect(screen.getByText("두고 간 등산화")).toBeTruthy();
  expect(screen.getByText(/2박 3일 치 짐이 아니었다/)).toBeTruthy();
  // 아직 잇지 않은 추리는 자리도 없다
  expect(screen.queryByText(/평소 같은 잔소리였다/)).toBeNull();
});
