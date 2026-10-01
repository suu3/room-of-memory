/** @vitest-environment jsdom */

import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { i18n } from "@/i18n/config";
import { useSettingsStore } from "@/store/settings";
import { I18nProvider } from "./I18nProvider";

describe("I18nProvider", () => {
  afterEach(async () => {
    cleanup();
    act(() => useSettingsStore.getState().setLocale("ko"));
    await i18n.changeLanguage("ko");
  });

  it("탭 제목과 html lang을 고른 언어에 맞춘다", async () => {
    render(<I18nProvider>{null}</I18nProvider>);

    await waitFor(() => {
      expect(document.title).toBe("기억의 방");
      expect(document.documentElement.lang).toBe("ko");
    });

    act(() => useSettingsStore.getState().setLocale("en"));

    await waitFor(() => {
      expect(document.title).toBe("Room of Memory");
      expect(document.documentElement.lang).toBe("en");
    });

    act(() => useSettingsStore.getState().setLocale("ja"));

    await waitFor(() => expect(document.title).toBe("記憶の部屋"));
  });
});
