---
name: Room of Memory
version: 0.4.0
colors:
  primary: "#D5AE78"
  memory: "#D5AE78"
  ember: "#B8655A"
  night: "#0B1320"
  panel: "#172330"
  ivory: "#E9E3D7"
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
| 시작 화면 | 고요한 타이틀 | 가운데 기둥이 아니라 **왼쪽 기둥 + 아래 띠**로 화면 네 변을 쓴다: 제목·소개·메뉴는 화면 왼쪽에 왼쪽 정렬로 서고, 조작 안내와 언어는 화면 아래 가장자리 띠(위쪽 1px 선)에 좌우로 나뉜다. 방은 오른쪽에 온전히 보인다. 제목 위에는 **기록 라벨**(`MEMORY LOG 01 · ● NO SIGNAL`, 픽셀 12px, 아래 "기록 라벨" 참고)이 한 줄 선다. 어둠은 왼쪽에서 오른쪽으로, 아래에서 위로 옅어지는 선형 그라디언트 두 겹으로만 누른다(방을 흐리지 않는다). 방 모형 뒤에는 캔버스 아래 빛 웅덩이(`.room-stage-pool`, memory 15% → storm)가 깔려 모형이 어둠에 덜렁 놓이지 않고 무대 위에 선다. 시작하면 1초에 걸쳐 물러난다. 글자는 크기가 아니라 **서체와 색**으로 갈린다: 구역·조작 라벨은 본문 서체 ash, 조작 값은 픽셀 서체 ivory로 같은 14px에 세운다(픽셀 서체는 같은 px에서 더 크게 보이므로 라벨을 더 줄이지 않는다). 메뉴는 게임으로 들어가는 항목(픽셀 20px)과 게임 바깥 항목(본문 14px fog)을 선 하나로 가른다. 기본 선택(첫 항목)만 **앰버 글자 + 앰버 ▶ + 앰버 밑줄**로 화면에서 유일하게 데워져 있고(어디를 누르면 시작인지 한눈에), 나머지는 한 단계 낮은 밝기의 아이보리. 금빛 밑줄은 메뉴 칸이 아니라 글자 폭만큼. 화면 네 귀는 1px 모서리 선(좁은 화면에서는 생략). 언어는 상자 없이 글자와 밑줄. 세로로 긴 화면에서는 방 모형을 가로로 잘라서라도 키운다(다 담으면 손톱만 해진다) |
| 인게임 HUD | 방을 둘러싸는 틀 | 넓은 화면(md+)에서는 네 귀를 다 쓴다: 왼쪽 위 제목·진행, 오른쪽 위 메뉴, **아래 띠**(위쪽 1px line)의 왼쪽에 지금 할 일, 오른쪽에 기록 라벨. 타이틀의 아래 띠와 같은 문법이라 시작을 눌러도 틀이 이어진다. 폰에서는 띠를 둘 자리가 없어(조이스틱·둘러보기 버튼) 할 일이 헤더에 남고 기록 라벨은 생략한다. 대사창·컷씬·미니게임이 떠 있는 동안 띠는 물러난다 |
| 기록 라벨 | 글자로 만든 프레임 | `MEMORY LOG 01 · DAY 31 · ● NO SIGNAL`. 픽셀 서체, 자간 0.12em, 언어를 가리지 않는 그래픽 글자라 번역하지 않고 보조기술에는 숨긴다(정보는 진행 줄과 안내가 나른다). **이야기를 따라 자란다**: 로그 번호는 막 번호(1막 `01`, 방문이 열리면 `02`, 3막 `03`)이고 3막의 번호는 ember로 서며 붉은 그림자가 1px 어긋난다(`.hud-log-tainted`, 깜빡이지 않는다). `DAY 31`(fog)은 달력을 조사한 뒤에만 붙는다: 날짜는 게임 안에서 알아내는 단서라 처음부터 적지 않는다. 신호는 라디오가 잡음뿐인 동안 `● NO SIGNAL` ash, 목소리를 잡으면 `● SIGNAL FOUND` 앰버. 좀비를 UI에 대놓고 박지 않고, 예쁘고 조용한 화면에 무언가가 스며드는 것으로 말한다 |
| 혼잣말 | 공간 위의 글자 | 배경 없음, 그림자만 |
| 대사창 | 공간에 깔리는 자막 | 사방 테두리·긴 가로선 없음. 위쪽만 앰버 16% 선, 라운드 4px, 위가 조금 비치고 아래로 짙어지는 그라데이션(`.dialogue-panel`). 화자명은 작은 앰버, 초상은 패널 뒤에서 스며 올라온다 |
| 미니게임 | 경계가 또렷한 도구의 틀 | 게임 화면보다 한 톤 밝은 청회색(panel) 프레임, 라운드 8px. 설명 영역은 얇게(18px 24px), 게임 화면(라운드 4px)이 주인공. 키 이름은 키캡으로 분리, 닫기는 프레임 우측 상단 |

