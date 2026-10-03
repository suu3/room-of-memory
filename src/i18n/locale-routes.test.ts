/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from "vitest";
import { LOCALE_STORAGE_KEY, langBootScript } from "./locale-routes";

/** 주소와 저장된 언어를 차려 놓고 스크립트를 돌린 뒤의 `<html lang>`. */
function langAfterBoot(pathname: string, saved?: string): string {
  window.history.replaceState(null, "", pathname);
  if (saved) localStorage.setItem(LOCALE_STORAGE_KEY, JSON.stringify({ state: { locale: saved } }));
  document.documentElement.lang = "ko";
  new Function(langBootScript())();
  return document.documentElement.lang;
}

describe("첫 화면 전에 html lang을 맞추는 스크립트", () => {
  afterEach(() => {
    localStorage.clear();
    window.history.replaceState(null, "", "/");
  });

  it("언어 주소는 그 언어다. 저장된 선택보다 링크가 앞선다", () => {
    expect(langAfterBoot("/en")).toBe("en");
    expect(langAfterBoot("/ja", "ko")).toBe("ja");
  });

  it("언어 주소 아래의 페이지도 그 언어다", () => {
    expect(langAfterBoot("/ja/films", "ko")).toBe("ja");
    expect(langAfterBoot("/en/films")).toBe("en");
    expect(langAfterBoot("/films", "ja")).toBe("ja");
  });

  it("루트는 저장된 선택을 따르고, 없으면 한국어다", () => {
    expect(langAfterBoot("/")).toBe("ko");
    expect(langAfterBoot("/", "ja")).toBe("ja");
  });

  it("언어 주소가 아닌 페이지도 저장된 선택을 따른다", () => {
    expect(langAfterBoot("/contact", "en")).toBe("en");
  });

  it("저장본이 깨져 있으면 건드리지 않는다", () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, "{not json");
    expect(langAfterBoot("/contact")).toBe("ko");
    localStorage.setItem(LOCALE_STORAGE_KEY, JSON.stringify({ state: { locale: "fr" } }));
    expect(langAfterBoot("/contact")).toBe("ko");
  });
});
