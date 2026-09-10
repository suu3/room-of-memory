/**
 * 잠금화면 미니게임의 데이터. 순수 값만 두어 브라우저 없이 검증한다.
 *
 * 대사 본문은 여기 넣지 않는다. 시나리오 규칙(.claude/rules/visual-novel.md)대로
 * i18n 키만 담고 ko/en/ja는 common.json이 갖는다.
 */

import type { CommonTextKey } from "@/types/minigame";

/**
 * 비밀번호는 1019: calendar가 심은 "다 멈춘 날"(10월 19일)이 단서다.
 * 잠금화면의 힌트 문구(minigame.phoneLock.hint)가 그 날짜를 가리킨다.
 * 날짜를 바꾸려면 phone-chat의 date, phone-stopped/calendar-intro 대사까지
 * 한 세트로 움직여야 한다.
 */
export const PASSCODE = "1019";

/** 비밀번호 자릿수. 다 차면 자동으로 검사한다. 실제 폰과 같은 감각. */
export const PASSCODE_LENGTH = PASSCODE.length;

/** 이만큼 틀리면 스킵이 뜬다 (접근성 규칙: N회 실패 시 스킵 노출). */
export const FAILS_BEFORE_SKIP = 3;

export interface MomMessage {
  id: string;
  textKey: CommonTextKey;
  /** 보낸 시각: 그날(10월 19일) 저녁. 도해가 전화를 돌리기 시작한 20:31보다 앞선다. */
  time: string;
}

/**
 * 그날 엄마가 보낸 문자. 전파가 끊기며 묶여 있다가 2바퀴(라디오에 신호가
 * 돌아온 뒤)에야 도착한다. 그래서 이 미니게임은 unlockAfter: [radio] 뒤에 선다.
 *
 * 내용이 도해의 지금을 설명한다: 부모님은 그날 여행 중이었고(그래서 집에 없다),
 * 문 잠그고 기다리라고 했고, 바로 돌아오겠다고 했다. 그리고 오지 못했다.
 */
export const MOM_MESSAGES: MomMessage[] = [
  { id: "w1", textKey: "minigame.phoneLock.msg.w1", time: "17:58" },
  { id: "w2", textKey: "minigame.phoneLock.msg.w2", time: "18:23" },
  { id: "w3", textKey: "minigame.phoneLock.msg.w3", time: "18:24" },
];