금지: **점선(dashed) 테두리**, **패널 기울이기(rotate/skew)**, **2px 이상 테두리**, **큰 pill 버튼과 과한 라운드**, **컨테이너 opacity로 글자까지 흐리게 하기**.

무드: 차가운 어둠 속에 평범한 생활의 색이 남아 있고, 라디오 이후 창에서 드는 국소적인 따뜻한 빛이 감정으로 느껴지는 방. 공포가 아니라 쓸쓸함과 그리움.

## Colors

### 어두운 표면 위 (UI 기본)

- **panel**: 미니게임 프레임의 불투명 청회색. 게임 화면보다 조금 밝아 틀과 화면이 한 덩어리로 안 보인다.
- **night**: 화면 바탕이자 모든 어두운 표면의 재료. 표면은 이 색을 얼마나 남기느냐로만 갈린다 (`globals.css`의 `--color-surface` 84% / `--color-surface-strong` 92% / `--color-surface-subtle` 40%). 경계선은 `--color-line`(#D3DEEC 14%) 하나다.
- **ivory**: 어두운 표면 위 주요 텍스트. 혼잣말·대사 본문·제목. 순백이 아니라 누런 기가 도는 아이보리다: 어두운 방 위의 "흰 글씨"는 웹페이지로 읽히고, 종이색 글씨는 기록으로 읽힌다.
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

- **display**: 메인 타이틀. 픽셀 폰트 42 / 56 / 70px (화면 폭 768px · 1280px에서 한 칸씩). **14의 정수배만 쓴다**: Galmuri14는 14px 그리드에 그려진 서체라 그 배수가 아니면 획 굵기가 칸마다 들쭉날쭉해지고, 큰 글자인데도 가늘고 흐릿하게 읽힌다. 굵기는 `font-weight`로 못 준다(굵은 웨이트가 없다). 글자를 원본 한 칸(`font-size / 14`)만큼 오른쪽·아래로 더 찍어 획을 한 칸 불린다 (`globals.css`의 `.title-logo`).
- **heading**: 인게임 제목(HUD의 '기억의 방', 패널 제목). 16~26px / 500. HUD는 화면 폭 따라 연속으로 커진다(`--text-hud`, 940px 이하 16 → 1440px 20 → 1920px 24 → 26 상한). 메뉴 드롭다운·수첩 손잡이는 같은 배율(`--hud-zoom`)로 통째로 커진다. 패널 제목은 17px 고정.
- **monologue**: 화면 상단 혼잣말. 픽셀 폰트, 화면 폭 따라 20~30px 연속(`--text-monologue`, 1440px 25 · 1920px 29), 행간 1.5. 픽셀 폰트는 제목과 짧은 독백에만 쓴다.
- **dialogue**: 조사 대사 본문. 화면 폭 따라 16~24px 연속(`--text-dialogue`, 1440px 20 · 1920px 23) / 1.75. 행간을 줄이지 않는다. 창의 여백·화자명은 em이라 같이 자란다.
- **speaker**: 화자 이름. 대사창 안 작은 앰버(13px) 라벨.
- **ui**: 메뉴·버튼. 14px / 500. 긴 한국어 본문에 과한 자간을 주지 않는다 (라벨성 텍스트만 0.1em 이하).
- **caption**: 보조 안내. 12~13px / 1.5. 장면 위 HUD 캡션(지금 할 일)은 폭 따라 12~17px 연속(`--text-hud-caption`).
- **pixel**: 기억 항목의 한 줄 요약, 메모. 시스템 메시지에는 쓰지 않는다.

## Texture

- **필름 그레인**: 3D 방 위에서는 캔버스 안의 후처리 노이즈 1패스(overlay, opacity 0.09). 프레임마다 다시 뿌려져야 필름의 결로 읽힌다: 정지된 노이즈는 때 탄 유리다. 캔버스가 없는 화면(부팅 커튼·컷씬·미니게임 오버레이)과 `prefers-reduced-motion`에서는 SVG feTurbulence 정지 타일을 `mix-blend-mode: overlay`, opacity 0.13으로 1장. UI 패널 위에는 얹지 않는다.
- **필름 먼지·스크래치**: 2D 재생 화면(컷씬·다시보기)에만. 3D 방의 그레인이 "필름의 결"이라면 이쪽은 "기록물의 결"이라, 화면이 방에서 그림으로 넘어갈 때 재질도 같이 바뀐다. 먼지는 ivory/scene-void 점 몇 개가 steps로 자리를 옮기고(흘리지 않는다), 세로 스크래치 1px은 7초에 두어 번 잠깐 섰다 사라진다. 방·UI 패널·미니게임에는 얹지 않는다. `prefers-reduced-motion`에서는 끈다.
- **색수차**: 화면 가장자리에만(radial, 가운데 30%는 깨끗하게), 밝은 방에서 1px 미만. 어둠의 양(비네트와 같은 축)을 따라 최대 2.5배까지 어긋나고, 라디오가 깨어나거나 기억을 줍는 순간 잠깐 튀었다가 1초 안에 잦아든다. 상시 펄스는 두지 않는다.
- **헤어라인**: 어두운 표면에서는 `line`, 종이에서는 `ink/10`의 1px 실선만. 점선은 쓰지 않는다.
- **비네트**: scene-void 라디얼. 밝기에 따라 0.62 → 0.24. 화면 위 검정 오버레이만 진하게 만드는 방식으로 어둠을 만들지 않는다. 어둠은 씬 조명이 만든다.
- **수첩 모눈·테이프**: ink 5%의 격자와 bone 테이프. 내용보다 튀지 않는 대비로만.
- **시간의 재질** (`docs/visual-experiments.md` 5·11장): 창 유리의 실금은 창밖 붕괴도를 따라 늘고 되돌아가지 않는다. 화장실 타일과 샤워 벽, 방의 컵라면 용기에는 반응확산으로 구운 물때가 곱해진다(낮은 대비, 공포가 아니라 쓸쓸함). 책상 모니터의 꺼진 유리에는 방이 도트 격자로 비치고 어두울수록 도트가 굵다. 화장실 거울은 세로줄마다 시간이 어긋난 반사이고 2막이 진행될수록 맞아 든다. 악보의 번진 마디는 조각을 들고 들어서면 거꾸로 모여 음표가 된다.

## Lighting

방의 밝기는 진행도 하나가 정한다 (별도 상태 머신 없음). `roomLightMix`(visual-state)가 진행도를 **차가운 간접광**과 **따뜻한 창빛** 두 축으로 가른다.

1. **시작**: 커튼을 닫은 낮의 평범한 방. 차가운 간접광이 약하게 남아 캐릭터·이동 공간·조사 대상이 구별된다.
2. **조사 진행**: 간접광과 채움광이 줄고 그림자가 깊어진다. 윤곽은 남긴다.
3. **가장 어두운 지점**: 어둠과 고립감이 가장 강하다. 캐릭터가 배경에 묻히거나 조사 대상을 못 찾는 상태는 피한다.
4. **라디오 이후**: 방 전체 ambient를 올리지 않는다. 창 방향에서 드는 따뜻한 directional 광원이 뒷벽의 창 개구부를 통해 책상 일부·바닥 일부에 닿는다. 구석은 차갑고 어둡게 남는다.
5. **엔딩 직전**: 회복 진행에 맞춰 따뜻한 빛의 강도와 창가 point light의 범위가 늘어난다. 방 전체가 주황이 되거나 그림자가 사라지지 않게 한다.

## Motion

- hover/focus 120~180ms, 패널 전환 180~240ms, 독백 전환 250~350ms. 조명 전환은 damp(1.5~3초).
- 튀는 bounce·버튼 확대·반복적인 glow는 쓰지 않는다. 예외는 둘: 수첩을 처음 부르는 온보딩의 숨쉬는 손잡이(`hotspot-glow`, 한 번 열면 끝), 안 읽은 수첩 기록이 있는 동안 손잡이 모서리 금빛 점에서 번지는 고리(`notice-ripple`, 펼치면 끝). hover에서 테두리를 새로 그려 레이아웃이 움직이지 않게 한다 (테두리는 늘 있고 색만 바뀐다).
- `prefers-reduced-motion`이면 패널 등장은 translate 없이 밝기만, 반복 애니메이션은 멈춘다.
- 텍스트는 타자기식 출력(글자 단위 reveal)을 기본으로 하고, 클릭 시 즉시 완성한다.
- 카메라 전환은 컷이 아니라 damp/lerp 이동을 기본으로 한다.
- 목록은 한 항목씩 놓인다(55ms 간격, 항목 360ms). 동시에 뜨는 목록은 "판이 바뀜"으로, 한 항목씩 놓이는 목록은 "누가 놓고 있음"으로 읽힌다. reduced-motion에서는 간격 없이 밝기만.
- 마우스 위의 반응은 자리를 옮기는 몸짓으로 말한다: 표식 ▶이 왼쪽에서 4px 미끄러져 들어오고, 헤어라인이 왼쪽에서 자란다. 크기는 바꾸지 않는다. 커서가 얹히는 순간 3D 오브젝트와 같은 hover 샘플이 운다 (터치 제외).
- 마우스 기기에서는 네이티브 커서 대신 점(ivory, difference 블렌드)과 늦게 따라오는 링. DOM 버튼 위에서는 링이 손 자리에서 0.7배로 조여들며 memory 색이 되고(버튼을 감싸지는 않는다), 만질 수 있는 3D 오브젝트 위에서는 물건 가운데로 빨려들며 사라지고 그 순간 윤곽선이 한 번 밝아진다(0.6초 안에 제 밝기). reduced-motion·터치에서는 네이티브 커서.
- 타이틀에서 방 모형은 마우스를 따라 아주 조금 기운다(방위각 ±0.03rad, damp). 시작하면 0으로 수렴한다.
- 사건(기억 수집·라디오 각성)에는 화면 전체가 한 번 반응한다: 색수차 스파이크, 그레인 2배, 카메라 배율 1.2% 눌림. 전부 1초 안에 잦아들고 반복하지 않는다.
- 누르는 순간 커서 자리에서 memory 색 파문이 한 번 번진다(420ms). 소리를 켜는 순간에도 버튼에서 링이 한 번 번진다. 끌 때는 아무것도 번지지 않는다.
- 진행 칸은 새로 찬 칸만 왼쪽에서 차오르고(500ms), 모은 개수 숫자는 아래에서 밀려 올라온다(300ms). 이미 찬 칸은 다시 움직이지 않는다.
- 타이틀에서 시작을 누르면 로딩 화면 대신 메뉴가 올라온 순서대로 물러나고(220ms), 그 사이 카메라가 방으로 내려앉기 시작한다.
- 타이틀의 선은 나타나지 않고 **그어진다**: 글자가 놓이는 계단(55ms 간격)에 함께 올라타되, 모서리 선은 가로획→세로획 순으로 제 모서리에서 자라고(620ms), 아래 띠의 선은 왼쪽에서 오른쪽으로 그어진 뒤 그 위를 앰버 한 점이 **한 번만** 훑고 지나간다(1.5초). 반복하지 않는다. reduced-motion에서는 선이 그냥 있고 훑는 빛은 없다.
- 언어 토글(타이틀)의 밑줄은 하나뿐이고 고른 글자 밑으로 미끄러진다(220ms). 수첩 손잡이는 커서가 얹히면 3px 빠져나온다.
- 대사창 화자 라벨은 화자가 바뀔 때만 왼쪽에서 6px 미끄러져 들어온다(220ms). 같은 화자가 이어지면 움직이지 않는다.
- 미니게임 층은 백드롭이 먼저 깔리고(200ms) 카드가 올라오며, 닫힐 때는 층의 유령이 200ms 남았다 아래로 가라앉으며 사라진다. 진짜 DOM은 즉시 떼인다(ExitFade).
- 기억을 되찾는 순간 물건에서 금빛 티끌이 솟아 흩어졌다가 화면 오른쪽 위(수첩 쪽)로 쓸려 가며 사라진다(1.7초). 먼지와 같은 재질이다.
- 창빛은 판 한 장 위에 두 겹의 노이즈가 서로 다른 속도로 흐른다. 커튼이 젖혀진 몫만큼 가운데 틈에서 양옆으로 열린다. 먼지도 그 몫만큼만 보인다.
- 창빛 속 먼지는 커서 근처에서 화면 위로 밀려났다가 손이 지나가면 제자리로 돌아온다(NDC 반경 0.16, 폭 0.05).
- 앰비언트 오클루전(N8AO, 절반 해상도)은 가구가 바닥·벽에 붙은 자리와 구석을 void 색으로 살짝 누른다. 어둠을 만드는 층이 아니라 물건이 놓여 있다는 층이다.
- 컷씬이 열리는 순간 화면이 신호 끊기듯 가로로 찢기고 주사선·잡음이 지나간 뒤 어두워진다(0.15초 꼭대기, 0.5초 안에 잦아듦). 컷씬 층은 0.26초 뒤에 떠오른다. 엔딩이 시작되면 가장자리부터 따뜻하게 타들어가며 1.5초에 걸쳐 안쪽으로 번진다. reduced-motion에서는 찢김이 없다.
- 커튼은 놓는 순간의 속도를 본다. 반쯤에서 놓아도 튕겼으면 끝까지 가고, 되돌리는 손짓이면 닫힌다. 천은 damp로 따라가 관성으로 읽힌다.
- **시각 실험 레이어** (`docs/visual-experiments.md`). 기억은 매체마다 질감이 다르고, 흩어진 것이 모인다. 모든 효과는 방 밝기·막·진행도 중 하나에 묶이고 독립적으로 도는 장식은 없다. 켜고 끄는 등급은 `effect-budget` 한 곳이 정한다: 모션을 끈 사람에게는 전부 빠지고, 프레임이 떨어진 기기와 폰에서는 렌더 타깃이 드는 것(틸트 시프트·잔상·빛기둥·거울·모니터 반사·앰플 굴절)이 빠진다. 폴백은 언제나 지금 화면 그대로다.
  - 1막 후반 손 가까이만 비추는 등(진짜 점광원, 커서 또는 몸), 틸트 시프트 초점 띠(앉으면 눈높이로 내려온다), 어두울수록 천천히 다시 쌓이는 먼지, 2막부터 다시 가는 초침(초당 한 칸), 숨 쉬는 이불(0.25Hz).
  - 전환: 라디오 재점화와 화장실·안방 첫 진입에 방이 0.45초 선으로 풀렸다가 면으로 채워진다, 불을 켜는 덮개와 평면도 이동 위에 흐림이 걷히며 초점이 맞는다(`backdrop-filter: blur`), 1인칭으로 걷는 동안 잔상이 끌리고 빛에 닿으면 걷힌다, 엔딩에 현관문 밖 빛이 문틈으로 기둥을 세우고 필름의 결(색수차·그레인)이 처음으로 0이 된다, 컷씬 컷은 종이·필름·물 결로 dissolve한다.
  - 글자: 혼잣말이 물러날 때 1막은 말끝 글자부터 떨어지고 2막부터는 아래에서 모이며 사라진다. 안방 서류의 몇 단어는 깨진 채다(hover 복원 없음).

## Accessibility

- 텍스트 대비는 WCAG AA 이상 (ivory on night 14.6:1, fog on night 10:1, ink on paper 9:1). ivory on ember는 3.3:1이라 굵은 버튼 라벨(button-destructive)과 큰 글리프에만 쓴다.
- **번쩍임을 만들지 않는다.** 전면을 덮는 밝은 판은 두지 않는다: 1인칭 인트로에서 불을 켜는 덮개는 순백이 아니라 밤에 볕을 섞은 중간 밝기(`.viewpoint-lamp`)이고 1.3초에 걸쳐 걷힌다. `prefers-reduced-motion`에서는 어둠(void)으로 잇는다. 사건 반응(색수차·그레인 스파이크)은 한 번뿐이고 1초 안에 잦아들며, 초당 3회를 넘는 밝기 변화는 어디에도 없다. 노이즈는 낮은 세기의 그레인 한 겹까지만: TV 정지 화면식 정적(static)·RGB 노이즈·픽셀 블록 노이즈처럼 프레임마다 크게 바뀌는 질감은 쓰지 않는다.
- 모든 인터랙션은 키보드로도 가능해야 한다 (Tab으로 핫스팟 이동, Space/Enter = 진행. 선택지 UI를 만들면 숫자 = 선택지). hover만으로 기능을 제공하지 않는다.
- 상태는 색만으로 구분하지 않는다 (선택 표식 ▶, aria-pressed, 라벨 텍스트 병기).
- 포커스 표시는 memory 2px 아웃라인(offset 2px)으로 통일한다.
