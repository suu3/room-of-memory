/**
 * 실험실 목록. 데모 페이지를 추가하면 여기 한 줄 적는다. 프로덕션 빌드에는 없다.
 */
export const LAB_ENTRIES: readonly { slug: string; title: string; note: string }[] = [
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
];
