# 시각 실험 레이어: 스펙 검토와 코드 매핑

> 2026-09-22. "기억의 방 · 시각 실험 레이어 스펙"(외부 초안)을 지금 코드에 붙일 수 있는지
> 항목별로 검토하고, 붙일 자리·바인딩·잘라낼 것을 정리했다. **스토리와 기획은 코드가
> 우선**이다(`story.md`, `content-design.md`). 스펙이 코드와 어긋나는 자리는 코드 쪽으로
> 옮겨 적었고, 옮기기 어려운 것은 잘라냈다.
>
> 이 문서는 시각 효과의 **실험 계획**이다. 확정된 디자인 규칙은 `DESIGN.md`, 게임플레이는
> `content-design.md`가 단일 소스다. 실험이 확정되면 그쪽으로 옮긴다.

---

## 0. 한 줄 결론

스펙의 **재질 규칙**("기억은 매체마다 질감이 다르고, 흩어진 것이 모인다")은 그대로 쓸 수
있다. 다만 스펙이 딛고 선 전제 넷은 코드와 다르다.

| 스펙의 전제 | 코드의 현실 | 처리 |
|---|---|---|
| 2-Phase, 방 하나, 조사 오브젝트 8개 | **3막**, 공간 넷(방·거실·화장실·안방), 기억 13개 (`content/memories.yaml`) | 스펙의 8개는 전부 1막 방에 있다. 거실 기억(냉장고·가방·신발장·트럼프·앰플)은 이번 레이어에서 다루지 않는다 |
| "미니게임 대신 클릭 → 줌인 → 회상" | 미니게임 13개가 핵심 인터랙션이고 기획상 의미가 있다 (1막 미니게임 = 외면의 체험) | **미니게임을 유지**하고 효과를 그 안(오버레이 DOM·Canvas 2D)이나 3D 방에 얹는다 |
| 상태 축 `loop`, `roomLight` | `gamePhase(1\|2)`·`act(1\|2\|3)`, `roomLightLevel()`·`roomLightMix{cool,warm}`·`dim` (`visual-state.ts`) | 아래 1장 표 |
| GSAP · Framer Motion · Web Audio 열화값을 밖으로 꺼내기 | 둘 다 의존성에 없다. 열화값은 밝기의 **순수 함수**라 이미 밖에 있다 (`music-curve.ts`) | 새 라이브러리 없이 `MathUtils.damp`·CSS·순수 함수로 간다 |

이미 코드에 있는 효과가 많다(2장). 스펙 5·6장의 절반은 "새로 만들기"가 아니라
"있는 것에 바인딩 하나 더하기"다.

---

## 1. 바인딩 축: 스펙 용어 → 코드

효과는 새 상태를 만들지 않고 아래 값에만 묶는다 (스펙 2장 원칙 1과 같다).

| 스펙 | 코드 | 어디서 읽나 |
|---|---|---|
| `loop` (1차/2차) | `gamePhase` (조사 차수) 또는 `act` (막). 미니게임에는 이미 `gamePhase` prop이 내려간다 (`src/types/minigame.ts`) | `gamePhaseOf(state)`, `selectAct` |
| `roomLight` | `roomLightLevel({collected, memoryTotal, recovery})` 0~1. 진입 0.62 → 1막 완주 0 → 2막 완주 1 | `MemoryRoomScene`, `MemoryRoom`이 계산해 이미 들고 있다 |
| 밝기의 두 축 | `roomLightMix` → `cool`(간접광, 1막에 깎임) · `warm`(창빛, 2막 회복도) | 조명·창빛·먼지가 이 둘을 본다 |
| "어둠의 양" | `dim = 1 - lampScaled(level, lightsOn, blackout)`. 비네트·색수차가 이 축을 탄다 | `MemoryRoomScene` → `MemoryGlowRoot dim` |
| 조사 진행도 | 1막 `collected.length / MEMORY_TOTAL`, 2막 `actTwoProgress` (필수 체인만) | `selectCollectedCount`, `selectActTwoProgress` |
| 오디오 열화값 | `musicCutoff(level)`·`musicReverb(level)`·`musicVolume(level)`. **밝기의 순수 함수**라 시각 쪽이 같은 함수를 부르면 같은 값이다 | `@/lib/audio`가 export |
| 사건 (수집·라디오 각성) | `subscribeEventPulse` (0~1 세기) | `event-pulse.ts` |
| 커서 | r3f `state.pointer`(NDC), `cursorTarget`(호버 오브젝트의 화면 좌표) | `DustMotes`가 이미 커서를 민다 |
| 커튼 열림 | `curtainPull.left/right` (0~1, 양쪽 따로) | `RoomCanvas` 상태 |
| 튜닝 거리 | `staticLevel(position, bandLeft, bandWidth)` (`frequency-tune/difficulty.ts`) | 라디오 미니게임 안 |

