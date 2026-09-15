---
name: Room of Memory
version: 0.4.0
colors:
  primary: "#D5AE78"
  memory: "#D5AE78"
  ember: "#B8655A"
  night: "#0B1320"
  panel: "#172330"
  ivory: "#E8E9E5"
  fog: "#B8C1CD"
  ash: "#929EAF"
  paper: "#E5E0D6"
  card: "#F0EBE2"
  bone: "#D3CFC6"
  ink: "#303946"
  graphite: "#626975"
typography:
  display:
    fontFamily: Galmuri14
    fontSize: 3.5rem
    fontWeight: 400
    lineHeight: 1.15
  heading:
    fontFamily: Pretendard
    fontSize: 1.0625rem
    fontWeight: 500
    lineHeight: 1.4
  dialogue:
    fontFamily: Pretendard
    fontSize: 1.0625rem
    fontWeight: 400
    lineHeight: 1.75
  speaker:
    fontFamily: Pretendard
    fontSize: 0.875rem
    fontWeight: 500
    letterSpacing: 0.02em
  ui:
    fontFamily: Pretendard
    fontSize: 0.875rem
    fontWeight: 500
    letterSpacing: 0.01em
  caption:
    fontFamily: Pretendard
    fontSize: 0.8125rem
    fontWeight: 400
    lineHeight: 1.5
  monologue:
    fontFamily: Galmuri14
    fontSize: 1.375rem
    fontWeight: 400
    lineHeight: 1.5
  pixel:
    fontFamily: Galmuri14
    fontSize: 0.75rem
    fontWeight: 400
rounded:
  xs: 4px
  sm: 6px
  md: 8px
  lg: 10px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  2xl: 32px
  3xl: 48px
components:
  panel-dark:
    backgroundColor: "{colors.night}"
    textColor: "{colors.ivory}"
    typography: "{typography.ui}"
    rounded: "{rounded.md}"
    padding: "{spacing.xl}"
  dialogue-box:
    backgroundColor: "{colors.night}"
    textColor: "{colors.ivory}"
    typography: "{typography.dialogue}"
    rounded: "{rounded.xs}"
    padding: "{spacing.xl}"
  minigame-frame:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ivory}"
    typography: "{typography.caption}"
    rounded: "{rounded.md}"
    padding: "{spacing.xl}"
  speaker-label:
    textColor: "{colors.memory}"
    typography: "{typography.speaker}"
  monologue:
    textColor: "{colors.ivory}"
    typography: "{typography.monologue}"
  button-primary:
    backgroundColor: "{colors.memory}"
    textColor: "{colors.night}"
    typography: "{typography.ui}"
    rounded: "{rounded.sm}"
    padding: "{spacing.sm}"
  button-quiet:
    textColor: "{colors.fog}"
    typography: "{typography.ui}"
    rounded: "{rounded.sm}"
    padding: "{spacing.sm}"
  button-destructive:
    backgroundColor: "{colors.ember}"
    textColor: "{colors.ivory}"
    typography: "{typography.ui}"
    rounded: "{rounded.sm}"
    padding: "{spacing.sm}"
  progress-count:
    textColor: "{colors.memory}"
    typography: "{typography.ui}"
  panel-paper:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.caption}"
    rounded: "{rounded.lg}"
    padding: "{spacing.xl}"
  paper-card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "{spacing.md}"
  paper-muted:
    textColor: "{colors.graphite}"
    typography: "{typography.caption}"
---

## Overview

Room of Memory는 3D 공간을 돌아다니며 기억의 조각을 마주하는 짧은 비주얼 노벨이다. 좀비 사태로 무너진 세계, 자기 방에 오래 고립된 야구부 고등학생 '도현'의 방이 무대다. 화면의 대부분은 3D 씬이 차지하고, UI는 어두운 방 위에 얹힌 얇은 유리처럼 물러서 있다. 항상 씬이 주인공이다.

