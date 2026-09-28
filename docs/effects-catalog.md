# room-of-memory 연출·효과·인터랙션 카탈로그

이 프로젝트에 들어간 three.js 연출, CSS·DOM 효과, 인터랙션을 코드 기준으로 정리한 문서다. 포트폴리오나 회고에 옮겨 쓰기 쉽도록 각 항목에 **보이는 것**과 **구현 방법**을 함께 적었다.

- 경로는 `src/` 기준이다. 디렉터리를 생략한 3D 파일은 `src/scenes/memory-room/` 아래에 있다.
- 줄 번호는 자주 바뀌므로 적지 않았다. 파일명과 심볼 이름으로 찾으면 된다.
- 기준 커밋: `72edeef` (2026-09-28)

## 목차

1. [한눈에 보기](#1-한눈에-보기)
2. [공통 기반: 효과 예산, 규약, 디자인 토큰](#2-공통-기반)
3. [three.js: 포스트프로세싱 체인](#3-threejs-포스트프로세싱-체인)
4. [three.js: 조명과 무드 (밝기 V곡선)](#4-threejs-조명과-무드)
5. [three.js: 카메라](#5-threejs-카메라)
6. [three.js: 플레이어 이동과 애니메이션](#6-threejs-플레이어)
7. [three.js: 파티클과 빛 볼륨](#7-threejs-파티클과-빛-볼륨)
8. [three.js: 반사와 렌더 타깃](#8-threejs-반사와-렌더-타깃)
9. [three.js: 커스텀 셰이더와 재질 패치](#9-threejs-커스텀-셰이더와-재질-패치)
10. [three.js: 오브젝트 애니메이션과 3D 인터랙션](#10-threejs-오브젝트-애니메이션과-3d-인터랙션)
11. [three.js: 별도 Canvas (인스펙트, 캐릭터 뷰어, 다이얼)](#11-threejs-별도-canvas)
12. [CSS·DOM: 부팅, 로딩, 타이틀](#12-cssdom-부팅-로딩-타이틀)
13. [CSS·DOM: 인게임 HUD와 혼잣말](#13-cssdom-인게임-hud와-혼잣말)
14. [CSS·DOM: 대사 시스템](#14-cssdom-대사-시스템)
15. [CSS·DOM: 컷씬, 웹툰, 시점 전환](#15-cssdom-컷씬-웹툰-시점-전환)
16. [CSS·DOM: 단서, 수첩, 모달](#16-cssdom-단서-수첩-모달)
17. [CSS·DOM: 미니게임 호스트, 결과 연출, 엔딩](#17-cssdom-미니게임-호스트-결과-연출-엔딩)
18. [CSS·DOM: 커스텀 커서](#18-cssdom-커스텀-커서)
19. [미니게임 17종](#19-미니게임-17종)
20. [게임 흐름과 인터랙션 시스템](#20-게임-흐름과-인터랙션-시스템)
21. [오디오 연출](#21-오디오-연출)
22. [접근성과 reduced motion](#22-접근성과-reduced-motion)
23. [성능·안정성 트릭 모음](#23-성능안정성-트릭-모음)
24. [부록: 코드와 문서가 어긋난 곳](#24-부록-코드와-문서가-어긋난-곳)

---

## 1. 한눈에 보기

| 분야 | 대표 연출 |
|---|---|
| 후처리 | N8AO, 2단 아웃라인 글로우(기억/곁가지), 틸트 시프트 DOF, 색수차와 그레인, GodRays, 커스텀 전환 셰이더(tear/settle/burn), 1인칭 잔상 Pass |
| 조명 | 진행도에 따라 어두워졌다가 되살아나는 **밝기 V곡선**, 조명 6개 damp, 창을 통과한 볕과 그림자, 커서를 따라가는 등불 |
| 카메라 | 아이소메트릭 추적 리그, 타이틀 드리프트와 패럴랙스, 사건 킥과 흔들림, 1인칭 카메라 교체, 카메라 쪽 벽 걷어내기 |
| 캐릭터 | A* + string pulling 클릭 이동, 이동 거리로 스크럽하는 걷기, 앉기/눕기, 커튼 당기기 클립 스크럽, 눈 깜빡임 morph |
| 파티클 | 창빛 먼지(커서 회피), 기억 수집 버스트(수첩 쪽으로 빨려감), 방 둘레 티끌. 모두 정점 셰이더에서 시간 함수로 계산 |
| 반사 | 실시간 전신거울, **slit-scan 거울**(세로줄마다 시간 지연), 모니터 **도트 반사**, 앰플 굴절 |
| 셰이더 | 세면대 물 파문과 가짜 굴절, 이불 호흡(onBeforeCompile), 물때(Gray-Scott 반응확산), 번진 악보의 잉크가 모이는 연출 |
| DOM | 부팅 커튼, 픽셀 로고, 계단식 등장, 글자 단위 혼잣말 퇴장, 타자기 대사와 화자별 틱 음, 노이즈 디졸브, 사진 모프, 웹툰 뷰어, 커스텀 커서 |
| 미니게임 | 격투(AI와 프레임 데이터), 배팅, 액자 닦기(Canvas destination-out), 8퍼즐, 3D 턴테이블, 달력 넘기기(CSS 3D), 돋보기, 피아노 등 17종 |
| 오디오 | 효과음은 파일 없이 Web Audio로 합성. BGM은 방 밝기에 따라 필터·리버브가 움직이고, 루프 이음새를 크로스페이드로 굽는다 |

---

## 2. 공통 기반

### 2-1. 효과 예산 게이트 (`lib/effects/effect-budget.ts`)
- 등급은 `off`(reduced motion) / `low`(프레임 저하 또는 터치 기기) / `full` 세 가지다.
- `useEffectEnabled("cheap")`은 low부터, `"heavy"`는 full에서만 켜진다. 실험성 효과는 전부 이 한 곳을 거쳐 켜지고 꺼진다.
- drei `<PerformanceMonitor>`가 프레임 저하를 감지하면 DPR 상한을 1.5에서 1로 내리고, 같은 신호로 `degraded`를 올린다.
- 개발 모드에서는 localStorage `rom-effect-tier`로 등급을 강제할 수 있다.

### 2-2. r3f 코딩 규약 (거의 모든 3D 파일에 공통)
- `useFrame` 안에서는 ref, uniform, material 속성만 바꾸고 setState는 하지 않는다. 벡터는 모듈 스코프에서 재사용한다.
- 순수 곡선 함수는 별도 파일로 뺀다(`film-look.ts`, `water-ripple.ts`, `slit-scan.ts`, `dot-screen.ts`, `tilt-focus.ts`, `afterimage.ts`, `memory-motion.ts` 등). 브라우저 없이 테스트하기 위해서다.
- 프레임마다 바뀌는 값은 스토어가 아니라 **모듈 스코프 싱글턴**으로 넘긴다(`cursorTarget`, `endingLight`, `screenTransitionInput`).
- glb 로더는 모두 자기 `<Suspense>`를 안에 둔다. 서스펜드가 위로 새면 EffectComposer가 다시 붙다가 터지고, 1인칭 리그가 언마운트되기 때문이다.
- Canvas 설정: orthographic 아이소메트릭, `shadows="percentage"`(r185에서 PCFSoft가 deprecated), `alpha: true`. 창밖 번짐 같은 워시는 캔버스 아래 DOM(`.room-backdrop`)이 맡는다.

### 2-3. 디자인 토큰과 무드 (`DESIGN.md` → `app/globals.css @theme`)
- 핵심 3색
  - `night #0B1320`: 바탕이자 모든 어두운 표면의 재료. 표면은 `color-mix(in srgb, night N%, transparent)`로 night를 얼마나 남기느냐로만 구분한다.
  - `memory #D5AE78`: 앰버 시그니처 색. 선택·포커스·진행·핵심 행동에만 쓴다. 3D 글로우와 창빛도 같은 토큰을 읽는다.
  - `ember #B8655A`: 되돌릴 수 없는 동작과 실패, 3막의 "오염" 표현.
- 무드 문장: "공포가 아니라 쓸쓸함과 그리움. 차가운 어둠 속 국소적인 따뜻한 빛."
- 타이포: Pretendard(본문)와 Galmuri14 픽셀(포인트). 둘 다 `next/font/local`로 셀프호스팅한다.
  - 크기 토큰 `--text-hud/-monologue/-dialogue`는 브레이크포인트 없이 `clamp()` 하나로 자란다.
  - `--hud-zoom`은 rem 기반 패널을 CSS `zoom`으로 통째로 키운다.
- 공통 UI 클래스는 `components/ui/ui-classes.ts`에 있다(PANEL_*, BUTTON_*, CHIP_*, HUD_CHOICE_*, FOCUS_RING). 테두리는 늘 있고 hover 때 색만 바뀌므로 레이아웃이 흔들리지 않는다.
- 3D 재질 색도 CSS 토큰에서 읽는다(`resolveRoomPalette`). 캔버스 2D 효과도 `getComputedStyle`로 토큰 색을 읽는다.
- 유틸리티: `break-ko`(`keep-all` + `overflow-wrap:anywhere`), 종이용 잉크 스크롤바 `.scroll-paper`.

---

## 3. three.js: 포스트프로세싱 체인

`MemoryOutlineGlow.tsx`의 `MemoryGlowRoot`가 EffectComposer 하나에 모든 패스를 쌓는다(`multisampling:2`). 패스 순서가 곧 그림의 층이다.

> **N8AO → Afterimage → GodRays → TiltShift → ChromaticAberration → Outline(inner) → Outline(outer) → Noise → ScreenTransition**

이펙트 인스턴스는 `useMemo`로 직접 만들어 `<primitive>`로 꽂고 uniform만 바꾼다. 래퍼 컴포넌트가 prop 변화마다 인스턴스를 새로 만드는 것을 피하기 위해서다.

| 효과 | 파일 | 보이는 것 | 구현 |
|---|---|---|---|
| **앰비언트 오클루전** | MemoryOutlineGlow.tsx | 가구가 바닥·벽에 닿은 자리가 살짝 눌려 물건이 "놓여" 보인다 | `<N8AO halfRes quality="performance">`, 반경 0.6, intensity 1.8. AO 색은 검정이 아니라 팔레트의 `void` |
| **아웃라인 글로우 2등급** | MemoryOutlineGlow.tsx | 만질 수 있는 것에 금빛 윤곽이 생긴다. "기억" 등급은 숨 쉬는 헤일로가 가구 너머까지 비치고(xRay), "곁가지" 등급은 윤곽선 한 줄뿐이다 | `<Outline>` 두 개. inner는 edge 5, blur 없음. outer는 edge 8, VERY_LARGE 커널, `pulseSpeed 0.45`, xRay. **selectionLayer를 11/12로 강제로 나눴다**: 래퍼 기본값 10을 공유하면 곁가지가 xRay 패스로 새어 커튼 윤곽이 벽을 뚫고 나왔다. 가려진 부분의 윤곽은 HSL을 -0.12 내린 색. 대상 메쉬는 `useLayoutEffect` traverse로 등록하고, glb가 늦게 붙으면 `selectionVersion`으로 다시 훑는다 |
| **호버 순간 윤곽 펄스** | MemoryOutlineGlow.tsx, cursor-target.ts | 커서가 올라가는 순간 윤곽이 한 번 밝아졌다가 0.6초에 잦아든다. 상시 펄스는 없다 | `edgeStrength = base*(1+exp(-5t)*gain)` |
| **틸트 시프트 DOF** | tilt-focus.ts | 화면 가운데 띠만 또렷한 디오라마 느낌. 1막은 좁고 세게, 2·3막은 넓고 옅게. **앉으면 초점 띠가 눈높이로 내려오며 좁아진다** | `TiltShiftEffect`의 blur/taper/start/end를 `damp`(λ3)로 이동. start·end는 배열 uniform이라 `[1]` 성분만 바꾼다. heavy 전용 |
| **색수차** | FilmLook.tsx, film-look.ts | 방이 어두울수록 가장자리 색이 더 어긋나고, 기억을 줍는 순간 한 번 튄다. **엔딩에서는 0으로 수렴해 처음으로 화면이 깨끗해진다** | `radialModulation`으로 가운데는 보호. 기본값은 damp, 펄스는 `exp(-4Δ)` 감쇠, 엔딩 `clean` 축은 따로 damp |
| **필름 그레인** | FilmLook.tsx | 프레임마다 다시 뿌려지는 필름 결(overlay 0.09). 사건 때 두 배가 되고 엔딩에서 사라진다 | `NoiseEffect`. reduced motion이면 `BlendFunction.SKIP`으로 셰이더에서 빼고, DOM 정지 타일 `.film-grain`이 대신한다 |
| **사건 펄스 버스** | event-pulse.ts | 색수차, 그레인, 카메라 킥이 같은 사건에 함께 반응한다 | 스토어 `subscribe`로 수집 증가(0.6)와 라디오 신호 상승 엣지(1.0)를 듣는다 |
| **화면 전환 셰이더** | ScreenTransition.tsx | ① **tear**: 컷씬 시작 순간 가로 띠가 밀리고 주사선과 잡음이 지나간다. ② **settle**: 굵은 셀이 덮였다가 같은 자리부터 차오른다. ③ **burn**: 엔딩에서 가장자리부터 따뜻한 빛이 번진다 | 커스텀 `postprocessing.Effect`(`CONVOLUTION` 속성, inputBuffer를 다른 uv로 읽는다). tear는 `floor(uv.y*28+t*9)` 띠 해시로 x를 밀고 `sin(y*900)` 주사선을 더한다. settle은 96×54 셀 해시에 `step`을 걸어 시간과 무관하게 깜빡이지 않는다. burn은 iris smoothstep에 warm 색을 섞는다 |
| **1인칭 잔상** | AfterimagePass.ts, afterimage.ts | 1인칭으로 어둠 속을 걸을 때 빛이 끌린다. 멈추면 걷힌다 | Effect로는 되먹임이 안 되어 **커스텀 `Pass`**로 만들었다. HalfFloat RT 두 장을 ping-pong하며 `max(prev*uDamp, cur)`를 누적한다(밝은 쪽만 남음). 절반 해상도. `uDamp`는 이동 입력량을 따라 0.55~0.94 |
| **GodRays** | MemoryOutlineGlow.tsx, ending-light.ts, LivingRoomShell.tsx | 엔딩에 열린 현관 틈으로 빛기둥이 거실을 가로지른다. 게임에서 광원이 화면에 서는 유일한 자리다 | `GodRaysEffect`(samples 40, 절반 해상도). 광원은 문 뒤의 `toneMapped=false` 판이고 모듈 싱글턴으로 컴포저에 건넨다. heavy이면서 엔딩일 때만 생성한다 |

---

## 4. three.js: 조명과 무드

### 밝기 V곡선 (`visual-state.ts`)
- 진입할 때는 0.62(평범한 낮의 방)다. 1막에서 조사할수록 0까지 어두워지고, 2막 추리로 회복하면서 금빛 1.0까지 오른다.
- 밝기는 두 축으로 나뉜다.
  - **cool**(ambient, hemisphere, key, 천장등): 1막에 깎이고, 2막에는 0.16까지만 돌아온다.
  - **warm**(창빛, sun, 광선판, 먼지): 1막에는 0이고, 2막 회복도를 그대로 따른다.
- 같은 레벨 하나가 3D 조명, DOM 비네트, 색수차, BGM 필터·리버브를 동시에 움직인다.

| 효과 | 파일 | 보이는 것 | 구현 |
|---|---|---|---|
| **StageLighting** | MemoryRoomScene.tsx | 조명 전환이 1.5~3초에 걸쳐 스며든다 | 광원 6개를 모두 `MathUtils.damp`(λ2.2)로 목표값에 붙인다. 세기가 0.01 이하인 sun은 `visible=false`로 두어 그림자 패스를 끈다 |
| **창을 통과한 볕** | MemoryRoomScene.tsx | 2막에 창 모양 그대로의 빛이 책상과 바닥에 떨어진다 | sun을 창 밖 위에서 쏘고, 뒷벽이 그림자로 창 개구부 모양을 만든다. 커튼이 닫혀 있으면 0.6배, 창이 없는 공간이면 0 |
| **전등 스위치와 인트로 블랙아웃** | visual-state.ts `lampScaled` | 불을 끄면 실내광만 0.26배가 되고 창빛은 남는다. 인트로는 0.18배 | `dim = 1 - lampScaled(level)`가 비네트와 색수차 축으로 쓰인다 |
| **공간별 밝기 오프셋** | spaces.ts | 거실·화장실은 한 단계, 안방은 두 단계 어둡게 시작한다 | `cool - lightOffset` |
| **등불** | Lantern.tsx, lantern-light.ts | 1막 후반에 손 가까이만 비추는 따뜻한 점광원. 마우스는 커서가 가리키는 바닥, 터치는 몸을 따라간다 | 매 프레임 raycaster로 y=0 평면과 교차하고 damp(λ7)로 따라간다. 세기와 거리는 smoothstep. 꺼지면 `visible=false`(세기 0인 광원도 셰이더 비용이 든다) |
| **스위치 표시등** | LightSwitch.tsx | 인트로 어둠 속에서 표시등 점이 1.6초 주기로 숨 쉬고 벽 한 뼘을 물들인다. 로커는 딸깍 기운다 | emissive와 pointLight를 sin으로 움직인다. 인트로 동안은 글로우 등급을 `memory`로 올린다 |
| **책상 스탠드** | RoomFurniture.tsx | 누르면 전구가 데워지며 켜진다 | emissive와 pointLight를 damp(λ6) |
| **라디오 붉은 신호** | MemoryObjects.tsx, radio-signal.ts | 분기점에서 라디오가 저 혼자 불규칙하게 붉게 깜빡인다 | `max(0, 0.6·sin(2.3t)+0.4·sin(11.7t+1.3))²`: 대부분 0이고 가끔 봉우리가 선다 |
| **수집 완료 금빛 틴트** | MemoryObjects.tsx | 조사를 마친 물건은 회색이 아니라 금빛으로 남는다 | `WeakMap`에 원래 emissive를 보관한다. **`needsUpdate`를 걸지 않는다**(재컴파일 때문에 사진이 깜빡였다) |
| **문틈 빛, 문 금빛** | RoomShell.tsx, SpaceDoor.tsx, LivingRoomShell.tsx | 닫힌 방문 아래로 금빛 한 줄이 샌다. 열 수 있는 문은 손잡이가 빛난다 | emissive 상자, `approach`(damp) |
| **창밖 하늘** | WindowView.tsx | 해 진 직후의 하늘 그라데이션과 별 12개. 1막을 진행할수록 지평선 볕이 식고, 되돌아가지 않는다 | 4×256 캔버스 그라데이션 `CanvasTexture`를 벽 바로 뒤 판에 붙인다(무대 배경막 방식). 단조 증가하는 `outsideDecay`로 lerp한다 |

---

## 5. three.js: 카메라

| 효과 | 파일 | 보이는 것 | 구현 |
|---|---|---|---|
| **아이소메트릭 추적 리그** | CameraRig.tsx | 걸으면 카메라가 가슴 높이를 따라온다. 방 모서리에서는 덜 따라와 방 밖이 덜 보인다 | 위치, 타깃, 줌을 매 프레임 damp로 붙인다. 추적 한계는 열린 문간들의 **합집합 AABB**라 문턱에서 카메라가 튀지 않는다 |
| **타이틀 드리프트와 패럴랙스** | CameraRig.tsx | 타이틀 뒤에서 디오라마가 26초 주기로 저 혼자 돌고, 마우스를 따라 2도 미만 기운다 | 오버레이가 캔버스를 덮으므로 `window pointermove`를 직접 듣는다 |
| **방 안으로 내려앉기** | CameraRig.tsx | 시작을 누르면 2.2초에 걸쳐 방 안으로 들어선다 | 별도 트윈 없이 damp의 λ만 1.25로 낮춘다 |
| **포커스 프리셋** | layout.ts `CAMERA_PRESETS` | 조사할 때 물건 구도로 옮겨 가며 1.45배 확대된다. 엔딩은 문 옆 구도 | 프리셋 오프셋을 방위각·드리프트·패럴랙스만큼 회전시킨다 |
| **사용자 궤도와 줌** | RoomCanvas.tsx, room-canvas-runtime.ts | 좌드래그로 ±0.5rad 회전, 휠·핀치·키로 0.45~1.8배 줌. 조사가 끝나면 사용자가 잡아 둔 값으로 돌아온다 | 드래그가 6px를 넘으면 뒤따르는 click을 캡처 단계에서 삼킨다 |
| **줌아웃할수록 공간 중앙으로** | CameraRig.tsx | 멀리 뺄수록 목표점이 공간 중심으로 옮겨 가 빈 검정이 한쪽에 쏠리지 않는다 | `lerp(player, spaceCenter, zoomOutAmount)` |
| **사건 킥과 흔들림** | CameraRig.tsx | 기억을 주우면 화면이 숨 들이쉬듯 1.2% 물러났다 돌아온다. 라디오가 깨어나면 방이 한 번 떤다 | 줌 본값은 `zoomRef`로 따로 굴리고 킥은 곱하기만 한다. 흔들림은 `lookAt` **뒤에** rotateZ/Y로 얹어 누적되지 않게 한다 |
| **1인칭 리그** | FirstPersonRig.tsx, use-first-person-look.ts | 인트로와 문 넘기 구간에서 눈높이 1.38, FOV 68로 둘러본다 | 자체 `PerspectiveCamera`를 `useThree().set({camera})`로 **기본 카메라와 바꿔 끼우고**, 언마운트 때 되돌린다. 직교와 원근은 보간할 수 없어 컷으로 넘기고 DOM 덮개가 그 컷을 가린다 |
| **피아노 건반 카메라** | minigames/piano-melody | 피아노를 치는 동안 건반 정면 고정 카메라 | 거실 변환으로 위치를 계산한다. 세로 화면에서는 가로 폭을 지키도록 FOV를 넓힌다(`keyboardFov`) |
| **카메라 쪽 벽 걷어내기** | wall-culling.ts, CulledWall.tsx | 카메라를 향한 벽 윗부분이 스러지고 굽도리만 남는다. 벽에 붙은 포스터·창·거울도 함께 사라진다 | 벽 법선과 카메라 방향의 내적에 smoothstep을 걸고 damp(λ9)로 따라간다. 변화가 있을 때만 traverse하고, 0.02 아래면 `visible=false`. `transparent`는 마운트 때 미리 켜서 재컴파일이 한 프레임에 몰리지 않게 한다 |

---

## 6. three.js: 플레이어

| 효과 | 파일 | 보이는 것 | 구현 |
|---|---|---|---|
| **카메라 기준 이동과 충돌 슬라이드** | Player.tsx, spatial.ts | WASD나 조이스틱으로 화면 기준 방향으로 걷고, 가구에 걸리면 미끄러진다 | 카메라 방향을 xz로 평탄화한다. `moveThroughZones`는 축을 하나씩 푼다(x 먼저, 그다음 z). 몸 회전은 최단각 `dampAngle` |
| **클릭 이동** | pathfind.ts, Player.tsx | 누른 곳으로 걷고, 막혀 있으면 돌아간다 | 0.25 격자에서 8방향 **A\***(대각선은 양옆이 열려 있을 때만, octile 휴리스틱)로 경로를 찾는다. 설 수 없는 목표는 1.6 이내 가장 가까운 칸으로 옮긴다. 경로는 **string pulling**으로 편다 |
| **목적지 링** | WalkMarker.tsx | 목적지 바닥에서 금빛 링이 숨 쉬다가 도착하면 사라진다 | 지수 fade와 sin 스케일 |
| **스켈레탈 믹싱** | player-animation.ts | Idle·Walk·Sit·커튼 클립이 가중치로 섞인다 | `SkeletonUtils.clone`(일반 clone은 원본 뼈대에 묶인다). **Walk는 paused 상태로 두고 이동 거리만큼 time을 스크럽해** 발이 미끄러지지 않는다. StrictMode에서 이펙트가 다시 돌면 액션을 다시 얻는다 |
| **눈 깜빡임** | player-animation.ts | 2.8~6초마다 깜빡인다 | 믹서 **뒤에** morph `eyeBlinkLeft/Right`를 적용한다. 모프가 없으면 눈 뼈 scale로 대체 |
| **커튼 당기기** | curtain-animation.ts, Player.tsx | 커튼을 잡으면 창가로 걸어가 손을 뻗고, 드래그한 만큼 클립이 스크럽된다. 놓으면 팔이 내려온다 | 클립을 paused로 두고 `action.time`에 직접 쓴다. 손이 올라온 뒤부터 커튼이 손을 따른다 |
| **앉기와 눕기** | sit-motion.ts | 의자·소파·침대를 누르면 걸어가서 앉는다. 침대는 걸터앉았다가 발을 올리며 눕는다 | 모든 전이를 smoothstep으로 처리한다. 눕기 클립 없이 Idle을 발 원점 기준으로 눕힌다 |
| **의자 빼기** | use-seat.ts | 앉을 때 의자가 뒤로 빠지며 살짝 틀어진다 | damp(λ4.5) |
| **1인칭인데 거울에는 비친다** | Player.tsx, MirrorReflection.tsx | 1인칭에서는 몸이 안 보이지만 거울에는 보인다 | 몸을 `layers.set(1)`로 옮긴다. 메인 카메라는 레이어 0만 보고, 반사 카메라만 레이어 1을 켠다 |

---

## 7. three.js: 파티클과 빛 볼륨

세 파티클 모두 `points` + 커스텀 ShaderMaterial이다. 움직임은 **정점 셰이더에서 시간의 함수로** 계산하므로 CPU는 uniform만 올린다.

| 효과 | 파일 | 보이는 것 | 구현 |
|---|---|---|---|
| **창빛 먼지** | DustMotes.tsx | 창에서 내리꽂히는 빛줄기 안에서만 반짝이는 먼지 240개. 커서가 지나가면 비켜났다가 돌아오고, 어두울수록 천천히 돌아온다 | 상승(mod로 감아 도는 band), 두 주파수 흔들림, 명멸. 커서 밀어내기는 NDC에서 aspect를 보정해 계산한다. 크기는 세제곱 분포라 가끔 흐린 보케가 섞인다. Additive, depthWrite off |
| **창빛 광선판** | WindowLight.tsx | 커튼 틈에서 양옆으로 열리는 빛 판이 흐른다 | 비스듬한 평면 한 장에 두 옥타브 fbm을 두 겹으로 흘린다. 커튼 틈 `slit(uOpen)` smoothstep. 거의 0이면 `material.visible=false` |
| **기억 수집 버스트** | MemoryBurst.tsx | 조사를 마치는 순간 금빛 티끌 140개가 터졌다가 **화면 오른쪽 위 수첩 손잡이 쪽으로 쓸려 간다** | 반구 방향 attribute, ease-out scatter, pull². 쓸려 가는 방향은 카메라 행렬의 right·up을 섞은 월드 벡터 |
| **방 둘레 티끌** | RoomSurroundings.tsx | 디오라마 바깥 허공에 느린 금빛 티끌 320개 | DustMotes와 같은 셰이더 구조이고 조명과 무관하다 |

---

## 8. three.js: 반사와 렌더 타깃

| 효과 | 파일 | 보이는 것 | 구현 |
|---|---|---|---|
| **전신거울** | MirrorReflection.tsx | 방과 캐릭터가 실시간으로 비친다. 유리에 빛줄기 두 개가 얹혀 어두운 방에서도 유리로 읽힌다 | three `Reflector`(512²). **`onBeforeRender`를 감싸** `overrideMaterial` 렌더(AO·아웃라인 패스)와 메인 카메라가 아닌 렌더를 건너뛴다. 이게 없으면 반사 하나가 프레임 비용을 서너 배로 만든다. 3인칭에서는 2프레임에 한 번 그린다 |
| **slit-scan 거울** | SlitScanMirror.tsx, slit-scan.ts | 30일 만에 보는 얼굴이 **세로줄마다 시간이 어긋나** 비친다(오른쪽일수록 최대 0.6초 전). 2막 볕이 오를수록 줄이 맞아 보통 거울이 된다 | Reflector 출력을 직교 카메라로 한 번 더 그려 **유리 uv 이미지**로 만들고, 12장 HalfFloat RT **링버퍼**에 넣는다. 24열마다 지연 칸을 고른다. 샘플러 배열 동적 인덱싱은 드라이버마다 틀릴 수 있어 **if 사슬을 코드로 생성**한다. 프레임 카운터는 `renderer.info` 대신 useFrame 카운터(render 호출마다 올라서 시간축이 틀어진다) |
| **모니터 도트 반사** | DotReflection.tsx, dot-screen.ts | 꺼진 모니터에 방이 **인광체 도트 격자**로 뭉개져 비친다. 어두울수록 도트가 굵고(22개), 되찾을수록 촘촘해진다(88개) | Reflector 셰이더 문자열을 **anchor 치환으로 패치**한다. 로컬 uv varying을 추가하고(Reflector의 vUv는 투영 좌표라 격자가 미끄러진다) `fract(uv*uDots)` 원형 마스크를 건다. anchor가 없으면 패치 없이 폴백. heavy가 아니면 컴포넌트를 아예 마운트하지 않는다 |
| **앰플 유리 굴절** | Ampoule.tsx | 들어 올린 앰플 너머가 굴절돼 보인다 | `MeshPhysicalMaterial` transmission을 heavy이면서 카메라가 고정된 구간에서만 켠다. 그 밖에서는 opacity 0.4 |

---

## 9. three.js: 커스텀 셰이더와 재질 패치

| 효과 | 파일 | 보이는 것 | 구현 |
|---|---|---|---|
| **세면대 물 파문** | SinkWater.tsx, water-ripple.ts | 고인 물이 열쇠를 집는 순간 파문으로 번지고, 바닥 배수구가 굴절로 흔들리다 잔잔해진다 | RT 없는 ShaderMaterial 한 장. 배수구 바닥을 **셰이더가 절차적으로 그린다**. `cos(dist*70-age*21)` 파문. **가짜 굴절**은 바닥 샘플 좌표를 기울기만큼 민다. 기울인 법선으로 스펙큘러를 만든다 |
| **이불 호흡** | BedModel.tsx | 누가 누워 있을 때만 이불이 숨 쉬듯 일렁인다 | `onBeforeCompile`로 `begin_vertex` 뒤에 sin 변위를 넣는다. uniform 객체를 바깥 useMemo에서 셰이더에 그대로 꽂는다 |
| **이불 접힘** | BedModel.tsx | 침대를 누르면 이불이 발치로 접힌다 | shape key `folded`를 damp. **StrictMode 대책**으로 메쉬를 ref가 아니라 useMemo 반환값에 담는다 |
| **컵라면 물때** | FurnitureModel.tsx | 방이 어두워질수록 용기에 물때가 자란다 | `map_fragment` 뒤에 `diffuseColor.rgb *= texture2D(uStain,vUv)`를 넣는다. map이 없는 재질도 `USE_UV`를 강제로 켠다 |
| **화장실 물때** | BathroomStains.tsx, reaction-diffusion.ts | 타일에 대비가 낮은 곰팡이 무늬 | CPU **Gray-Scott 반응확산**(96², 320스텝, 결정적 시드). `MultiplyBlending` + `premultipliedAlpha` 판으로 얹는다 |
| **악보 잉크가 모인다** | PianoSheet.tsx, sheet-ink.ts | 찢어진 조각을 들고 들어서면, 물에 번진 마디가 1.5초에 걸쳐 거꾸로 음표로 모인다 | Canvas 2D `ctx.filter = blur(11px*(1-g))`로 다시 칠하고 매 프레임 `needsUpdate` |
| **3D 표면의 글자** | piano-melody, DialDrums.tsx, InspectTurntable.tsx | 건반 계이름, 드럼 숫자, 인스펙트 면의 글자가 언어를 따른다 | 모두 CanvasTexture로 굽는다. 언어나 팔레트가 바뀌면 다시 굽고 dispose |
| **재구성 연출** | WireframeReveal.tsx | 라디오 재점화와 새 공간 첫 진입 때 방 전체가 0.45초간 **와이어프레임으로 풀렸다가** 면으로 돌아온다 | `scene.traverse`로 `wireframe=true`를 켰다가 되돌린다. settle 값은 ScreenTransition으로 넘긴다 |

---

## 10. three.js: 오브젝트 애니메이션과 3D 인터랙션

| 효과 | 파일 | 보이는 것 | 구현 |
|---|---|---|---|
| **커튼 젖히기** | RoomFurniture.tsx, curtain-motion.ts | 드래그하면 천이 뭉치며 창이 드러난다. 놓으면 **관성(flick)**을 보고 끝까지 가거나 도로 닫힌다. 탭하면 토글 | 천을 옮기지 않고 shape key `open`만 바꾼다. 커튼 평면과 광선을 교차시키고, pointer capture를 쓴다. 속도 EMA를 0.12초 앞으로 투영해 문턱과 비교한다. 0.1초 이상 멈췄다 놓으면 속도를 버린다 |
| **호버 → 커서 흡착** | use-glow-hover.ts, CursorTargetProjector.tsx | 호버하면 DOM 커서 링이 물건 중심으로 빨려들고 윤곽이 밝아진다 | `Box3` 중심을 `project(camera)`로 화면 px로 바꿔 모듈 싱글턴에 기록하고, DOM 커서가 rAF에서 읽는다 |
| **호버 들림, 클릭 펀치** | memory-motion.ts | 호버하면 살짝 뜨고 커진다. 클릭하면 한 번 눌렸다 튄다 | `1 - 0.16·sin(2πp)(1-p)²` |
| **기억 표식** | MemoryBeacon.tsx | 바닥의 금빛 고리와 공중에서 도는 마름모. 가까이 가면 커지고 밝아진다 | Additive, `raycast={() => null}`로 클릭 대상에서 뺀다 |
| **근접 판정** | use-near-player.ts | 커튼·스위치는 다가가야 빛난다 | useFrame setState를 피하려고 100ms 폴링 |
| **숨은 공간 클릭 차단** | event-visibility.ts | 숨은 방의 물건이 클릭을 가로채지 않는다 | `setEvents({ filter })`로 조상까지 visible인 hit만 남긴다(three raycast는 visible을 보지 않는다) |
| **투명 판정 구** | MemoryObjects.tsx 등 | 얇은 물건도 손가락으로 짚힌다 | opacity 0 구를 글로우 선택 밖에 둔다 |
| **서랍, 문, 배트, 시계** | RoomFurniture.tsx, SpaceDoor.tsx, EndingTrigger.tsx | 서랍이 밀려 나오고, 문이 경첩으로 젖혀지고, 엔딩 배트가 들려 사라지고, 멈췄던 초침이 2막부터 한 칸씩 다시 간다 | damp/approach. 초침은 `floor(elapsed)` 스텝 회전 |
| **한 번에 한 공간** | MemoryRoomScene.tsx | 지금 서 있는 공간만 보인다 | `<group visible>` 토글 |

---

## 11. three.js: 별도 Canvas

| 효과 | 파일 | 보이는 것 | 구현 |
|---|---|---|---|
| **3D 인스펙트 턴테이블** | components/canvas/InspectTurntable.tsx | 집어 든 물건을 돌리고 확대한다. **찾아야 할 면을 ±37° 안에서 0.35초 마주 보면 발견**으로 친다(휙 지나간 건 못 본 것) | 박스 면마다 CanvasTexture를 붙인다. 둥근 귀 카드는 ShapeGeometry와 Extrude 테두리. 스팟 조명과 금빛 림 라이트, `ContactShadows` |
| **캐릭터 뷰어** | CharacterTurntable.tsx | 수첩에서 캐릭터를 돌려 보고 포즈를 고른다. 손을 떼면 2.2초 뒤 저절로 돈다 | 게임과 **같은 플레이어 리그 함수**를 재사용한다 |
| **숫자 드럼** | DialDrums.tsx | 하부장 다이얼 드럼 두 개를 굴린다 | 누적 step에 드래그 몫을 더해, 9→0으로 넘어갈 때 역회전하지 않는다 |

---

## 12. CSS·DOM: 부팅, 로딩, 타이틀

| 효과 | 파일 | 보이는 것 | 구현 |
|---|---|---|---|
| **부팅 커튼** | BootCurtain.tsx, `boot-curtain-rise` | 로딩이 끝나면 커튼이 위로 접혀 올라간다. 12% 지점에서 한 번 처져 천의 무게를 낸다 | 1.1s `cubic-bezier(0.62,0,0.28,1)`. 최소 노출 900ms, 12초 뒤 포기. 걷히는 순간 타이틀이 그 밑에서 계단식으로 놓인다 |
| **떠오르는 먼지** | RisingDust.tsx, `.boot-dust` | memory 색 점 34개가 아래에서 떠오른다 | 낱알마다 duration, **음수 delay**, drift/blur를 인라인 CSS 변수로 준다. 난수는 `Math.sin` 해시라 SSR과 hydration 값이 같다 |
| **로딩 막대** | LoadingIndicator.tsx, loading-progress.ts | 8칸 분절 막대. 진행률을 모르면 조각이 왕복한다 | LoadingManager의 계단식 보고를 rAF 지수 감쇠로 펴고, 멈추면 남은 구간의 38%까지만 기어간다. 되감기는 금지 |
| **서비스 워커와 PWA** | public/sw.js | 두 번째 방문부터 즉시 로드 | 에셋은 cache-first, 문서는 network-first. Range 요청은 건너뛴다 |
| **픽셀 로고** | `.title-logo` | 굵은 픽셀 제목 | 크기는 **14의 정수배만** 쓴다(Galmuri14 그리드). 굵은 웨이트가 없어 `text-shadow`로 **1em/14씩 세 번 더 찍어** 획을 굵힌다 |
| **계단식 등장** | TitleScreen.tsx, `stagger-rise` | 로고 → 메뉴 → 안내 → 언어 순서로 놓인다 | `--stagger-index × 55ms` delay |
| **모서리 선 그리기와 금빛 훑기** | `rule-draw`, `rule-sweep` | 네 귀에서 선이 자라 나오고, 아래 띠를 금빛이 한 번만 지나간다 | scaleX/Y, `origin-*`을 모서리 쪽으로 둔다 |
| **메뉴 항목** | TitleScreen.tsx | hover하면 ▶가 4px 미끄러져 들어오고 밑줄이 글자 폭만큼 그어지며 글로우가 생긴다 | translate, scale-x, text-shadow transition |
| **시작 퇴장** | `title-retreat` | 올라온 순서 그대로 계단을 밟아 사라진다. 그동안 카메라가 방으로 내려앉는다 | 260ms 뒤 startGame |
| **언어 밑줄** | LanguageToggle.tsx | 밑줄 하나가 고른 언어 밑으로 미끄러진다 | `offsetLeft/Width`를 재서 left/width transition. 폰트 로드 뒤 다시 잰다 |

---

## 13. CSS·DOM: 인게임 HUD와 혼잣말

- **레이어 순서**: 씬 < 대사·혼잣말 < HUD·모달 < 타이틀·미니게임·컷씬 < 대사창·커튼·파티클 < 대사 로그 < 커서.
- **방 비네트**: radial-gradient의 불투명도가 밝기 V곡선을 따른다. 1인칭 비네트는 따로 있다.
- **필름 그레인 타일** `.film-grain`: 인라인 SVG `feTurbulence` + `mix-blend-mode: overlay`.
- **`.room-backdrop`**: 캔버스 뒤 라디얼 두 겹. 3D 스프라이트로 두면 투명 정렬 때문에 벽을 뚫고 보여서 DOM으로 뺐다.
- **진행 카운터**: 숫자는 `key={count}` 재마운트로 밀려 올라온다(`count-tick`). 진행 칸은 **새로 찬 칸만** `segment-fill`(scaleX + 글로우)을 돈다.
- **햄버거 ↔ X**: 아이콘을 바꾸지 않고 SVG line 세 개를 `transform-box: fill-box`로 접는다.
- **소리 토글**: **켤 때만** 파문 링이 번진다. 끌 때 소리가 나면 안 꺼진 것처럼 들리기 때문이다.
- **목표 배너 → 도크**: 배너는 왼쪽 위로 사라지고 도크는 같은 방향에서 들어온다. 요소를 옮기지 않고 방향 착시로 이동을 표현한다.
- **기록 라벨** `HudLogLine`: `MEMORY LOG · DAY 31 · NO SIGNAL`. 3막에는 1px 어긋난 ember 그림자로 깜빡임 없이 "오염"을 표현한다.
- **미니맵**: SVG 평면도. 누르면 수첩 평면도 탭이 열린다.
- **수첩 손잡이**: 세로쓰기 라벨. hover하면 translate가 아니라 **폭**을 늘려 서랍처럼 당겨진다(translate는 가장자리에 틈을 만든다). 온보딩 때는 `hotspot-glow`로 숨 쉰다.
- **혼잣말** (`Monologue.tsx`, `monologue-exit.ts`)
  - 경계 없는 라디얼 veil 위에 픽셀 글자가 타자기로 찍힌다.
  - **글자 단위 퇴장**: 1막(외면)은 뒤쪽 글자부터 **아래로 떨어지고**, 2막(직면)은 앞 글자부터 **위로 올라간다**. 방향의 반전이 서사의 태도 반전이다.
  - 어절은 `nowrap` span, 글자는 `inline-block` span으로 감싸 keep-all 줄바꿈을 지키면서 transform을 건다.
  - 숨길 때 언마운트하지 않고 opacity만 내린다. 돌아와서 처음부터 다시 찍지 않게 하려는 것이다.
- **터치 조작**: 조이스틱(pointer capture, `translate3d`)과 둘러보기 버튼(rAF로 ref에 직접 더한다).

---

## 14. CSS·DOM: 대사 시스템

- **대사창** `.dialogue-panel`: 위는 비치고 아래로 짙어지는 그라데이션. 테두리 없이 위쪽에만 memory 1px 선을 둬 자막처럼 보인다.
- **전체 화면이 "다음" 버튼**: 창 자체는 `pointer-events-none`이다.
- **타자기** (`lib/use-typewriter.ts`): 70ms/글자, 코드포인트 단위. 클릭하면 먼저 채우고, 다 찼으면 다음 줄로 간다.
- **화자 전환**: 화자가 바뀔 때만 `speaker-swap`. 본문 높이는 두 줄로 고정해 창이 출렁이지 않는다. 다음 표식은 `bob-arrow`.
- **초상** (`CharacterPortrait.tsx`)
  - 밑단을 `mask-image`로 흐린다.
  - 표정 전환은 **바닥 프레임을 늘 불투명하게 깔고** 위 레이어만 페이드한다. 투명 PNG 두 장을 교차 페이드하면 합성 알파가 떨어져 캐릭터가 비쳐 보인다.
- **오토 모드**: `min(5200, 900 + 글자수×60)ms`.
- **키보드**: window **캡처 단계**에서 Enter/Space를 받는다. 뒤에 살아 있는 미니게임에 입력이 새지 않게 하려는 것이다.
- **글자 틱 사운드** (`dialogue-sfx.ts`): 두 글자마다 한 번 울리고 구두점은 침묵한다. **화자마다 음높이가 다르다**(A단조 5음계 비율). 방송 화자는 잡음 틱.
- **대사 로그**: 최근 14줄, 오래된 줄일수록 옅다. click으로 닫히므로 스크롤 제스처로는 닫히지 않는다. `scrollIntoView` 대신 scrollTop을 직접 쓴다(HUD가 밀리는 버그가 있었다).

---

## 15. CSS·DOM: 컷씬, 웹툰, 시점 전환

### 컷씬 (`PlaybackScene.tsx`)
- **등장**: 한 박자 숨었다가 떠오른다. 그 사이 방은 캔버스 셰이더의 **tear**로 찢긴다.
- **라디오 도입 3단계**: 정적(그레인 떨림 + 노이즈) → 블랙아웃(완전 침묵) → 컷.
- **SignalVisual**: 그림이 아직 없는 컷의 대체 화면.
  - 56개 막대 파형. 막대마다 해시로 음수 delay와 포락선을 준다.
  - 다이얼 눈금, 불규칙 램프, 스캔라인.
  - 방송이 죽는 컷은 ember, 살아나는 컷은 memory로 **색만 바꿔** 같은 파형에 다른 뜻을 준다.
- **필름 먼지와 스크래치**: 그라데이션 점 타일이 `steps(1)`로 **순간이동**한다(흐르게 하면 눈 내리는 것처럼 보인다). 스크래치는 7.3초 주기 중 두 지점에서만 선다.
- **사운드**: 필름 릴 시작음, 테이프 히스 노이즈 베드, 컷마다 셔터음.

### 컷 전환 노이즈 디졸브 (`CutDissolve.tsx`, `cut-dissolve.ts`)
- 앞 컷 이미지를 붙잡을 수 없어서, void 색 장막을 새 컷 위에 덮고 **노이즈를 문턱값으로 잘라** 걷어낸다(600ms).
- 결은 컷마다 순환한다: `film`(픽셀 백색잡음) / `paper`(가로 박스 평균 섬유결) / `water`(value noise 얼룩).
- 30fps로 제한하고 **알파 채널만** 다시 쓴다. 장막 색은 `getComputedStyle`로 토큰에서 읽는다.

### 사진 모프 (`PhotoMorph.tsx`, `photo-morph.ts`)
- 액자 다시보기에서 1막 사진(부모 얼굴이 잘림)이 2막 사진(셋이 다 보임)으로 밀려 넘어간다.
- 두 가지가 동시에 일어난다.
  - **틀이 물러남**: 1막이 담은 영역에서 전체로 lerp한다. 두 그림을 늘 같은 자리에 겹쳐 이중노출을 막는다.
  - **변위장 밀림**: water 노이즈 두 장을 x·y 변위장으로 쓴다.
- 프리멀티플라이 알파로 섞고 가장자리를 페더링한다. 방이 이미 WebGL을 쓰고 있어 Canvas 2D로 처리한다(320px, 30fps).

### 웹툰 뷰어 (`WebtoonViewer.tsx`)
- 칸이 번호순으로 떠오르고, 아직 차례가 아닌 칸은 `invisible`로 자리만 지킨다.
- 페이지는 좌우로 넘어간다. 옛 장을 500ms 붙들어 둔다.
- 넘치는 페이지는 현재 칸이 든 줄을 화면 가운데로 끌어올린다.
- **흰 타원 말풍선**: 칸 아래 테두리에 걸쳐 칸 밖으로 나간다. 앞 칸의 z-index를 위로 둬 다음 칸 그림에 덮이지 않는다.
  - **아직 안 찍힌 글자를 `invisible` span으로 미리 깔아** 타자기가 찍히는 동안 줄바꿈이 흔들리지 않는다.
- **의성어** `.webtoon-sfx`: `-webkit-text-stroke` + `paint-order: stroke fill`.

### 시점 전환 (`ViewpointTransition.tsx`)
- 덮개 톤은 네 가지다: 눈을 뜨는 어둠(enter), 불 켜기(lightsOn: **순백 대신** 누르스름한 중간 밝기, 광과민 배려), 문 넘기(memory), 워프(흐림만).
- 시계가 아니라 **rAF 두 번 + 160ms** 뒤에 걷힌다. 새 카메라가 실제로 한 장 그려진 뒤여야 하기 때문이다.
- **초점 맞춤**: `backdrop-filter: blur()`를 0까지 애니메이션한다. 덮개의 자식이 아니라 **형제**로 둔다. opacity가 움직이는 조상 아래의 backdrop-filter는 캔버스에 닿지 않기 때문이다.

---

## 16. CSS·DOM: 단서, 수첩, 모달

- **단서 오버레이**: 닫기 버튼을 **종이 밖**에 둔다. 종이 위에 버튼이 얹히면 창처럼 보이기 때문이다. 접힌 쪽지는 SVG 종이 위에 i18n 글씨를 올린다.
- **거울 유리** `.mirror-glass`: 사선 하이라이트와 세로 그라데이션.
- **수첩** (`CharacterSheetModal.tsx` 등)
  - **제본 구멍**: `.notebook-punch` radial-gradient를 repeat-y로 반복한다. 구멍 안이 씬 색이라 실제로 뚫린 것처럼 보인다.
  - **모눈**: `repeating-linear-gradient` 24px 격자. 이미지 에셋은 없다.
  - **접힘 그림자**: gutter 그라데이션을 페이지 위에 고정한다.
  - **인덱스 탭**: 고른 탭이 `-mb-px`로 아래 선을 덮어 페이지와 한 장처럼 이어진다.
  - **잠긴 값** `BlurredValue`: 본문을 DOM에 싣지 않고 막대와 hint만 둔다. 흐린 텍스트도 결국 텍스트라 노출되기 때문이다.
  - **스크랩북 카드**: ±0.6° 번갈아 기울이고(규칙의 의도적 예외), 마스킹 테이프는 `mix-blend-multiply`라 모눈이 비친다. 미조사 칸은 사진 홀더만 있다.
  - **평면도**: SVG 방 rect 위에 `fill-paper` rect를 덮어 문간 구멍을 낸다. 이름표는 viewBox 비율 %로 배치한 DOM 버튼이고, 누르면 그 방으로 워프한다.
- **피드백 모달**: 실패해도 본문을 지우지 않는다. 진행 메타를 자동으로 첨부하고 `/api/feedback`가 구글 폼으로 넘긴다. 성공 토스트는 모달과 별개로 띄운다.
- **공통**: 모든 모달이 `setUiLock`으로 방 입력을 잠그고 Escape로 닫힌다.

---

## 17. CSS·DOM: 미니게임 호스트, 결과 연출, 엔딩

- **MinigameHost**
  - 백드롭이 카드보다 먼저 깔린다(`backdrop-in`).
  - 조작법을 읽기 전에 타이머가 돌지 않도록, 시작 버튼을 눌러야 판을 마운트한다.
  - 결과 대사 단계에는 판을 `inert`로 둔다. 시작 뒤에는 백드롭 클릭으로 닫히지 않는다(닦기 제스처 오작동 방지).
- **결과 카드**: 성공은 memory 테두리, 실패는 ember 테두리. 버튼은 **600ms 뒤에** 나타난다(판을 두드리던 손가락의 오클릭 방지). 성공은 2.6초 뒤 자동으로 넘어간다.
- **ExitFade**: React 언마운트 순간 `useLayoutEffect` cleanup에서 **DOM을 `cloneNode`해 유령으로 세우고** 페이드한다. 진짜 상태는 즉시 떼므로 끝난 판이 결과를 다시 보고할 위험이 없다.
- **SuccessBurst**: 폭죽이 아니라 **떠오르는 금빛 입자** 84개(Canvas 2D).
  - 글로우 스프라이트를 미리 굽고 `drawImage`한다(shadowBlur보다 싸다).
  - 그라데이션 끝을 `transparent`가 아니라 **같은 색 알파 0**으로 둔다(검정을 거쳐 거뭇한 테가 생기는 것 방지).
  - `lighter` 가산 혼합.
- **엔딩** (`EndingScreen.tsx`)
  - door(1.8s): 투명하게 두어 3D 문 열림, GodRays, burn 셰이더를 보여 준다.
  - film: 엔딩 영상. 자동재생이 막히면 재생 버튼을 띄운다.
  - card: 감사 그림, 다시보기, 이미지 저장, 처음으로.
- **EndingConfetti**: 여기서만 **진짜 색종이**를 쓴다. 160조각, 중력과 종단속도, `scale(1, cos(flip))`로 뒤집히며 납작해지는 종이를 표현한다. 모두 화면을 벗어나면 rAF를 멈춘다.

---

## 18. CSS·DOM: 커스텀 커서

`CustomCursor.tsx`, `cursor-ring.ts`

- 마우스 기기의 첫 `pointermove`에서 켜진다. 터치이거나 reduced motion이면 네이티브 커서를 쓴다.
- **점**: 6px, `mix-blend-mode: difference`라 밝은 종이 위에서는 어둡게, 방에서는 밝게 보인다.
- **링**: damp(λ32)로 늦게 따라와 손의 속도를 그린다.
  - DOM 버튼 위에서는 0.7로 조이고 memory 색이 된다.
  - **3D 물체 위에서는 물체의 화면 좌표로 빨려들며 사라지고**, 그 순간 3D 윤곽이 밝아진다.
- **누르기와 클릭**: 누르면 `::after`가 한 번 더 조인다. 클릭 파문은 클래스를 떼고 `offsetWidth`로 리플로우를 강제한 뒤 다시 붙여 연타에도 매번 돈다.
- `html.custom-cursor { cursor:none }`을 레이어 밖 규칙으로 둬 Tailwind `cursor-pointer`를 이긴다.

---

## 19. 미니게임 17종

공통 구조
- 계약은 `types/minigame.ts`, 레지스트리는 `minigames/index.ts`(전부 `React.lazy`).
- 모드는 canvas 2개(piano-melody, ampoule-pickup)와 overlay 15개다.
- `useSkipEligible`이 난이도 게이트를 한 곳에서 맡는다. **스킵은 easy에서만** 나타난다.
- 도움말의 키 이름은 `<kbd>` 키캡으로 분리해 보여 준다.

| id | 연결 위치 | 플레이 | 핵심 기법과 연출 |
|---|---|---|---|
| **fighter-duel** | 게임기 1차 | 1:1 실시간 격투. 잡기 > 가드 > 공격 > 잡기의 삼각 상성이 버튼이 아니라 **상황**으로 걸린다 | rAF 시간을 16ms로 잘라 도는 **고정 스텝 시뮬레이션**(따라잡기 최대 250ms). `advance()`는 순수 함수. 기술마다 발동·유효·경직 **프레임 데이터**, 히트스톱, 카운터, 콤보, 벽 밀림. **상대 AI**는 상태기계로 예고(telegraph)·가드 유지·대공·응징을 하고, 같은 버릇이 3번 쌓이면 **읽고 대응**한다. 체력 35% 이하에서 분노. 난수는 주입식이라 테스트할 수 있다. 7프레임 스프라이트 시트, 피격 플래시(`brightness(3.4)`), COUNTER/BROKEN 외침, FIGHT!/K.O. 배너, 스캔라인 |
| **ball-catch** | 공 1차 | 날아와 커지는 공이 링에 겹치는 순간 스윙 | rAF에서 ref로 DOM style을 직접 바꾼다. 크기는 `0.25+1.05·t^1.6` ease-in 원근. 첫 공은 튜토리얼 투구. 출발 위치는 직전과 반대쪽, 구종은 직전과 다르게 뽑는다. 안타마다 빨라진다. 필드 흔들림, 임팩트, 배트 샘플 소리 |
| **photo-wipe** | 액자 1차 | 먼지 낀 가족사진을 문질러 70% 이상 닦는다 | Canvas 2D에 **blur 사진 + 토큰 색**으로 먼지 층을 만들고, `destination-out` 원으로 지운다. 진행도는 픽셀을 읽지 않고 **16px 셀 격자**로 센다. 행주 SVG 커서. 성공하면 사진을 크게 띄우고 금빛 입자 |
| **photo-puzzle** | 액자 2차 | 3×3 슬라이딩 퍼즐 | 풀린 판에서 합법 수로 역섞기해 항상 풀리는 판을 만든다. 조각은 `background-size:300%`로 자르고, 틈은 gap 대신 inset shadow로 낸다 |
| **calendar-flip** | 달력 | 7~11월을 넘겨 읽는다. 사건일 붉은 링, 비밀번호 출처 금색 링, 11월은 正자 탈리 | **CSS 3D**: 윗축 기준 `rotateX`, perspective 900, 아래 장에 떨어지는 그림자와 음영이 함께 움직인다. 되넘기기는 `animation-direction: reverse`, 축 위는 clip-path로 자른다 |
| **phone-chat** | 폰 1차 | 스마트폰 목업의 세 탭(단톡, 가족, 통화)을 모두 읽는다 | 한 줄씩 `fade-rise`로 연다. 스크롤이 바닥을 따라간다. `role="log"` |
| **mom-chat** | 폰 2차 | 엄마 방을 열면 그날 아침 마지막 문자가 나온다 | PhoneShell 재사용 |
| **computer-browse** | 컴퓨터 2차 | 부팅 로그 → 4자리 비밀번호 → 메일과 뉴스 | 숫자 슬롯 위에 **투명한 진짜 `<input>`**을 겹쳐 키보드·스크린리더·포커스를 모두 지원한다. 오답은 `page-nudge`로 흔들린다 |
| **computer-logo** | 컴퓨터 3차 | 반쯤 지워진 로고와 같은 것을 고른다 | SVG `clipPath`로 반만 보여 준다. 로고는 `currentColor` 선화 |
| **window-view** | 창 | 돋보기로 창밖에서 세 자리를 찾는다 | 렌즈는 같은 이미지를 `background-size:240%`로 깐 원형 요소다. 바깥은 `.window-night`(multiply)로 밤 톤을 입히고 렌즈 안은 원화 그대로. 키보드로도 렌즈를 움직일 수 있다 |
| **radio-quiz** (+frequency-tune) | 라디오 1차 | 흔들리는 바늘을 금색 대역에서 멈춘 뒤, 글자 풀로 답을 채운다 | 바늘은 **위상을 누적**해 주기가 바뀌어도 순간이동하지 않는다. **목표와의 거리에 비례한 잡음 게인**으로 귀로도 조준할 수 있다. 라디오 PNG의 알파로 뚫린 창 아래에 눈금을 겹치고 `cqw`로 크기를 잡는다. 3회 틀릴 때마다 힌트 글자를 공개한다 |
| **card-flip / id-card-flip / ampoule-case** | 쪽지, 출입증, 앰플 | 3D 물건을 돌려 숨은 면을 찾는다 | 인스펙트 턴테이블(11장). `cos(yaw-found)>0.8`이 0.35초 유지되면 발견 |
| **papers-order** | 안방 서류 | 날짜 조각 4장을 순서대로 놓는다 | 집기·교환 방식이고 키보드로 들고 이동할 수 있다. 종이 조각은 ±0.6° 기울인다 |
| **sink-dial** | 화장실 퍼즐 | 2자리 드럼을 "11"에 맞춘다 | r3f 드럼. 드래그 도중 덜 넘어간 비율을 넘겨 드럼이 손을 따라 기운다 |
| **piano-melody** | 거실 퍼즐 | 씬 안 피아노로 6음을 친다. 번진 마디는 조각을 들고 와야 보인다 | 카메라 교체, 뚜껑과 건반 damp, 계이름 CanvasTexture, `playTone` 평균율 |
| **ampoule-pickup** | (현재 미연결) | 서랍에서 앰플을 집어 든다 | easeOutCubic 서랍, 1.8배 들기(직교 카메라라 배율로 "눈앞"을 연출), 굴절 유리 |

---

## 20. 게임 흐름과 인터랙션 시스템

### 데이터 파이프라인
`content/*.yaml`(대본·흐름의 단일 소스) → `pnpm content:build` → `src/data/generated/content.ts` + i18n. 로컬 `/admin` 편집기도 같은 파이프라인을 쓴다.

### 페이즈는 저장하지 않고 파생한다 (`data/story-phase.ts`)
```
intro → p1 → turning → p2 → p3 → p4 → resolve → ending
```
- 필수 조사 목록은 `from`과 `side`에서 자동으로 계산한다. 코드에 목록을 손으로 적지 않는다.
- 기억 하나에 조사 차수가 최대 셋(1차/2차/3차)이다. `unlockAfter: [computer@3]` 형태의 의존을 건다.

### 클릭에서 수첩까지
1. **3D 오브젝트 클릭** (`InteractiveMemory`): available이면 펀치 모션과 함께 진입한다. 잠겼거나 이미 본 물건이면 혼잣말이나 수첩의 한 줄을 띄운다. 키보드는 가까이에서 E/Enter.
2. **`beginInteraction`**: 대사 → 미니게임 → 완료 순으로 분기한다.
3. **대사**: 타자기와 오토 모드.
4. **미니게임**: overlay는 시작 카드 → 판 → 결과 카드, canvas는 곧바로 결과. 실패하면 핫스팟이 남아 재도전할 수 있다.
5. **결과 대사**: 판을 정지 화면으로 뒤에 남긴 채 진행한다(`keepMinigame`).
6. **`complete()`**: 차수별로 기록하고 걸린 컷씬을 **대기열**에 줄 세운다(radio-blackout, survivor-broadcast, trip-doubt, p2-close, p4-close, still-beat).
7. **수첩**: 기록 항목은 진행에서 파생된다. 안 읽은 점이 붙고, 다시보기는 미니게임을 빼고 대사와 그림만 이어 재생한다.

### 그 밖의 시스템
- **재생 기계** `ActivePlayback`: 컷씬과 다시보기가 공유한다. intro → 줄 → holdMs 정적 → 다음 컷. 스킵은 지금 컷씬만 닫고 대기열은 계속 흐른다.
- **문·아이템·퍼즐·단서**: 방문(radio 2차 후), 안방 열쇠(sink-dial 보상), 단서 뒤집기로 `hero-name`과 `sink-code` 발견.
- **1인칭 구간**: 인트로(어둠 속에서 스위치 찾기)와 문 넘기.
- **입력 잠금**: 인터랙션, 재생, 퍼즐, `uiLocks` 중 하나라도 있으면 씬 입력을 막는다.
- **엔딩 시퀀스**: 배트가 빛남 → 쥐기 컷씬 → 현관문 → 문 열림과 GodRays → 영상 → 색종이 카드 → 처음으로.
- **저장** (zustand persist, `rom-progress` v3)
  - 진행, 수첩, 설정만 저장한다. 위치와 진행 중인 판은 저장하지 않는다.
  - `sanitizeProgress`가 모르는 id를 버리고, 차수·문·엔딩의 선후 관계를 불러올 때 다시 검증한다.

---

## 21. 오디오 연출

- **효과음 합성** (`lib/audio/engine.ts`, `voices.ts`)
  - 파일 없이 Web Audio로 만든다: 오실레이터(주파수 지수 램프) + 필터드 노이즈.
  - 딸깍 소리를 막는 지수 엔벨로프, 같은 소리 40ms 중복 차단, `variation`으로 무작위 피치.
  - 샘플 파일이 등록된 소리만 파일로 덮어쓴다(예: batHit).
- **노이즈 베드**: 루프 노이즈에 HP/LP를 걸고 `setTargetAtTime`으로 레벨을 조절한다. 라디오 잡음과 테이프 히스에 쓴다.
- **BGM** (`music.ts`)
  - 그래프: `source → lowpass → dry/convolver → gain`.
  - **방 밝기 하나가 컷오프(460Hz~16kHz), 음량, 리버브 wet을 함께 움직인다.** 어두운 방에서는 곡이 먹먹하고 멀게 들린다.
  - **루프 이음새**: 꼬리 2.4초를 머리에 equal-power 크로스페이드로 접어 넣어 루프를 굽는다.
  - 트랙 교체는 2.2초 크로스페이드.
  - 정지할 때는 컷오프를 먼저 닫아 곡이 **물 밑으로 가라앉듯** 사라진다.
  - 리버브 임펄스는 코드로 굽는다. 대사와 미니게임 중에는 덕킹한다.
- **UI 연동**: DOM hover 소리(터치 제외), 화자별 대사 틱, 컷 셔터음, 수집음·라디오 각성음(스토어 subscribe 한 곳에서 재생).

---

## 22. 접근성과 reduced motion

- **reduced motion**
  - CSS: 등장은 짧은 fade로 대체한다. 장식 루프, 파문, 먼지는 끈다. 달력 넘김은 **줄이기만 하고 끄지 않는다**(넘기는 동작 자체가 내용이다). 격투는 정보를 나르는 대미지 숫자만 남긴다.
  - JS: 타자기 즉시 완성, 파티클·색종이·커스텀 커서·ExitFade 생략, 카메라 λ 상향, 흔들림·tear 없음, 그레인은 정지 타일로 대체.
- **광과민 규정**: 전면 순백 금지, 초당 3회를 넘는 밝기 변화 금지.
- **키보드**
  - 모든 미니게임을 키보드로 할 수 있다(예외: photo-wipe는 스킵으로 우회).
  - 3D 물건은 sr-only 버튼 목록으로 조작하고, 쓸 수 없는 물건은 `aria-disabled`로 이유를 남긴다.
  - 턴테이블은 드래그를 대신하는 버튼이 있다.
- **상태를 색만으로 말하지 않는다**: ▶ 표시, `aria-pressed`, 라벨을 함께 쓴다. `inert`, `role=status/alertdialog/log/progressbar`를 사용한다.

---

## 23. 성능·안정성 트릭 모음

- 반사 3종에 `onBeforeRender` 가드를 두고, 그리는 간격을 2~3프레임으로 둔다. 그 공간에 있을 때만 그린다.
- 무거운 RT 효과는 꺼져 있으면 **컴포넌트 자체를 마운트하지 않는다**.
- 세기가 0인 광원과 판은 `visible=false`로 셰이더와 그림자 비용을 뺀다.
- 벽 opacity는 변화가 있을 때만 traverse하고, `transparent`를 미리 켜 재컴파일 스파이크를 막는다.
- emissive 틴트에 `needsUpdate`를 걸지 않는다.
- 파티클은 GPU 시간 함수라 CPU 비용이 uniform 갱신뿐이다.
- StrictMode 대응: useMemo 안에서 ref를 세팅하지 않고 반환값에 담는다. 리그 액션은 다시 얻는다.
- 직접 만든 텍스처, 재질, RT, Pass는 cleanup에서 dispose한다. useGLTF 캐시 소유 자원은 건드리지 않는다.
- Canvas 2D 효과(디졸브, 모프)는 30fps로 제한하고 작은 버퍼(128~320px)를 늘려 쓴다.
- SSR과 hydration 일치: 결정적 해시 난수를 쓰고, 값은 자릿수를 끊은 문자열로 넘긴다.
- jsdom 방어: 2D 컨텍스트 스텁 검사, 팔레트 토큰 FALLBACK.

---

## 24. 부록: 코드와 문서가 어긋난 곳

조사 중에 발견한 것들이다. 주석·문서만 틀렸던 것은 코드에 맞춰 고쳤다. 남은 것은 동작을 바꿔야 하는 일이라 고칠지는 따로 판단하면 된다.

### 남은 것 (동작)

1. 방문만 애니메이션 없이 즉시 열린다. 다른 문은 approach로 젖혀진다.
2. `ampoule-pickup`은 레지스트리에만 있고 콘텐츠에서는 쓰지 않는다. 지우려면 "기억 조사 중 canvas 미니게임" 경로(MinigameHost·active 테스트가 이걸로 지킨다)와 앰플 굴절(`Ampoule.tsx` `refractive`)을 남길지 먼저 정해야 한다.
3. photo-wipe에는 키보드 경로가 없다. 키보드 사용자는 스킵이 뜰 때까지 기다려야 끝낼 수 있다.
4. `visual-experiments.md` 13장에 따르면 등불 세기, 틸트 띠 폭, 물때 대비, PerformanceMonitor 문턱은 아직 실기기에서 확인하지 않았다.

### 고친 것 (주석·문서를 코드에 맞춤)

- `walk-to.ts` 머리 주석: "경로 탐색은 없다" → 길은 `pathfind.ts`의 A*가 찾고 여기는 경유점을 따라가는 한 걸음.
- 악보 잉크(`visual-experiments.md` 11장): "미리 구운 프레임을 역재생" → 매 프레임 blur로 다시 칠한다.
- `RoomClues.tsx`의 거울 주석: "1인칭에서만 비춘다" → 늘 비추고 3인칭은 두 프레임에 한 번.
- `dot-screen.ts`·`DotReflection.tsx`: 옛 TV(`TvReflection.tsx`)·거실 언급 → 책상 모니터(`DotReflection.tsx`)·방.
- `minigames/index.ts`: ampoule-pickup의 "유일한 canvas 모드" → piano-melody와 둘.
- `PuzzleHost` 주석: 없는 퍼즐(식탁 트럼프, 현관 잠금) → 피아노·세면대 하부장 다이얼.
- DESIGN.md 커서 링: "버튼을 알약으로 감싼다" → 손 자리에서 0.7배로 조여든다.
- DESIGN.md·`visual-experiments.md` 시점 전환: "노이즈 타일 응결" → backdrop blur 초점 맞춤.
- DESIGN.md 키보드 규칙의 "숫자 = 선택지": 선택지 UI가 없어서 "선택지 UI를 만들면"으로 조건을 달았다.

### 고친 것 (코드)

- `OuterDrift`: color·pixelRatio 갱신을 머티리얼의 uniform에 직접 쓴다. 예전에는 pixelRatio가 DPR이 바뀌어도 반영되지 않았다.
- `MemoryBurst`: 두 useEffect에 의존성 배열을 달았다 (매 렌더 실행하던 것만 사라지고 결과는 같다).
- 죽은 CSS: `bat-swing`·`duel-combo`·`duel-alert` 애니메이션과 reduced-motion의 `page-flip-next/-prev`.
- 죽은 코드: `LoadingOverlay.tsx`, `ROOM_STAGES`, 안 쓰는 셀렉터 다섯(`selectStoryPhase`·`selectGamePhase`·`selectShelfHintRead`·`selectTimeGapNoticed`·`selectMomCardRead`), `PHASE1_GOAL`, `phaseTwoCount`, `ATTACKS_ORDER`, `BatIcon`, fighter-duel의 `FRAME_SIZE`·`preloadSpriteSheet`, 안 쓰는 `howler` 패키지.
- `redaction.ts`는 lab 페이지가 쓰므로 남긴다.
