---
name: Room of Memory
version: 0.2.0
colors:
  primary: "#B89A5E"
  memory: "#B89A5E"
  ember: "#9E5244"
  ink: "#20222A"
  night: "#0B111A"
  paper: "#EFE7D6"
  bone: "#D8D0C2"
  fog: "#9A8B72"
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
    fontWeight: 700
    letterSpacing: 0.06em
  ui:
    fontFamily: Pretendard
    fontSize: 0.75rem
    fontWeight: 500
    letterSpacing: 0.1em
  monologue:
    fontFamily: Pretendard
    fontSize: 1.5rem
    fontWeight: 400
  handwriting:
    fontFamily: Nanum Pen Script
    fontSize: 1.5rem
    fontWeight: 400
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
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.dialogue}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
  memory-slot-empty:
    backgroundColor: "{colors.bone}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
  speaker-chip:
    backgroundColor: "{colors.ember}"
    textColor: "{colors.paper}"
    typography: "{typography.speaker}"
    rounded: "{rounded.sm}"
  monologue:
    textColor: "{colors.fog}"
    typography: "{typography.monologue}"
  choice-button:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.ui}"
    rounded: "{rounded.lg}"
    padding: "{spacing.md}"
  choice-button-hover:
    backgroundColor: "{colors.memory}"
    textColor: "{colors.night}"
  progress-count:
    textColor: "{colors.ember}"
    typography: "{typography.ui}"
---

## Overview

Room of Memory는 3D 공간을 돌아다니며 기억의 조각을 마주하는 짧은 비주얼 노벨이다. 좀비 사태로 무너진 세계, 자기 방에 오래 고립된 야구부 고등학생 '도현'의 방이 무대다. 화면의 대부분은 3D 씬이 차지하고, UI는 도현의 수첩에서 뜯어낸 종이 조각처럼 어두운 씬 위에 붙는다(스크랩북 메타포) — 항상 씬이 주인공이다.

UI 패널·칩은 밝은 크림 종이(paper) 바탕에 잉크(ink) 텍스트, 통통한 라운드({rounded.lg}), 두꺼운 bone 테두리(2px)를 기본으로 한다. 스티커처럼 미세하게 기울여 붙이는 것(±1°)을 허용한다 — 손으로 붙인 느낌. 어둡고 무거운 오버레이는 쓰지 않는다: 귀엽고 따뜻한 종이 UI와 쓸쓸한 씬의 대비가 이 게임의 정서다.

무드: 따뜻했던 일상이 바랜 느낌. 색 바랜 크림/세피아 톤과 어두운 네이비 그림자, 포인트는 야구공 실밥을 상징하는 레드 스티치 하나만 소량. 종이 질감·필름 그레인·손글씨 디테일. 공포가 아니라 쓸쓸함과 그리움.

## Colors

- **primary / memory** — 같은 값(금빛). 이 게임의 시그니처 컬러. 기억(수집 대상), 커튼 틈의 빛, 인터랙션 가능한 대상에만 쓴다. 기억을 모을수록 화면에서 이 색의 비중이 늘어나는 것이 핵심 연출이므로, 장식으로 남용하면 연출이 죽는다.
- **ember** — 레드 스티치. 화자 칩, 대사창의 스티치 라인, 진행 화살표 등 "도현"의 흔적에만 쓴다. 원 목업 값은 #A85B4E이나, paper 텍스트와의 대비를 WCAG AA(4.5:1)로 맞추기 위해 #9E5244로 조정했다.
- **ink** — 종이 패널 위 본문 텍스트(펜 잉크). 옅은 보조 텍스트는 ink의 60~75% 불투명으로.
- **night** — 페이지 바탕. 순수 검정 대신 이 값으로 3D 씬의 어둠과 톤을 맞춘다.
- **paper / bone** — 종이 패널 바탕(paper)과 그 테두리·바랜 크림(bone) 쌍. 어두운 씬 위에 직접 얹는 텍스트(혼잣말 등)에도 bone을 쓴다.
- **fog** — 세피아 보조 텍스트. 어두운 씬 위 전용 — paper 위에서는 대비가 부족하므로 ink 불투명 변형을 쓴다.

