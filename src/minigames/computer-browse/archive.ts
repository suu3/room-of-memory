/**
 * 컴퓨터 미니게임의 데이터. 순수 값만 두어 브라우저 없이 검증한다.
 *
 * 본문은 i18n 키만 담고 ko/en/ja는 common.json이 갖는다
 * (.claude/rules/visual-novel.md — 대본은 데이터, 본문은 리소스).
 *
 * 인터넷은 그날 끊겼다 — 이 화면이 여는 것은 전부 "저장된 사본"이다.
 * 1바퀴는 메일함(아빠의 여행 메일), 2바퀴는 브라우저 캐시(그날까지의 뉴스).
 * 같은 컴포넌트가 gamePhase를 보고 가른다.
 */

import type { CommonTextKey } from "@/types/minigame";

export interface ArchivePage {
  id: string;
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
 * 1바퀴 — 아빠가 여행지에서 보낸 메일 두 통.
 *
 * 날짜가 일부러 그날(10월 19일) 직전이다: 15일 도착, 18일 "모레 돌아간다".
 * phone 2차의 문자("여행지에서 바로 출발했는데")와 한 타임라인으로 맞물린다.
 */
export const MAIL_PAGES: readonly ArchivePage[] = [
  {
    id: "mail-arrived",
    titleKey: "minigame.computerBrowse.mail.m1.subject",
    dateKey: "minigame.computerBrowse.mail.m1.date",
    bodyKeys: ["minigame.computerBrowse.mail.m1.b1", "minigame.computerBrowse.mail.m1.b2"],
    attachments: ["IMG_2183.jpg", "IMG_2190.jpg"],
  },
  {
    id: "mail-return",
    titleKey: "minigame.computerBrowse.mail.m2.subject",
    dateKey: "minigame.computerBrowse.mail.m2.date",
    bodyKeys: ["minigame.computerBrowse.mail.m2.b1", "minigame.computerBrowse.mail.m2.b2"],
  },
];

/**
 * 2바퀴 — 브라우저 캐시에 남은 기사 세 개. 조금씩(12일) → 성큼(17일) →
 * 한꺼번에(19일, 저장이 끊긴 속보). 라디오가 연 세계를 시간순으로 편다.
 */
export const NEWS_PAGES: readonly ArchivePage[] = [
  {
    id: "news-cases",
    titleKey: "minigame.computerBrowse.news.n1.headline",
    dateKey: "minigame.computerBrowse.news.n1.date",
    bodyKeys: ["minigame.computerBrowse.news.n1.b1", "minigame.computerBrowse.news.n1.b2"],
  },
  {
    id: "news-spread",
    titleKey: "minigame.computerBrowse.news.n2.headline",
    dateKey: "minigame.computerBrowse.news.n2.date",
    bodyKeys: ["minigame.computerBrowse.news.n2.b1", "minigame.computerBrowse.news.n2.b2"],
  },
  {
    id: "news-breaking",
    titleKey: "minigame.computerBrowse.news.n3.headline",
    dateKey: "minigame.computerBrowse.news.n3.date",
    bodyKeys: ["minigame.computerBrowse.news.n3.b1"],
    truncated: true,
  },
];

export function pagesFor(gamePhase: 1 | 2): readonly ArchivePage[] {
  return gamePhase === 2 ? NEWS_PAGES : MAIL_PAGES;
}