방향은 **'어두운 공간에서 따뜻한 빛이 돋보이는, 절제된 인디 서사 탐색'**이다. 방은 '모든 물건이 어두운 방'이 아니라 '고유색을 가진 물건들이 낮은 조도 속에 있는 방'이다. 벽은 깊은 네이비, 바닥은 그보다 밝은 슬레이트, 가구는 차분한 우드, 침구는 회청색이고, 앰버·테라코타·세이지가 작은 소품에만 드문드문 있다. 가구 자체를 주황으로 칠하지 않는다. 따뜻한 빛이 닿을 때만 꿀빛으로 보여야 한다.

UI는 두 재질뿐이다. **어두운 패널**(night의 반투명 표면 + ivory 글자 + 1px line 경계)이 메뉴·설정·모달을 맡고, **종이 패널**(paper/card + ink)은 수첩 하나에만 남긴다. 밝은 크림 캡슐이 장면 위로 떠다니지 않게 한다.

같은 팔레트라도 **화면의 역할에 따라 모양이 갈린다**. 전부 같은 네이비 사각 패널이면 웹 모달로 읽힌다.

| 영역 | 톤 | 모양 |
|---|---|---|
| 시작 화면 | 고요한 타이틀 | 방을 흐리지 않고 제목 뒤 가운데만 옅게 누른다. 기본 선택(첫 항목)만 아이보리 + 앰버 ▶, 나머지는 한 단계 낮은 밝기. 언어는 상자 없이 글자와 밑줄 |
| 혼잣말 | 공간 위의 글자 | 배경 없음, 그림자만 |
| 대사창 | 공간에 깔리는 자막 | 사방 테두리·긴 가로선 없음. 위쪽만 앰버 16% 선, 라운드 4px, 위가 조금 비치고 아래로 짙어지는 그라데이션(`.dialogue-panel`). 화자명은 작은 앰버, 초상은 패널 뒤에서 스며 올라온다 |
| 미니게임 | 경계가 또렷한 도구의 틀 | 게임 화면보다 한 톤 밝은 청회색(panel) 프레임, 라운드 8px. 설명 영역은 얇게(18px 24px), 게임 화면(라운드 4px)이 주인공. 키 이름은 키캡으로 분리, 닫기는 프레임 우측 상단 |

금지: **점선(dashed) 테두리**, **패널 기울이기(rotate/skew)**, **2px 이상 테두리**, **큰 pill 버튼과 과한 라운드**, **컨테이너 opacity로 글자까지 흐리게 하기**.

무드: 차가운 어둠 속에 평범한 생활의 색이 남아 있고, 라디오 이후 창에서 드는 국소적인 따뜻한 빛이 감정으로 느껴지는 방. 공포가 아니라 쓸쓸함과 그리움.

## Colors

### 어두운 표면 위 (UI 기본)

