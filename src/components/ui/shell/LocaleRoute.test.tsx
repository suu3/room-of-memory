/** @vitest-environment jsdom */

import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { i18n } from "@/i18n/config";
import { useSettingsStore } from "@/store/settings";
import { I18nProvider } from "./I18nProvider";
import { LocaleRoute } from "./LocaleRoute";

describe("LocaleRoute", () => {
  afterEach(async () => {
    cleanup();
    act(() => useSettingsStore.getState().setLocale("ko"));
    await i18n.changeLanguage("ko");
    window.history.replaceState(null, "", "/");
  });

  it("저장된 언어가 ja인 채 루트로 들어오면 주소가 /ja로 바뀐다", async () => {
    act(() => useSettingsStore.getState().setLocale("ja"));
    render(
      <I18nProvider>
        <LocaleRoute locale={null} />
      </I18nProvider>,
    );

    await waitFor(() => expect(window.location.pathname).toBe("/ja"));
  });

  it("Next가 머리를 뒤늦게 다시 그려 한국어 제목을 되돌려 놓아도 지금 언어의 제목으로 돌아온다", async () => {
    act(() => useSettingsStore.getState().setLocale("ja"));
    render(
      <I18nProvider>
        <LocaleRoute locale={null} />
      </I18nProvider>,
    );
    await waitFor(() => expect(document.title).toBe("記憶の部屋"));

    // 루트(/) 페이지의 메타데이터가 뒤늦게 하이드레이션되며 <title>의 글자를 되돌린다
    document.title = "기억의 방";

    await waitFor(() => expect(document.title).toBe("記憶の部屋"));
  });
});
