---
name: Room of Memory
version: 0.1.0
colors:
  primary: "#8C7AA9"
  ink: "#1A1721"
  paper: "#F2EDE4"
  memory: "#8C7AA9"
  ember: "#C96F4A"
  fog: "#9A94A3"
  night: "#0C0A12"
typography:
  display:
    fontFamily: Pretendard
    fontSize: 2.5rem
    fontWeight: 700
    lineHeight: 1.2
  dialogue:
    fontFamily: Pretendard
    fontSize: 1.125rem
    fontWeight: 400
    lineHeight: 1.8
  speaker:
    fontFamily: Pretendard
    fontSize: 0.875rem
    fontWeight: 600
    letterSpacing: 0.08em
  ui:
    fontFamily: Pretendard
    fontSize: 0.9375rem
    fontWeight: 500
rounded:
  sm: 6px
  md: 12px
  lg: 20px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 32px
  xl: 64px
components:
  dialogue-box:
    backgroundColor: "{colors.night}"
    textColor: "{colors.paper}"
    typography: "{typography.dialogue}"
    rounded: "{rounded.md}"
    padding: "{spacing.lg}"
  choice-button:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.ui}"
    rounded: "{rounded.sm}"
    padding: "{spacing.md}"
  choice-button-hover:
    backgroundColor: "{colors.memory}"
    textColor: "{colors.night}"
  speaker-label:
    textColor: "{colors.fog}"
    typography: "{typography.speaker}"
  emphasis-text:
    textColor: "{colors.ember}"
    typography: "{typography.dialogue}"
---

## Overview

Room of Memory는 3D 공간을 돌아다니며 기억의 조각을 마주하는 짧은 비주얼 노벨이다. 화면의 대부분은 3D 씬이 차지하고, UI는 그 위에 얇게 얹힌 막처럼 존재해야 한다. UI가 씬과 경쟁하면 안 된다 — 항상 씬이 주인공이다.

## Colors

- **primary / memory** — 같은 값. 이 게임의 시그니처 컬러이며, 스펙 호환을 위해 primary라는 이름으로도 노출한다. 프로즈에서는 memory로 부른다.
- **ink / paper** — 기본 전경/배경 쌍. 텍스트가 놓이는 모든 곳의 기본값.
- **memory** — 이 게임의 시그니처 컬러. 인터랙션 가능한 대상(선택지 호버, 클릭 가능한 오브젝트의 아웃라인, 링크)에만 아껴서 사용한다. 장식으로 남용하지 말 것.
- **ember** — 감정이 고조되는 순간의 강조색. 챕터당 한두 번 나오는 수준으로 희소해야 의미가 생긴다.
- **fog** — 비활성/보조 텍스트 (지문, 타임스탬프, 비활성 버튼).
- **night** — 대사창과 오버레이의 바탕. 순수 검정(#000) 대신 이 값을 써서 3D 씬의 어둠과 톤을 맞춘다.

3D 씬의 라이팅 컬러도 가능하면 이 팔레트에서 파생시킨다 (예: 앰비언트는 night 계열, 포인트 라이트는 ember/memory 계열).

## Typography

본문 서체는 Pretendard 하나로 통일한다 (한글 본문 게임이므로 서브셋 woff2를 `public/assets/fonts/`에 둔다).

- **dialogue** — 대사 본문. 행간 1.8은 읽는 속도를 늦추기 위한 의도적 선택이므로 줄이지 않는다.
- **speaker** — 화자 이름. 자간을 넓혀 라벨임을 드러낸다.
- **display** — 챕터 타이틀, 엔딩 카드 등 큰 화면 전환에만.

## Motion

- UI 등장/퇴장은 opacity + 미세한 translate로, 200~300ms. 튀는 스프링 애니메이션은 이 게임의 톤과 맞지 않는다.
- 텍스트는 타자기식 출력(글자 단위 reveal)을 기본으로 하고, 클릭 시 즉시 완성한다.
- 카메라 전환은 컷이 아니라 damp/lerp 이동을 기본으로 한다.

## Accessibility

- 대사 텍스트 대비는 WCAG AA 이상 (paper on night는 충족).
- 모든 인터랙션은 키보드로도 가능해야 한다 (Space/Enter = 진행, 숫자 = 선택지).
