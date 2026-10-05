import { describe, expect, it } from "vitest";
import en from "@/i18n/locales/en/common.json";
import ja from "@/i18n/locales/ja/common.json";
import ko from "@/i18n/locales/ko/common.json";
import { CALENDAR_MONTHS, isNationalsDay, markedDayOf } from "@/minigames/calendar-flip/calendar";
import {
  CLUE_AFTER_MEMORY,
  CLUE_DISCOVERY,
  CLUE_IDS,
  COMPUTER_PASSCODE,
  COMPUTER_PASSCODE_LENGTH,
  DISCOVERY_IDS,
  NATIONALS_DATE,
  VISIT_AFTER_DISCOVERY,
} from "./room-clues";

const LOCALES = { ko, en, ja };

describe("컴퓨터 비밀번호 단서", () => {
  it("비밀번호는 달력에 표시된 날 그대로다", () => {
    /*
     * 이게 어긋나면 아무리 방을 뒤져도 안 맞는 비밀번호가 된다. 달력에 그어진
     * 날과 잠금 화면이 받는 네 자리는 반드시 같은 값에서 나와야 한다.
     */
    expect(COMPUTER_PASSCODE).toBe("0812");
    expect(COMPUTER_PASSCODE_LENGTH).toBe(4);
    expect(COMPUTER_PASSCODE).toMatch(/^\d{4}$/);
    expect(COMPUTER_PASSCODE.slice(0, 2)).toBe(String(NATIONALS_DATE.month).padStart(2, "0"));
    expect(COMPUTER_PASSCODE.slice(2)).toBe(String(NATIONALS_DATE.day).padStart(2, "0"));
  });

  it("표시된 날이 달력에 걸린 장 안에 있다", () => {
    // 걸려 있지 않은 달이면 표시를 볼 장이 없어 단서가 사라진다
    expect(CALENDAR_MONTHS).toContain(NATIONALS_DATE.month);
    expect(isNationalsDay(NATIONALS_DATE.month, NATIONALS_DATE.day)).toBe(true);
    expect(markedDayOf(NATIONALS_DATE.month)).toBe("nationals");
  });

  it("동그라미는 이 하나뿐이다. 사건이 난 달에는 표시가 없다", () => {
    expect(markedDayOf(10)).toBeNull();
  });

  it("달력은 조사를 마친 뒤 배경 오브젝트가 된다", () => {
    expect(CLUE_AFTER_MEMORY.calendar).toBe("wall-calendar");
    expect(CLUE_IDS).toContain("wall-calendar");
  });

  it("단서 본문이 ko/en/ja 셋 다 채워져 있다", () => {
    const keys = [
      "read",
      "close",
      "wallCalendar.title",
      "workbook.title",
      "workbook.alt",
      "workbook.hint",
      "workbook.tagLabel",
      "workbook.zoomIn",
      "workbook.zoomOut",
      "workbook.caption",
      "laonSanitizer.title",
      "laonSanitizer.label",
      "laonSanitizer.alt",
      "laonSanitizer.caption",
    ];

    for (const [locale, resource] of Object.entries(LOCALES)) {
      for (const key of keys) {
        const text = key
          .split(".")
          .reduce<unknown>(
            (node, part) =>
              node && typeof node === "object"
                ? (node as Record<string, unknown>)[part]
                : undefined,
            resource.clue,
          );
        expect(typeof text === "string" && text.trim() !== "", `${locale}: clue.${key}`).toBe(true);
      }
    }
  });

  it("달력 표시 설명이 날짜를 값으로 받는다. 문구에 숫자를 박지 않는다", () => {
    for (const [locale, resource] of Object.entries(LOCALES)) {
      const mark = resource.minigame.calendarFlip.mark;
      for (const [name, text] of Object.entries(mark)) {
        expect(text, `${locale}: mark.${name}`).toContain("{{month}}");
        expect(text, `${locale}: mark.${name}`).toContain("{{day}}");
      }
    }
  });

  it("단서 id는 kebab-case다. 3D 오브젝트 이름에 그대로 들어간다", () => {
    for (const id of [...CLUE_IDS, ...DISCOVERY_IDS]) {
      expect(id).toMatch(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/);
    }
  });

  it("뒤집어야 나오는 단서는 있는 단서·있는 사실을 잇는다", () => {
    // 문제집 뒤표지의 이름. 짝이 어긋나면 돌려봐도 아무것도 안 열린다
    for (const [clue, discovery] of Object.entries(CLUE_DISCOVERY)) {
      expect(CLUE_IDS).toContain(clue);
      expect(DISCOVERY_IDS).toContain(discovery);
    }
    expect(CLUE_DISCOVERY.workbook).toBe("hero-name");
  });

  it("세면대 바닥의 소독제 병: 물을 빼면 나오는 단서이고, 컴퓨터 3차가 그 뒤에 열린다", () => {
    expect(CLUE_IDS).toContain("laon-sanitizer");
    expect(CLUE_DISCOVERY["laon-sanitizer"]).toBe("laon-sanitizer");
    expect(VISIT_AFTER_DISCOVERY.computer).toEqual({ visit: 3, discovery: "laon-sanitizer" });
    for (const { discovery } of Object.values(VISIT_AFTER_DISCOVERY)) {
      expect(DISCOVERY_IDS).toContain(discovery);
    }
    // 소독제 병에는 이름이 없다. 안내도 이름을 대지 않고, 접속 기록의 맞힌 줄이 처음 댄다
    for (const [locale, resource] of Object.entries(LOCALES)) {
      const name = locale === "ko" ? "라온" : locale === "en" ? "Laon" : "ラオン";
      expect(resource.clue.laonSanitizer, locale).not.toHaveProperty("name");
      expect(resource.minigame.computerLogo.help, locale).not.toContain(name);
      expect(resource.minigame.computerLogo.help_touch, locale).not.toContain(name);
      expect(resource.minigame.computerLogo.portal.org, locale).toContain(name);
    }
  });

  it("이름을 알기 전의 화자 이름표가 ko/en/ja 셋 다 있다", () => {
    for (const [locale, resource] of Object.entries(LOCALES)) {
      expect(resource.speaker.unknownHero.trim(), `${locale}: speaker.unknownHero`).not.toBe("");
    }
  });
});