- **panel**: 미니게임 프레임의 불투명 청회색. 게임 화면보다 조금 밝아 틀과 화면이 한 덩어리로 안 보인다.
- **night**: 화면 바탕이자 모든 어두운 표면의 재료. 표면은 이 색을 얼마나 남기느냐로만 갈린다 (`globals.css`의 `--color-surface` 84% / `--color-surface-strong` 92% / `--color-surface-subtle` 40%). 경계선은 `--color-line`(#D3DEEC 14%) 하나다.
- **ivory**: 어두운 표면 위 주요 텍스트. 혼잣말·대사 본문·제목.
- **fog**: 보조 텍스트 (화자명, 안내, 라벨). **ash**: 비필수 정보 (자간 라벨, 잠금 안내).
- **primary / memory**: 앰버. 이 게임의 시그니처 컬러이자 **선택·포커스·진행·핵심 행동**에만 쓰는 색이다. 모든 테두리나 문장에 두르지 않는다. 3D에서는 기억 오브젝트의 글로우와 창으로 드는 빛의 색이기도 하다 (`resolveRoomPalette`가 같은 토큰을 읽는다).
  - **인터랙션 글로우는 두 등급으로 가른다.** 색상(hue)은 둘 다 앰버되 양을 다르게 준다.
    - **기억 등급** (기억 오브젝트, 엔딩 배트): 또렷한 윤곽선 + 숨쉬는 헤일로. 근접·hover·focus 대상만 더 명확하게 켜진다.
    - **곁가지 등급** (서랍·의자·커튼·전등 스위치): 윤곽선 한 줄만. 펄스 없음, 벽 투과 없음.
- **ember**: 경고색. **되돌릴 수 없는 동작**(리셋·새 게임 확인)과 실패 상태에만. UI 구조(테두리·구분선·카운트)에는 쓰지 않는다. 어두운 표면 위 글자로 AA(4.5:1)가 나오는 값으로 잡았다. 종이 위 본문 글자로는 쓰지 않는다 (큰 글리프만 허용).

### 종이 위 (수첩 전용)

- **paper / card**: 수첩 페이지(paper)와 그 위에 붙은 기록 카드(card). 누런 기운을 걷어낸 리넨 톤이다.
- **bone**: 종이 위 옅은 경계·비활성 칸. 어두운 표면에는 쓰지 않는다.
- **ink / graphite**: 종이 위 주요 텍스트(ink)와 보조 텍스트(graphite). 잠긴 기록은 본문 대신 낮은 대비의 자리표시(bone 막대)로 두고, 미수집 본문을 화면·접근성 트리 어디에도 싣지 않는다.

### 3D 재질 팔레트

씬의 재질색. UI 토큰이 아니라 씬 아트워크 값이며, `globals.css`의 `--color-scene-*`로만 노출하고 `src/scenes/memory-room/palette.ts`가 읽는다. **CSS 색과 3D 재질색을 한 토큰으로 공유하지 않는다**. 재질은 조명과 톤매핑을 거쳐 화면에 닿는다. 텍스처가 있는 glb(캐릭터, 가구킷)에는 이 색을 곱하지 않는다.

| 토큰 | 값 | 용도 |
|---|---|---|
| scene-wall | #34465E | 벽 (깊고 저채도인 네이비) |
| scene-floor | #626C7D | 바닥 (벽보다 밝은 슬레이트) |
| scene-wood | #998572 | 책상·의자·선반·침대 프레임 |
| scene-frame | #354052 | 가구 다리·문짝·기기 몸통 (어두운 구조) |
| scene-fabric | #6C809E | 침구·커튼·쿠션 (회청) |
| scene-linen | #BAB4A7 | 러그 위 방석·베개·종이·사진 |
| scene-trim | #A4A6A1 | 걸레받이·창틀·손잡이·기기 판 |
| scene-accent-amber | #BC9363 | 트로피, 문 손잡이 |
| scene-accent-clay | #A57565 | 달력 띠·안테나·실밥·운동화 |
| scene-accent-sage | #809289 | 포스터 색면·수납상자·가방 |
| scene-accent-leaf | #6AA36B | 앰플 튜브의 캡. 팔레트에서 유일하게 채도가 선 초록: 낯선 물건 하나가 방의 색에 섞이지 않는다 |

광원색은 재질이 아니라 따로 둔다: **scene-daylight** #C4D0DE (차가운 간접광), **scene-sun** #F3C98E (창으로 드는 볕).

### 씬 라이팅 램프 (CSS)

캔버스 아래 배경 그라디언트와 미니게임 필드가 쓰는 어둠 톤. 3D 재질과 무관하다.

| 토큰 | 값 | 용도 |
|---|---|---|
| scene-slate | #1C2A38 | 배경 그라디언트 중단 |
| scene-mist | #16212C | (예비 어둠 톤) |
| scene-deep | #0F181E | 배경 하단, 조이스틱 바탕 |
| scene-storm | #2A3D48 | 미니게임 필드 |
| scene-abyss | #121C24 | 미니게임 필드 (어두운 쪽) |
| scene-olive | #4A4436 | 액자 미니게임 틀 |
| scene-dusk | #2E3540 | 기기 화면 속 말풍선·모니터 몸통 |
| scene-coal | #17202A | 기기 화면 하단바 |
| scene-navy | #161F28 | 기기 화면 본문 |
| scene-void | #060A10 | 비네트, 모달 백드롭, 기기 화면 유리 |
| scene-khaki | #82765F | 야구 미니게임 하늘 띠: 원화의 겨자색을 color 블렌드로 눌러 앉힌다 |

### 기기 화면

**켜진 액정**에만 쓰는 중립 회백색. `globals.css`의 `--color-screen-*`로만 노출한다.

| 토큰 | 값 | 용도 |
|---|---|---|
| screen-glass | #F4F5F7 | 화면 본문 바탕 |
| screen-chrome | #E2E5EA | 제목줄·하단바·빈 판 |
| screen-shade | #C9CED6 | 화면 가장자리 그늘, 로그인 배경 하단 |

## Typography

본문 서체는 Pretendard(셀프호스팅 가변폰트), 포인트는 Galmuri14(셀프호스팅 픽셀 폰트, OFL) 두 개로 통일한다. 새 폰트는 받지 않는다.

- **display**: 메인 타이틀. 픽셀 폰트 48~64px.
- **heading**: 인게임 제목(HUD의 '기억의 방', 패널 제목). 16~26px / 500. HUD는 화면 폭 따라 연속으로 커진다(`--text-hud`, 940px 이하 16 → 1440px 20 → 1920px 24 → 26 상한). 메뉴 드롭다운·수첩 손잡이는 같은 배율(`--hud-zoom`)로 통째로 커진다. 패널 제목은 17px 고정.
- **monologue**: 화면 상단 혼잣말. 픽셀 폰트, 화면 폭 따라 20~30px 연속(`--text-monologue`, 1440px 25 · 1920px 29), 행간 1.5. 픽셀 폰트는 제목과 짧은 독백에만 쓴다.
- **dialogue**: 조사 대사 본문. 화면 폭 따라 16~24px 연속(`--text-dialogue`, 1440px 20 · 1920px 23) / 1.75. 행간을 줄이지 않는다. 창의 여백·화자명은 em이라 같이 자란다.
- **speaker**: 화자 이름. 대사창 안 작은 앰버(13px) 라벨.
- **ui**: 메뉴·버튼. 14px / 500. 긴 한국어 본문에 과한 자간을 주지 않는다 (라벨성 텍스트만 0.1em 이하).
- **caption**: 보조 안내. 12~13px / 1.5. 장면 위 HUD 캡션(지금 할 일)은 폭 따라 12~17px 연속(`--text-hud-caption`).
- **pixel**: 기억 항목의 한 줄 요약, 메모. 시스템 메시지에는 쓰지 않는다.

## Texture

- **필름 그레인**: 3D 방 위에서는 캔버스 안의 후처리 노이즈 1패스(overlay, opacity 0.09). 프레임마다 다시 뿌려져야 필름의 결로 읽힌다: 정지된 노이즈는 때 탄 유리다. 캔버스가 없는 화면(부팅 커튼·컷씬·미니게임 오버레이)과 `prefers-reduced-motion`에서는 SVG feTurbulence 정지 타일을 `mix-blend-mode: overlay`, opacity 0.13으로 1장. UI 패널 위에는 얹지 않는다.
- **색수차**: 화면 가장자리에만(radial, 가운데 30%는 깨끗하게), 밝은 방에서 1px 미만. 어둠의 양(비네트와 같은 축)을 따라 최대 2.5배까지 어긋나고, 라디오가 깨어나거나 기억을 줍는 순간 잠깐 튀었다가 1초 안에 잦아든다. 상시 펄스는 두지 않는다.
- **헤어라인**: 어두운 표면에서는 `line`, 종이에서는 `ink/10`의 1px 실선만. 점선은 쓰지 않는다.
- **비네트**: scene-void 라디얼. 밝기에 따라 0.62 → 0.24. 화면 위 검정 오버레이만 진하게 만드는 방식으로 어둠을 만들지 않는다. 어둠은 씬 조명이 만든다.
- **수첩 모눈·테이프**: ink 5%의 격자와 bone 테이프. 내용보다 튀지 않는 대비로만.

## Lighting

방의 밝기는 진행도 하나가 정한다 (별도 상태 머신 없음). `roomLightMix`(visual-state)가 진행도를 **차가운 간접광**과 **따뜻한 창빛** 두 축으로 가른다.

1. **시작**: 커튼을 닫은 낮의 평범한 방. 차가운 간접광이 약하게 남아 캐릭터·이동 공간·조사 대상이 구별된다.
2. **조사 진행**: 간접광과 채움광이 줄고 그림자가 깊어진다. 윤곽은 남긴다.
3. **가장 어두운 지점**: 어둠과 고립감이 가장 강하다. 캐릭터가 배경에 묻히거나 조사 대상을 못 찾는 상태는 피한다.
4. **라디오 이후**: 방 전체 ambient를 올리지 않는다. 창 방향에서 드는 따뜻한 directional 광원이 뒷벽의 창 개구부를 통해 책상 일부·바닥 일부에 닿는다. 구석은 차갑고 어둡게 남는다.
5. **엔딩 직전**: 회복 진행에 맞춰 따뜻한 빛의 강도와 창가 point light의 범위가 늘어난다. 방 전체가 주황이 되거나 그림자가 사라지지 않게 한다.

## Motion

- hover/focus 120~180ms, 패널 전환 180~240ms, 독백 전환 250~350ms. 조명 전환은 damp(1.5~3초).
- 튀는 bounce·버튼 확대·반복적인 glow는 쓰지 않는다. hover에서 테두리를 새로 그려 레이아웃이 움직이지 않게 한다 (테두리는 늘 있고 색만 바뀐다).
- `prefers-reduced-motion`이면 패널 등장은 translate 없이 밝기만, 반복 애니메이션은 멈춘다.
- 텍스트는 타자기식 출력(글자 단위 reveal)을 기본으로 하고, 클릭 시 즉시 완성한다.
- 카메라 전환은 컷이 아니라 damp/lerp 이동을 기본으로 한다.
- 목록은 한 항목씩 놓인다(55ms 간격, 항목 360ms). 동시에 뜨는 목록은 "판이 바뀜"으로, 한 항목씩 놓이는 목록은 "누가 놓고 있음"으로 읽힌다. reduced-motion에서는 간격 없이 밝기만.
- 마우스 위의 반응은 자리를 옮기는 몸짓으로 말한다: 표식 ▶이 왼쪽에서 4px 미끄러져 들어오고, 헤어라인이 왼쪽에서 자란다. 크기는 바꾸지 않는다. 커서가 얹히는 순간 3D 오브젝트와 같은 hover 샘플이 운다 (터치 제외).
- 마우스 기기에서는 네이티브 커서 대신 점(ivory, difference 블렌드)과 늦게 따라오는 링. DOM 버튼 위에서는 링이 버튼을 4px 여백으로 감싸는 알약으로 늘어나 붙고(memory 색), 만질 수 있는 3D 오브젝트 위에서는 물건 가운데로 빨려들며 사라지고 그 순간 윤곽선이 한 번 밝아진다(0.6초 안에 제 밝기). reduced-motion·터치에서는 네이티브 커서.
- 타이틀에서 방 모형은 마우스를 따라 아주 조금 기운다(방위각 ±0.03rad, damp). 시작하면 0으로 수렴한다.
- 사건(기억 수집·라디오 각성)에는 화면 전체가 한 번 반응한다: 색수차 스파이크, 그레인 2배, 카메라 배율 1.2% 눌림. 전부 1초 안에 잦아들고 반복하지 않는다.
- 커튼은 놓는 순간의 속도를 본다. 반쯤에서 놓아도 튕겼으면 끝까지 가고, 되돌리는 손짓이면 닫힌다. 천은 damp로 따라가 관성으로 읽힌다.

## Accessibility

- 텍스트 대비는 WCAG AA 이상 (ivory on night 15:1, fog on night 10:1, ink on paper 9:1, ivory on ember 4.6:1).
- 모든 인터랙션은 키보드로도 가능해야 한다 (Tab으로 핫스팟 이동, Space/Enter = 진행, 숫자 = 선택지). hover만으로 기능을 제공하지 않는다.
- 상태는 색만으로 구분하지 않는다 (선택 표식 ▶, aria-pressed, 라벨 텍스트 병기).
- 포커스 표시는 memory 2px 아웃라인(offset 2px)으로 통일한다.
