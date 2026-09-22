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
  {
    slug: "monologue-exit",
    title: "혼잣말 물러남 · 글자 단위",
    note: "1막은 말끝부터 흐려지며 떨어지고, 2막부터는 아래에서 위로 모이며 사라진다. 등장(타자기)은 그대로.",
  },
  {
    slug: "cut-dissolve",
    title: "회상 컷 간 · 노이즈 threshold dissolve",
    note: "컷이 바뀔 때 scene-void 장막이 노이즈 결(종이 섬유 · 필름 그레인 · 물 얼룩)을 따라 걷힌다. intensity가 걷히는 시간.",
  },
  {
    slug: "sink-water",
    title: "세면대의 물 · 파문과 굴절",
    note: "열쇠를 집는 순간 고인 물에 파문 하나가 번지고 배수구가 굴절로 흔들리다 잔다. intensity가 진폭, disabled는 잔잔한 물만.",
  },
  {
    slug: "redaction",
    title: "깨진 글리프 · 연구 서류",
    note: "안방 서류의 몇 단어가 지워지거나 깨져 있다. hover 복원 없음. intensity가 깨지는 비율이고 ko/en/ja는 같은 상대 위치에서 깨진다.",
  },
  {
    slug: "photo-particles",
    title: "가족사진 액자 · 입자로 풀리고 모이는 사진",
    note: "사진이 입자로 날아와 모이고 커서가 스치면 풀린다. 1차는 부모 얼굴 자리가 끝까지 안 모이고, 2차는 얼굴까지 모인다. intensity가 커서 반경.",
  },
  {
    slug: "console-pixels",
    title: "게임기 · 픽셀 블록과 PRESS START",
    note: "격투 게임 화면의 도트가 1막 진행도에 따라 1px에서 4px로 굵어진다(SVG 필터, 레이아웃 불변). 2P 슬롯에는 아무도 안 누르는 PRESS START가 1Hz로 깜빡인다. intensity가 블록 크기.",
  },
];
