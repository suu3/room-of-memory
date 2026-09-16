import { SOLFEGE, type Solfege } from "./melody";

/**
 * 건반 한 벌의 치수와 자리. 피아노 **로컬 프레임**(거실 배율이 걸리기 전)의 값이다.
 * 몸통 부품과 같은 좌표계라(LivingRoomFurniture의 PIANO_PARTS) 몸통을 옮기면 같이 따라간다.
 *
 * 흰 건반 일곱과 검은 건반 다섯. 검은 건반은 실제 피아노처럼 2·3개로 갈라 붙는다
 * (도#·레# / 파#·솔#·라#). 다섯을 고르게 뿌리면 건반이 아니라 격자로 보인다.
 */

/** 건반 줄의 가운데 (몸통 중심과 같다). */
export const KEYBOARD_CENTER_X = -14.95;
/** 건반이 놓인 높이: 닫힌 뚜껑이 있던 자리. */
export const KEYBOARD_Y = 0.92;
/** 건반 줄의 앞뒤 가운데. 몸통 앞면(6.00)에서 앞으로 나온다. */
export const KEYBOARD_CENTER_Z = 5.95;

/** 흰 건반 일곱이 차지하는 폭. 몸통(1.5)보다 한 뼘 좁다. */
const WHITE_SPAN = 1.4;
/** 흰 건반 하나의 폭(틈 포함). */
const WHITE_PITCH = WHITE_SPAN / SOLFEGE.length;
/** 건반 사이의 틈. 이게 없으면 한 장의 판으로 보인다. */
const KEY_GAP = 0.012;

export interface PianoKey {
  note: Solfege;
  /** 검은 건반은 소리가 곡에 안 쓰인다. 눌리기는 하고, 틀린 음으로 친다. */
  black: boolean;
  /** 로컬 x·z 중심과 크기 [폭(x), 높이(y), 길이(z)]. */
  position: readonly [number, number, number];
  size: readonly [number, number, number];
}

/** 검은 건반이 붙는 자리: 흰 건반 i와 i+1 사이. 미·파와 시·도 사이에는 없다. */
const BLACK_AFTER = [0, 1, 3, 4, 5] as const;

const WHITE_SIZE = [WHITE_PITCH - KEY_GAP, 0.05, 0.3] as const;
const BLACK_SIZE = [WHITE_PITCH * 0.56, 0.055, 0.19] as const;

/**
 * 건반 줄의 **낮은 음 쪽** 끝. 로컬 +x다.
 *
 * 이 피아노의 앞면은 로컬 -z이므로, 앞에서 보면 로컬 +x가 화면 **왼쪽**이다. 도가
 * 왼쪽에 서려면 도의 x가 가장 커야 한다: 낮은 음에서 높은 음으로 +x가 줄어든다.
 * 반대로 두면 악보는 왼쪽부터 읽히는데 건반만 오른쪽부터 서서 둘이 어긋난다.
 */
const LOW_EDGE = KEYBOARD_CENTER_X + WHITE_SPAN / 2;

/**
 * 건반 한 벌. 흰 건반 일곱이 먼저, 검은 건반 다섯이 그 위에 얹힌다.
 *
 * 검은 건반의 z는 흰 건반보다 뒤쪽(+z)으로 물러나 있다. 이 피아노의 앞면은 로컬
 * -z다 (몸통 앞면 6.00, 그 앞에 건반). 실제 피아노처럼 흰 건반의 앞부분이 드러나야
 * 두 줄이 층으로 읽힌다.
 */
export const PIANO_KEYS: readonly PianoKey[] = [
  ...SOLFEGE.map((note, index) => ({
    note,
    black: false,
    position: [LOW_EDGE - WHITE_PITCH * (index + 0.5), KEYBOARD_Y, KEYBOARD_CENTER_Z] as const,
    size: WHITE_SIZE,
  })),
  ...BLACK_AFTER.map((index) => ({
    // 검은 건반은 바로 아래 흰 건반의 반음이다. 곡에 안 쓰이므로 이름은 그 건반을 따른다
    note: SOLFEGE[index],
    black: true,
    position: [
      LOW_EDGE - WHITE_PITCH * (index + 1),
      KEYBOARD_Y + WHITE_SIZE[1] / 2,
      KEYBOARD_CENTER_Z + (WHITE_SIZE[2] - BLACK_SIZE[2]) / 2,
    ] as const,
    size: BLACK_SIZE,
  })),
];

/** 눌린 건반이 내려가는 깊이. */
export const KEY_PRESS_DEPTH = 0.016;

/**
 * 열린 뚜껑이 젖혀지는 각(rad). 축은 건반 뒤쪽(+z) 모서리이고 뚜껑은 앞으로(-z)
 * 뻗어 있으므로, 양수 각이 뚜껑을 위로 들어 올린다.
 */
export const LID_OPEN_ANGLE = 1.15;
