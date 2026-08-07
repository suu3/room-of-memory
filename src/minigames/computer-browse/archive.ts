/**
 * 컴퓨터 미니게임의 데이터. 순수 값만 두어 브라우저 없이 검증한다.
 *
 * 본문은 i18n 키만 담고 ko/en/ja는 common.json이 갖는다
 * (.claude/rules/visual-novel.md — 대본은 데이터, 본문은 리소스).
 *
 * 인터넷은 그날 끊겼다 — 이 화면이 여는 것은 전부 "저장된 사본"이다. 컴퓨터는
 * 2바퀴에 한 번만 열리는 기억이라 메일함과 브라우저 캐시를 한 자리에서 다 본다:
 * 아빠의 여행 메일 두 통(그래서 부모님이 집에 없다) → 그날까지의 뉴스 셋
 * (그래서 세상이 멈췄다). 순서가 곧 도해가 알게 되는 순서다.
 */

import type { CommonTextKey } from "@/types/minigame";

/** 어느 앱으로 열린 사본인가. 창 제목줄이 이 값을 따라 바뀐다. */
export type ArchiveApp = "mail" | "news";

export interface ArchivePage {
  id: string;
  app: ArchiveApp;
  /** 메일 제목 또는 기사 헤드라인. */
  titleKey: CommonTextKey;
  /** 보낸/저장된 날짜 표기. */
  dateKey: CommonTextKey;
  bodyKeys: readonly CommonTextKey[];
  /**
   * 첨부 사진 파일명. 실제 이미지는 없다 — 회색 판이 자리를 지킨다
   * (컷씬 일러스트와 같은 규칙). 파일명은 번역하지 않는다.
   */
  attachments?: readonly string[];
  /** 저장이 중간에 끊긴 페이지 — 본문 뒤에 "여기서 저장이 끊겼다"가 붙는다. */
  truncated?: boolean;
}

/**
 * 아빠가 여행지에서 보낸 메일 두 통.
 *
 * 날짜가 일부러 그날(10월 19일) 직전이다: 15일 도착, 18일 "모레 돌아간다".
 * phone 2차의 문자("여행지에서 바로 출발했는데")와 한 타임라인으로 맞물린다 —
 * 그래서 폰 재조사가 컴퓨터를 기다린다 (content/memories.yaml).
 */
const MAIL_PAGES: readonly ArchivePage[] = [
  {
    id: "mail-arrived",
    app: "mail",
    titleKey: "minigame.computerBrowse.mail.m1.subject",
    dateKey: "minigame.computerBrowse.mail.m1.date",
    bodyKeys: ["minigame.computerBrowse.mail.m1.b1", "minigame.computerBrowse.mail.m1.b2"],
    attachments: ["IMG_2183.jpg", "IMG_2190.jpg"],
  },
  {
    id: "mail-return",
    app: "mail",
    titleKey: "minigame.computerBrowse.mail.m2.subject",
    dateKey: "minigame.computerBrowse.mail.m2.date",
    bodyKeys: ["minigame.computerBrowse.mail.m2.b1", "minigame.computerBrowse.mail.m2.b2"],
  },
];

/**
 * 브라우저 캐시에 남은 기사 세 개. 조금씩(12일) → 성큼(17일) → 한꺼번에(19일,
 * 저장이 끊긴 속보). 라디오가 연 세계를 시간순으로 편다.
 */
const NEWS_PAGES: readonly ArchivePage[] = [
  {
    id: "news-cases",
    app: "news",
    titleKey: "minigame.computerBrowse.news.n1.headline",
    dateKey: "minigame.computerBrowse.news.n1.date",
    bodyKeys: ["minigame.computerBrowse.news.n1.b1", "minigame.computerBrowse.news.n1.b2"],
  },
  {
    id: "news-spread",
    app: "news",
    titleKey: "minigame.computerBrowse.news.n2.headline",
    dateKey: "minigame.computerBrowse.news.n2.date",
    bodyKeys: ["minigame.computerBrowse.news.n2.b1", "minigame.computerBrowse.news.n2.b2"],
  },
  {
    id: "news-breaking",
    app: "news",
    titleKey: "minigame.computerBrowse.news.n3.headline",
    dateKey: "minigame.computerBrowse.news.n3.date",
    bodyKeys: ["minigame.computerBrowse.news.n3.b1"],
    truncated: true,
  },
];

/** 잠금을 푼 뒤 넘겨 보는 순서. 메일이 먼저다 — 사람이 먼저고 세상이 나중이다. */
export const ARCHIVE_PAGES: readonly ArchivePage[] = [...MAIL_PAGES, ...NEWS_PAGES];

/**
 * 부팅 로그. 한 줄씩 찍히다 마지막 줄에서 잠금 화면으로 넘어간다.
 *
 * 켜지는 데 시간이 걸리는 것 자체가 연출이다 — 몇 주 만에 처음 도는 기계이고,
 * 그 몇 초가 "이걸 켜도 되나" 하는 망설임의 자리다. 그래도 붙잡아 두지는 않는다:
 * 아무 키나 누르면 곧장 마지막 줄로 건너뛴다.
 */
export const BOOT_LINES: readonly CommonTextKey[] = [
  "minigame.computerBrowse.boot.l1",
  "minigame.computerBrowse.boot.l2",
  "minigame.computerBrowse.boot.l3",
  "minigame.computerBrowse.boot.l4",
];

/** 부팅 로그 한 줄이 찍히는 간격(ms). */
export const BOOT_LINE_MS = 520;
/** 마지막 줄이 찍힌 뒤 잠금 화면이 뜨기까지(ms). */
export const BOOT_SETTLE_MS = 700;
/** 몇 번 틀리면 스킵을 내주는가 (시간 경과 쪽이 먼저 오면 그쪽이 이긴다). */
export const FAILS_BEFORE_SKIP = 4;
