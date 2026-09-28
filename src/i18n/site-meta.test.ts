import { describe, expect, it } from "vitest";
import { LOCALE_PATHS, localeOfPath } from "./locale-routes";
import { localeMetadata } from "./site-meta";

describe("언어 주소", () => {
  it("/en · /ja는 그 언어를, 루트와 다른 주소는 강제하지 않는다", () => {
    expect(localeOfPath("/en")).toBe("en");
    expect(localeOfPath("/ja")).toBe("ja");
    expect(localeOfPath("/contact")).toBeNull();
  });

  it("미리보기 문구는 게임 안의 제목과 타이틀 문구를 그 언어로 쓴다", () => {
    const ja = localeMetadata("ja");
    expect(ja.title).toBe("記憶の部屋");
    expect(ja.description).toBe("閉じた部屋に散らばった記憶を、ひとつずつ取り戻す物語。");
    expect(ja.openGraph).toMatchObject({ locale: "ja_JP", url: "/ja" });
    expect(localeMetadata("en").title).toBe("Room of Memory");
  });

  it("세 주소가 서로를 번역본으로 가리킨다 (hreflang)", () => {
    for (const locale of ["ko", "en", "ja"] as const) {
      const { alternates } = localeMetadata(locale);
      expect(alternates?.canonical).toBe(LOCALE_PATHS[locale]);
      expect(alternates?.languages).toMatchObject({ ...LOCALE_PATHS, "x-default": "/" });
    }
  });
});
