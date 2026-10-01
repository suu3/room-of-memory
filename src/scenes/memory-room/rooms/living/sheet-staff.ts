/**
 * 오선지 위에서 음표가 앉는 높이 (보면대의 악보, PianoSheet).
 *
 * 이 악보에는 높은음자리표가 서 있고, 그 표가 정하는 것은 **맨 아랫줄이 미(E4)**라는
 * 한 가지다. 나머지는 거기서 한 칸씩 세면 나온다: 줄과 칸을 번갈아 오르내리므로
 * 계이름 한 걸음이 줄 간격의 절반이다. 도(C4)는 미에서 두 걸음 아래, 곧 오선 **밖**이라
 * 제 덧줄을 하나 깔고 앉는다.
 *
 * 그림이 아니라 계산이라 여기 있다. 반음 하나가 어긋나면 악보를 읽는 사람에게는
 * 다른 곡이 된다: 솔미미(G-E-E)는 단3도로 떨어지는데 한 칸 위로 밀린 라파파(A-F-F)는
 * 장3도다. 계이름 글자는 맞는데 음표만 틀린 악보는 소품이 아니라 오류다.
 */

import { SOLFEGE, type Solfege } from "@/minigames/piano-melody/melody";

/** 오선의 자리(px, 악보 텍스처 기준): 맨 윗줄의 y, 줄 간격, 그리고 줄의 양 끝. */
export const STAFF = { top: 30, gap: 14, left: 34, right: 478 } as const;

/** 오선 맨 아랫줄의 y. 다섯 줄 중 마지막. */
export const STAFF_BOTTOM_Y = STAFF.top + STAFF.gap * 4;

/** 오선 한가운데 줄의 y. 음표 기둥이 방향을 바꾸는 자리다. */
const STAFF_MIDDLE_Y = STAFF.top + STAFF.gap * 2;

/** 높은음자리표가 정하는 단 하나: 맨 아랫줄에 앉는 계이름. */
const BOTTOM_LINE_NOTE: Solfege = "mi";

/** 계이름 한 걸음의 높이. 줄 → 칸 → 줄이므로 줄 간격의 절반이다. */
const STEP = STAFF.gap / 2;

/** 이 계이름이 앉는 y. 위로 갈수록 작아진다. */
export function staffY(note: Solfege): number {
  const steps = SOLFEGE.indexOf(note) - SOLFEGE.indexOf(BOTTOM_LINE_NOTE);
  return STAFF_BOTTOM_Y - steps * STEP;
}

/**
 * 이 음표가 깔고 앉아야 하는 덧줄들의 y. 오선 안이면 빈 배열이다.
 *
 * 오선 밖으로 나간 음표는 제가 몇 번째 줄인지 스스로 말해야 한다. 한 옥타브 안에서는
 * 도 하나만 이 줄을 부르지만, 규칙으로 적어 둬야 음역을 넓혀도 그림이 따라온다.
 */
export function ledgerLines(note: Solfege): number[] {
  const y = staffY(note);
  const lines: number[] = [];
  for (let line = STAFF_BOTTOM_Y + STAFF.gap; line <= y; line += STAFF.gap) lines.push(line);
  for (let line = STAFF.top - STAFF.gap; line >= y; line -= STAFF.gap) lines.push(line);
  return lines;
}

/**
 * 이 음표의 기둥이 위로 서는가. 가운데 줄부터는 아래로 내려 긋는다.
 *
 * 오선 밖으로 기둥이 삐져나가지 않게 하는 규칙이다. 지금 곡의 여섯 음은 모두 가운데
 * 줄 아래라 전부 위로 서지만, 규칙 없이 두면 높은 음을 하나 들이는 순간 틀린다.
 */
export function stemUp(note: Solfege): boolean {
  return staffY(note) > STAFF_MIDDLE_Y;
}
