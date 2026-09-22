/**
 * 실험실 목록. 데모 페이지를 추가하면 여기 한 줄 적는다. 프로덕션 빌드에는 없다.
 */
export const LAB_ENTRIES: readonly { slug: string; title: string; note: string }[] = [
  {
    slug: "ball-ripple",
    title: "사인볼 · 필드 잉크 파문",
    note: "타점에서 잉크가 번진다. intensity가 감쇠: 어두운 방일수록 파문이 빨리 잔다.",
  },
  {
    slug: "calendar-tally",
    title: "달력 正자 획",
    note: "正을 SVG 다섯 획으로 그리고, 장이 드러날 때 획이 순서대로 그어진다. 미완 획은 버틴 날의 나머지.",
  },
  {
    slug: "radio-noise",
    title: "라디오 잡음 · 필름 룩 채널과 표시창 파형",
    note: "튜닝 거리가 filmLookInput.static으로 흘러가는 값과, 잡음 베드에서 읽은 표시창 파형.",
  },
];