### 씬 라이팅 램프

방의 밝기 3단계(어둠 → 어스름 → 금빛)를 만드는 그라디언트 스톱. UI 토큰이 아니라 씬 아트워크 값이며, `globals.css`의 `--color-scene-*`로만 노출한다.

| 토큰 | 값 | 용도 |
|---|---|---|
| scene-slate | #1C2A38 | 1단계 중단 / 2단계 하단 |
| scene-mist | #16212C | (예비 어둠 톤 — 현재 미사용) |
| scene-deep | #0F181E | 바닥 하단, 칩 바탕 |
| scene-storm | #2A3D48 | 1·2단계 상단, 미니게임 필드 |
| scene-abyss | #121C24 | 1단계 하단 |
| scene-olive | #4A4436 | 3단계 상단 (금빛이 스민 벽) |
| scene-dusk | #2E3540 | 2·3단계 중단, 미니게임 패널 |
| scene-coal | #17202A | 3단계 하단 |
| scene-navy | #161F28 | 바닥 상단, 문 활성 텍스트 |
| scene-void | #060A10 | 비네트 |

## Typography

본문 서체는 Pretendard(셀프호스팅 가변폰트), 손글씨는 Nanum Pen Script(next/font/google 셀프호스팅) 두 개로 통일한다.

- **dialogue** — 대사 본문. 행간 1.8은 읽는 속도를 늦추기 위한 의도적 선택이므로 줄이지 않는다.
- **monologue** — 화면 상단 혼잣말. 본문과 같은 Pretendard, 대사보다 큰 1.5rem.
- **speaker** — 화자 이름. ember 칩 위에 얹는다.
- **handwriting** — 기억 항목의 한 줄 요약, 메모. 도현의 육필이라는 설정이므로 시스템 메시지에는 쓰지 않는다.
- **ui** — HUD 라벨. 자간을 넓혀(0.1em+) 라벨임을 드러낸다.
- **display** — 챕터 타이틀, 엔딩 카드 등 큰 화면 전환에만.

## Texture

- **필름 그레인** — SVG feTurbulence 노이즈를 `mix-blend-mode: overlay`, opacity 0.13으로 씬 전체에 1장. UI 패널 위에는 얹지 않는다.
- **레드 스티치** — 2px대 dashed border(ember)를 타이틀 앞, 대사창 모서리 등에 짧게. 야구공 실밥의 인용이므로 길게 두르지 않는다.
- **비네트** — scene-void 라디얼. 기억을 모을수록 옅어진다 (0.55 → 0.3). 1단계도 "밝았던 방이 바랜" 정도로만 어둡게 — 완전한 암전은 쓰지 않는다.

## Motion

- UI 등장/퇴장은 opacity + 미세한 translate로, 200~300ms. 튀는 스프링 애니메이션은 이 게임의 톤과 맞지 않는다.
- 방이 밝아지는 전환(배경/빛줄기/워시)은 800~1200ms의 느린 크로스페이드 — 조명이 바뀌는 것이지 화면이 바뀌는 것이 아니다.
- 미수집 기억 핫스팟은 2.4s 주기의 느린 글로우 펄스. 수집하면 펄스를 멈추고 가라앉힌다.
- 텍스트는 타자기식 출력(글자 단위 reveal)을 기본으로 하고, 클릭 시 즉시 완성한다.
- 카메라 전환은 컷이 아니라 damp/lerp 이동을 기본으로 한다.

## Accessibility

- 텍스트 대비는 WCAG AA 이상 (ink on paper 12.9:1, paper on ember 4.6:1). fog는 paper 위 텍스트로 쓰지 않는다.
- 모든 인터랙션은 키보드로도 가능해야 한다 (Tab으로 핫스팟 이동, Space/Enter = 진행, 숫자 = 선택지).
- 핫스팟 글로우 등 반복 애니메이션은 정보 전달을 색/애니메이션에만 의존하지 않는다 (라벨 텍스트 병기).