스펙 8장의 2단계("오디오 열화값을 밖으로 빼서 포스트프로세싱에 연결, 이 연결이 이후
모든 효과의 기준")는 **이미 있다**: `heardLevel`(MemoryRoom) 하나가 조명·비네트·색수차·BGM에
같이 들어간다. 새 효과는 같은 값을 받으면 된다.

---

## 2. 이미 있는 것 (재사용)

| 있는 것 | 자리 | 스펙의 어느 항목을 덮나 |
|---|---|---|
| EffectComposer: N8AO → 색수차 → 아웃라인 2 → 그레인 → 화면 전환(찢김·타들어감) | `MemoryOutlineGlow.tsx`, `FilmLook.tsx`, `ScreenTransition.tsx` | 라디오 grain·aberration의 **바탕**. 새 패스는 여기에 끼운다 |
| 색수차·그레인이 `dim`을 따르고 사건에 한 번 튄다 | `film-look.ts` (순수 함수 + 테스트) | 5장 "베이스 grain ← 오디오 열화값" |
| 창빛 광선 판 (커튼 틈에서 양옆으로 열림, `warm` 바인딩) | `WindowLight.tsx` | 5장 "커튼 틈 볼류메트릭 라이트" |
| 먼지 (커서가 밀어내고 돌아옴, `warm × 커튼` 바인딩) | `DustMotes.tsx` | 5장 "먼지 파티클 + 잔상"의 절반 |
| 기억 수집 순간의 금빛 티끌 | `MemoryBurst.tsx` | 입자 재질의 선례 |
| 거울의 실시간 반사 (Reflector, 2프레임에 1번) | `MirrorReflection.tsx` | RTT의 선례와 비용 기준 |
| 창밖 붕괴도 (단조 증가, 되돌아가지 않음) | `outsideDecay()` | 창문 항목의 바인딩 |
| 1인칭 두 구간의 어둠·비네트·전환 덮개 | `viewpointOf`, `ViewpointTransition`, `.viewpoint-lamp` | 6장 인트로 전환의 자리 |
| 컷씬 시작의 신호 끊김 찢기 | `ScreenTransition` tear | 6장 1→2 전환의 짝 |
| 라디오가 저 혼자 깜빡이는 세기 | `radioSignalLevel(t)` | 라디오 2차의 바탕 |
| 성능 안전장치 (프레임 떨어지면 DPR 상한 1로) | `PerformanceMonitor` in `RoomCanvas` | `enabled` 게이트의 재료 |
| 모션 끈 사람 대응 | `prefersReducedMotion()` 한 곳, FilmLook이 그레인 패스를 아예 안 만든다 | `enabled=false` 폴백의 선례 |
| 개발 전용 라우트 (`*.dev.tsx`) | `src/app/lab/page.dev.tsx` | 단독 데모 페이지의 자리 |
| 미니게임 3구간 대사 (진입 · 게임 · 결과) | `content/memories.yaml`의 `script`·`minigame`·`resultScript` | 스펙 2장 원칙 6 그대로 |

---

## 3. 지켜야 할 제약

효과를 고를 때 스펙보다 먼저 서는 규칙들. 어긋나는 스펙 항목은 4~8장에서 조정했다.

- **번쩍임 금지** (`DESIGN.md > Accessibility`): 초당 3회 넘는 밝기 변화 없음. "TV 정지 화면식
  static · RGB 노이즈 · 픽셀 블록 노이즈처럼 프레임마다 크게 바뀌는 질감"은 쓰지 않는다.
  → 라디오 "방 조명 flicker" 불가, 화면 grain은 상한을 낮게 잡는다.
- **상시 펄스·반복 glow 금지** (`DESIGN.md > Motion`). 사건 반응은 한 번, 1초 안에 잦아든다.
- **어둠은 씬 조명이 만든다.** 화면 위 검정 오버레이로 어둡게 하지 않는다 (`DESIGN.md > Texture`).
  → "커서 손전등"을 화면 공간 마스크로 만들면 이 규칙에 걸린다. 진짜 광원으로 간다.
- **hover만으로 기능 제공 금지**, 모든 인터랙션은 키보드로도 (`DESIGN.md > Accessibility`).
- **대사 텍스트에 마크업 금지**, 표현이 필요하면 스키마를 먼저 확장 (`.claude/rules/visual-novel.md`).
  → 글자 단위 효과는 대사창이 아니라 혼잣말(Monologue)에서만, 문장 전체에 같은 규칙으로.
- **useFrame 안 setState 금지, 루프 안 객체 생성 금지, uniforms는 머티리얼의 것을 만진다**
  (`.claude/rules/r3f.md`). 기존 효과들이 전부 이 문법이다.
- **에셋은 사용자가 넣는다.** 텍스처 2MB·2의 제곱 크기, 코드에서 경로는 `src/lib/assets.ts`
  (`.claude/rules/assets.md`). 텍스처가 있는 glb에는 색을 곱하지 않는다.
- **해는 그리지 않는다.** 창밖은 색으로만 노을을 말한다 (`content-design.md` 5장).
- **커튼이 열리면 볕이 든다.** 2막의 회복은 창으로 드는 따뜻한 빛이다 (`ROOM_LIGHT_RAMP.sun`,
  `CURTAIN_SUN_FACTOR`). 스펙의 "커튼 열림 → 방 노출 감소"는 이 축을 뒤집으므로 채택하지 않는다.
- **문서·UI 텍스트에 전각 대시(—) 금지.** 쉼표·콜론·괄호로 대체 (스펙 2장 원칙 7, 이 문서부터 적용).

---

## 4. 조사 오브젝트 · 기억의 재질

판정: ✅ 붙일 수 있다 · 🔶 자리·형태를 바꿔서 붙인다 · ❌ 잘라낸다(11장).

| 오브젝트 | 지금 코드 | 스펙의 효과 | 판정 | 붙이는 자리와 형태 | 바인딩 |
|---|---|---|---|---|---|
| **사인볼+글러브** | `ball-catch`: 노을 들판 그림 위에서 날아오는 공을 치는 타이밍 게임 (오버레이). 2차는 대사만 | 벽 파문 + 잉크 사인 dissolve | 🔶 | 벽에 던지는 게임이 아니라 파문의 자리를 **필드 캔버스**로 옮긴다: 맞는 순간 타점에서 잉크 파문이 번지고, 라운드가 갈수록 감쇠가 빨라진다. Canvas 2D 링 + 알파, GPU fluid 없음 | 감쇠율 ← `musicCutoff(level)`을 0~1로 정규화. 2차 시각은 자리가 없다(대사만): 생략 |
| **게임기** | `fighter-duel`: 실시간 격투, 스프라이트 시트 DOM (`Fighter.tsx`) | 픽셀 블록 커짐 + 디더 + 2P `PRESS START` | 🔶 | 무대 컨테이너를 `1/block` 해상도로 그려 `image-rendering: pixelated`로 키운다 (CSS만). 디더는 뺀다(프레임마다 바뀌는 질감). 2P 슬롯 `PRESS START`는 1Hz 이하 깜빡임으로 HUD에 한 줄 | 블록 크기 ← `collected.length` (1막 진행도), 판이 열릴 때 한 번 정해 고정. 2차(대사만)는 표시할 화면이 없다: 생략 |
| **달력+벽 메모** | `calendar-flip`: DOM 격자(`MonthGrid`) + 正자 장(`TallySheet`, 픽셀 글리프 span). 2차 없음 (스펙과 일치) | 숫자 glyph → 正 획 morph, `stroke-dashoffset` | 🔶 | 正자를 SVG 5획으로 바꾸고 장을 넘길 때 획이 **그어진다**(dashoffset). 숫자 → 획 morph는 뺀다(flubber 새 의존성, 폰트 path 필요). 마지막 正의 미완 획은 이미 `tallyGroups(days).remainder`가 준다 | 미완 획 수 = 버틴 날의 나머지 (`survivedDays`), 진행도가 아니라 **날짜**에 묶인다. "엔딩 직전 한 획 추가"는 엔딩에 달력이 안 보여 생략 |
| **스마트폰** | `phone-chat`(1차, 스크롤로 메시지 펼침) · `phone-lock`(2차). DOM, `presentation: "bare"`라 캔버스가 뒤에 보인다 | RTT 반사 + 최근 메시지일수록 블러 + 미전송 입력창 커서 | ✅ | 반사는 RTT 없이 **`backdrop-filter: blur()`** 유리로: 폰이 캔버스 위에 떠 있어 방이 그대로 비친다. 말풍선 블러는 index → `filter: blur(px)`. 미전송 초안은 `thread.ts`에 한 줄 추가(ko/en/ja) + 1Hz 캐럿. "스크롤 멈추면 채팅 사라짐"은 뺀다(읽는 화면이다) | 블러 기울기 ← `dim`. `phone-lock`(2차)에는 얹지 않는다 |
| **창문+커튼** | 3D 커튼 양쪽 드래그(`CurtainCloth`, 관성)·창밖 배경막(`WindowView`, `outsideDecay`)·들여다보기(`window-view`, 돋보기 3자리) | 실금 normal map + 굴절, 바깥 3~4층 패럴랙스, 커튼 열림 → 노출 감소 | 🔶 | 노출 반전은 채택하지 않는다(3장). **유리의 실금**만: 배경막 앞 유리 판에 금을 그리는 셰이더(프로시저럴 Voronoi, 에셋 없음). 굴절 패스는 직교 아이소메트릭에서 창이 작아 비용 대비 안 보인다: 뺀다. 패럴랙스는 배경막을 2층(하늘·도시 실루엣)으로 갈라 궤도 회전(±0.32rad)에 깊이 오프셋 | 금의 길이·수 ← `outsideDecay` (알게 된 것은 되돌아가지 않는다) |
| **가족사진 액자** | `photo-wipe`(1차, Canvas 2D 프로스트를 헝겊으로 닦음, `revealed` 뒤 `SuccessBurst`) · `photo-puzzle`(2차, 3×3 슬라이드). 1차 사진 에셋 자체가 부모 얼굴을 그늘에 묻어 둔다 | 사진 = point cloud, 커서 반경 curl noise, 정지 시 spring 복귀, 1차는 얼굴 spring 0 | 🔶 | 미니게임을 대체하지 않고 **`revealed` 구간**(닦기 끝 → 결과 대사 전)에 얹는다: 다 닦인 사진이 입자로 풀려 커서를 피하고 손이 멈추면 모인다. 1차는 얼굴 영역(코드의 정규화 사각형, 마스크 에셋 없음)이 안 모이고, 2차 `photo-puzzle`은 맞춘 순간 같은 입자가 **얼굴까지** 모인다. Canvas 2D, 4~6k 입자, `enabled=false`면 지금 그대로 | 얼굴 spring ← `gamePhase`. 커서는 미니게임 컨테이너의 pointer |
| **라디오** | `radio-quiz` = `frequency-tune`(바늘·대역, `staticLevel`로 잡음 바닥 계산, `NoiseBed`) → 글자 맞추기. 2차는 대사만, 라디오 모델이 `radioSignalLevel`로 깜빡인다 | 튜닝 거리 ← 화면 grain·aberration, 조명 flicker, 다이얼 위 파형 캔버스 | 🔶 | **DOM → 컴포저 채널** 하나를 만든다(`film-look-input.ts`, 모듈 스코프 값, `event-pulse`와 같은 문법). 미니게임이 매 프레임 `staticLevel`을 써넣고 `FilmLookDriver`가 읽는다. 상한: 그레인 2×`FILM_GRAIN_OPACITY`, 색수차 `ABERRATION.pulse`. 조명 flicker는 없다(3장). 파형: `startNoiseBed`에 `AnalyserNode` 탭 옵션을 붙여 표시창에 Canvas 2D 파형 | 강도 ← 튜닝 거리(`staticLevel`). 맞추면 1막 완주 = `level` 0이라 "roomLight 한 단계 감소"는 이미 일어난다. 2차 "다른 색 파형"은 표시할 화면이 없다: 3D 라디오의 깜빡임 색을 `warm`으로 데우는 정도로 대체 |
| **배트 (엔딩)** | `EndingTrigger` → `CUTSCENE_BAT_GRIP` → `takeBat` → `endingStarted` → 문 열림 1.8초 → 타들어감(`ScreenTransition burn`) → 엔딩 카드. **문까지 걸어가는 구간이 없다** | 잡으면 afterimage 누적, 문 열림에 grain·aberration·afterimage 0으로 수렴 | 🔶 | afterimage는 누적할 이동 구간이 없고 feedback RT 패스를 새로 짜야 한다: 뺀다. **"처음으로 깨끗해지는 화면"만** 한다: `endingStarted`에 `FilmLookDriver`가 색수차·그레인을 0으로 damp. 타들어감과 같은 1.5초 | 수렴 ← `endingStarted` (스토어), 별도 진행도 없음 |

미니게임 안의 효과는 전부 `enabled`(9장) false에서 지금 화면 그대로가 폴백이다.
새 조작 안내가 필요한 것은 없다: 액자 입자(커서를 피한다)와 폰 블러는 조작이 아니라 반응이다.
진입 대사를 고쳐야 하면 `content/scripts.yaml`(ko/en/ja) → `pnpm content:build`.

---

## 5. 배경 오브젝트 · 시간의 재질

| 오브젝트 | 지금 코드 | 스펙 | 판정 | 처리 | 바인딩 |
|---|---|---|---|---|---|
| **컵라면 용기** | `StudentProps`의 `cupNoodleTrash` glb 둘 (텍스처 있음) | Gray-Scott reaction-diffusion ping-pong RT → map | 🔶 | 기법은 싸다: 128² RT 둘, **밝기가 바뀔 때만 N스텝 돌리고 멈춘다**(매 프레임 시뮬레이션 불필요). 문제는 크기다: 아이소메트릭에서 용기는 수십 px다. 먼저 **가시성 테스트**(데모 페이지에서 실제 카메라 배율로). 안 읽히면 같은 패턴을 용기 옆 벽의 얼룩(더 큰 면)으로 옮긴다. 텍스처 glb에 색을 곱지 않으므로 map 자체를 교체한 클론 머티리얼을 쓴다 | 성장량 ← `1 - level` |
| **시계** | `DeskClock`: 코드로 그린 탁상시계, 20:47에 멈춤, `angle-turn`의 규칙 단서(각도를 읽어야 한다) | slit-scan (프레임 히스토리 링버퍼) | ❌ → 🔶 | 전체 화면 히스토리 RT N장은 모바일 예산 밖이고, 각도를 읽는 단서 위에 시간차 왜곡을 얹으면 단서가 죽는다. 대신 기획이 이미 띄워 둔 안("초침 재가동")을 쓴다: **2막부터 초침이 다시 간다**. 멈춘 시계가 유일하게 시간이 흐르는 물건이 된다 | 초침 ← `act >= 2` |
| **컴퓨터** | 1막 내내 꺼진 채(배경), 2막 `computer-browse` 오버레이에서 부팅 | 모니터에 방을 ASCII로 실시간 RTT | ❌ | 씬을 한 번 더 그리는 패스(거울과 같은 비용)인데 1막의 컴퓨터는 **꺼져 있는 것**이 이야기다. 켜진 화면은 스토리에 어긋난다. 2막 조사 뒤 모니터에 정지 ASCII 한 장(CanvasTexture)을 남기는 안은 남겨 둔다 | (없음) |
| **침대** | `BedModel`, 이불 shape key, 앉기·눕기 없음 | 이불 vertex 노이즈 호흡 + 조사 순간 DOF | 🔶 | 호흡은 `onBeforeCompile`로 이불 머티리얼의 정점 셰이더에 노이즈 한 줄(진폭 작게, 0.3Hz 이하). DOF는 뺀다: 침대는 조사 오브젝트가 아니고(혼잣말만), 직교 카메라에 `DepthOfField`는 잘 안 맞는다. 디오라마 초점은 6장의 틸트 시프트가 맡는다 | 진폭 고정, `reducedMotion`이면 0 |

---

## 6. 방 전체 · 공간의 재질

| 기법 | 지금 코드 | 판정 | 처리 | 바인딩 |
|---|---|---|---|---|
| **커서 손전등** | 인트로 1인칭에 화면 가운데만 남기는 비네트가 이미 있다. 바닥 평면 레이캐스트(`FLOOR_PLANE`)도 있다 | 🔶 | 화면 공간 마스크는 "어둠은 조명이 만든다"에 걸린다(3장). **진짜 PointLight**로: 마우스는 커서가 바닥 평면에 닿는 자리, 터치는 커서가 없으니 **플레이어 몸에 붙인 등**(같은 광원, 위치만 다르다). 1인칭 구간(`viewpoint !== null`)에는 끈다: 그 구간은 "빛 하나만" 보여야 한다 | 닿는 거리 ← `level` (어두울수록 좁다), `level > 0.35`면 세기 0. 스펙의 0.6은 진입(0.62)에서 첫 조사 직후 켜져 버린다 |
| **틸트 시프트 DOF** | 없음. 직교 카메라 디오라마 | ✅ | `@react-three/postprocessing`의 `TiltShift2` 한 패스. 아웃라인 outer처럼 해상도 0.5로. `PerformanceMonitor`가 내려가면 끈다 | 강도 ← `act` (1막 강, 2막부터 약: 공간이 넷으로 늘고 걸어 다니는 시간이 길다) |
| **커튼 틈 볼류메트릭** | `WindowLight` 광선 판이 이미 `warm`·커튼 열림을 탄다 | ✅ (있음) | `GodRays`는 광원 메시가 필요한데 해는 그리지 않는다(3장). 지금 판을 그대로 쓰고 필요하면 결(noise) 한 겹만 더 | (이미 `warm × 커튼`) |
| **먼지 + 잔상** | `DustMotes`가 커서를 밀어내고 돌아온다 | ✅ (확장) | 화면 공간 먼지 텍스처·궤적 RT를 새로 만들지 않는다. 돌아오는 속도(`POINTER_LAMBDA`의 짝)를 밝기에 물린다: 어두울수록 **천천히 다시 쌓인다** | 재적층 속도 ← `1 - level` |

---

## 7. 전환 · 재구성의 재질

| 시점 | 지금 코드 | 판정 | 처리 |
|---|---|---|---|
| **인트로 → 방** | 부팅 커튼 → 타이틀 → 1인칭 어둠에서 스위치를 찾아 켬 → `.viewpoint-lamp` 덮개 1.3초 | ✅ | 스위치를 켜는 순간의 덮개에 SVG `feTurbulence` 정지 타일을 얹어 opacity 1→0 (노이즈 속에서 방이 응결). 타일은 정지, 투명도만 움직인다(번쩍임 아님). `reducedMotion`이면 지금처럼 어둠(void)으로만 |
| **1막 → 2막** | 컷씬 시작에 신호 끊김 찢기(`tear`). 방문 열림은 1인칭 "어둠 속 빛 하나" 구간 | 🔶 | 스펙은 "라디오 목소리 직후"에 와이어프레임 → 채움. 코드에서 그 자리는 **전환 컷씬이 끝나 3D로 돌아오는 순간**(라디오 재점화)이다. 그때 모든 머티리얼 `wireframe` on → 1초 안에 dissolve로 채운다(`tear`의 짝). 방문 열림(1인칭 금빛)에는 얹지 않는다: 그 구간의 그림은 이미 정해져 있다 |
| **회상 컷 간** | `PlaybackScene`이 컷을 바꾼다(opacity 700ms) | ✅ | Canvas 2D 노이즈 threshold dissolve 600ms(30fps로 충분). 노이즈 셋(종이 섬유·필름 그레인·물 얼룩)은 `feTurbulence` 변형 세 장을 한 번 구워 재사용. 2D 재생 화면의 "기록물의 결"(`DESIGN.md > Texture`)과 같은 재질이라 맞다 |

---

## 8. 텍스트 · 말의 재질

| 대상 | 지금 코드 | 판정 | 처리 |
|---|---|---|---|
| 혼잣말 1막 (말끝이 흐려지며 떨어짐) · 2막 (아래에서 모임) | `Monologue`: 타자기 출력, 단계가 바뀌면 300ms opacity로 물러난다 | ✅ | **물러나는 쪽만** 글자 단위로: 1막은 뒤 N글자가 순서대로 y+·opacity 0, 2막은 반대. Framer Motion 없이 CSS 애니메이션 + `animation-delay`. 등장(타자기)은 그대로. 예산은 `DESIGN.md > Motion`의 독백 전환 250~350ms |
| 기억 안 나는 대목 (깨진 글리프, hover 복원) | 없음 | ❌ | hover만으로 정보를 주는 것은 접근성 규칙에 걸리고, 어느 글자를 깨뜨릴지는 대사 텍스트에 마크업이 필요하다(스키마 확장 선행). ko/en/ja 셋에서 같은 자리를 깨는 규칙도 없다. 스키마 논의 뒤로 미룬다 |
| 기억 수집 UI 라이브 렌더 | 수첩은 종이 재질, 다시보기는 `replayStill` 정지 그림 | ❌ | 종이 위에 살아 움직이는 WebGL 썸네일은 재질 규칙(종이 = 기록)에 어긋나고, 캔버스 수 상한 문제(스펙 10장)도 생긴다. `replayStill`이 이 자리를 맡는다 |

---

## 9. 구조: 어디에 두고 어떻게 끄나

**폴더.** 스펙의 `src/experiments/<name>/`을 그대로 만들지 않는다. 아키텍처 규칙상 Canvas
안 컴포넌트는 `src/components/canvas/`·`src/scenes/`, 오버레이는 `src/components/ui/`·
`src/minigames/<id>/`에 산다.

- 3D 효과(등·틸트 시프트·유리 금·이불 호흡·컵라면 RD·와이어프레임 전환): `src/scenes/memory-room/`
  에 기존 효과들(`DustMotes`, `WindowLight`, `FilmLook`)과 나란히. 수치·곡선은 `*.ts` 순수 모듈 +
  `*.test.ts` (기존 관례: `film-look.ts`, `radio-signal.ts`, `event-pulse.ts`).
- 미니게임 안의 효과(파문·픽셀·正 획·폰 유리·액자 입자·라디오 파형): 그 미니게임 폴더 안에.
- 여러 곳이 같이 쓰는 것(DOM → 컴포저 채널, 노이즈 타일, `enabled` 게이트): `src/lib/effects/`.
- **단독 데모 페이지**: `src/app/lab/<name>/page.dev.tsx`. `*.dev.tsx`는 dev 서버에서만 라우트가
  되고 프로덕션 빌드에는 없다(`next.config.ts`). 슬라이더(`intensity`)와
  토글(`gamePhase`, `enabled`)만 있는 얇은 페이지.

**`enabled` 게이트는 한 곳.** 미니게임 스킵이 `useSkipEligible` 한 곳인 것과 같은 이유다.
`src/lib/effects/effect-budget.ts`:

```
tier = "off"  if prefersReducedMotion
     | "low"  if PerformanceMonitor가 내려갔거나(dprCap === 1) 포인터가 touch
     | "full" otherwise
```

각 효과는 `intensity`(0~1)와 `enabled` prop을 받되, 값은 호출부가 이 게이트에서 꺼내 준다.
효과 컴포넌트가 스토어를 직접 읽지 않는다(미니게임 계약과 같다). `enabled=false`의 폴백은
**지금 화면 그대로**다: 새 정적 폴백을 따로 그리지 않는다.

**바인딩은 순수 함수로.** `level → 값` 곡선은 `film-look.ts`처럼 브라우저 없이 테스트한다.
useFrame은 그 함수를 부르고 uniform 하나를 만진다.

---

## 10. 다시 짠 구현 순서

스펙 8장의 순서를 코드 기준으로 다시 세운다. 앞쪽이 싸고 기준이 되는 것들이다.

1. **게이트와 채널** (`effect-budget.ts`, `film-look-input.ts`). 이후 전부가 이 둘에 기댄다.
2. **라디오**: `staticLevel` → 채널 → 색수차·그레인 상한 안에서 반응, 표시창 파형. DOM에서
   컴포저로 값이 흐르는 첫 사례.
3. **등** (커서 손전등의 대체): PointLight 하나, 바닥 레이캐스트, 터치는 몸에.
4. **스마트폰**: `backdrop-filter` 유리, 말풍선 블러 기울기, 미전송 초안(ko/en/ja).
5. **달력**: 正 SVG 5획 그어짐.
6. **혼잣말** 글자 단위 퇴장 (1막 떨어짐 · 2막 모임).
7. **액자**: `revealed` 구간의 입자 (1차 얼굴 안 모임 · 2차 모임). 재질 규칙의 시험대라 여기서
   한 번 사용자 검증(11장 아래 검증 절).
8. **사인볼** 필드 파문.
9. **틸트 시프트** (프레임 측정 뒤 채택 여부 결정).
10. **컵라면 RD** (가시성 테스트 먼저).
11. **전환 셋**: 라디오 재점화의 와이어프레임 재구성 · 스위치 켤 때의 노이즈 응결 · 컷 dissolve.
12. **게임기** 픽셀화, **창문** 실금, **침대** 호흡, **시계** 초침, **엔딩** 깨끗한 화면.

완료 기준(스펙 8장)을 코드로 옮기면:

- `src/app/lab/<name>/page.dev.tsx`에서 `intensity` 슬라이더와 `gamePhase` 토글로 1차/2차 차이가 보인다.
- 씬에 붙였을 때 `level`(또는 `dim`·`warm`)이 바뀌면 damp로 따라간다 (조명과 같은 호흡, `LIGHT_LAMBDA`).
- `enabled=false`에서 기존 화면 그대로고, `pnpm test`·`pnpm typecheck`·`pnpm build`가 통과한다.
- 곡선은 순수 함수와 테스트로 남는다.
- 조작이 있으면 진입 대사 한 줄이 `content/scripts.yaml`에 있다(지금 계획에는 새 조작이 없다).

---

## 11. 잘라낸 것과 이유

| 항목 | 이유 |
|---|---|
| 미니게임 → "클릭·줌인·회상" 전환 | 미니게임이 기획의 핵심(1막 외면의 체험, 2막 직면). 코드 우선 |
| 커튼 열림 → 방 노출 감소 | 2막 회복 = 창으로 드는 볕. 밝기 축을 뒤집는다 |
| 라디오의 방 조명 flicker, 화면 static | 번쩍임 금지 규칙 |
| 게임기 디더 | 프레임마다 바뀌는 질감 금지 |
| 달력 숫자 → 획 morph | 새 의존성(flubber)과 폰트 path 필요. 획 그어짐만으로 같은 문장을 말한다 |
| 창문 굴절 패스, GPU fluid, GodRays | 직교 아이소메트릭에서 비용 대비 안 보인다 / 광원 메시 없음(해 없음) |
| 시계 slit-scan | 히스토리 RT 비용, 각도 단서를 가린다 |
| 컴퓨터 ASCII 실시간 | 1막의 컴퓨터는 꺼져 있는 것이 이야기 |
| 침대 DOF | 조사 오브젝트가 아니고 직교 카메라에 맞지 않는다 |
| 배트 afterimage | 누적할 이동 구간이 없다. "깨끗해지는 화면"만 남긴다 |
| 깨진 글리프 hover 복원 | hover 전용 기능 금지, 대사 마크업 금지(스키마 선행) |
| 기억 UI 라이브 WebGL 썸네일 | 종이 재질과 어긋나고 컨텍스트 수 상한 |
| GSAP · Framer Motion 도입 | 기존 문법(damp·CSS·순수 함수)으로 전부 된다 |

**검증(스펙 9장).** 라디오·액자·컵라면 셋을 붙인 빌드로 묻는다: "왜 오브젝트마다 느낌이
달랐어?" 컵라면은 대사가 재질을 설명하지 않는 유일한 항목이라 가시성이 먼저 확보돼야
시험대가 된다(5장).

---

## 12. 사용자가 정해야 하는 것

- **액자 얼굴 영역**: 사진 위 정규화 사각형을 코드에 둘지(에셋 없음), 알파 마스크 이미지를
  넣을지. 코드 사각형을 기본으로 잡았다.
- **컵라면 자리**: 용기 자체(작다) vs 옆 벽의 얼룩(크다). 가시성 테스트 결과로.
- **등의 켜지는 문턱**: `level < 0.35`(라디오 직전 두 개쯤 남았을 때)로 잡았다. 더 이르게 켜면
  1막 중반부터 방이 등 하나에 의존한다.
- **틸트 시프트 채택**: 모바일 프레임 측정 뒤.
- **폰 미전송 초안의 문장** (ko/en/ja): 누구에게, 무슨 말을 쓰다 멈췄는가. 대본이라 YAML이 아니라
  `phone-chat/thread.ts`의 i18n 키에 들어간다.
