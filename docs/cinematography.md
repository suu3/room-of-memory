# 연출 지도: 어디에 무엇이 쓰였나

> 2026-09-26. 게임 전반의 연출(카메라 · 조명 · 포스트프로세싱 · 전환 · 사운드 · UI 모션)을
> **이야기 순서**로 정리한 지도다. 각 항목은 코드의 주석과 상수에서 옮겨 적었다.
> 효과 하나하나의 실험 기록은 [`visual-experiments.md`](visual-experiments.md), 페이즈 표는
> [`v4.md`](v4.md), 서사는 [`story.md`](story.md). 이 문서는 "지금 게임에서 어느 순간에
> 무엇이 보이고 들리는가"만 답한다. 새로 넣은 영화 연출 셋은 **[신규]**로 표시했다.

---

## 0. 먼저 알아둘 것: 모든 연출이 물리는 축

연출은 새 상태를 만들지 않는다. 아래 몇 개의 값에만 묶인다 (`visual-experiments.md` 1장 원칙).

| 축 | 뜻 | 어디서 |
|---|---|---|
| `level` | 방의 밝기 0~1. **V자**: 진입 0.62 → 1막 완주 0(가장 어둡다) → 2막 완주 1 | `visual-state.ts` `roomLightLevel` |
| `cool` / `warm` | 차가운 간접광(1막에 깎인다) / 창으로 드는 볕(2막 회복도를 그대로 따른다) | `visual-state.ts` `roomLightMix` |
| `dim` | 어둠의 양. 비네트와 색수차가 같은 값을 본다 | `MemoryRoomScene.tsx` |
| `heardLevel` | 전등 스위치까지 반영한 밝기. BGM 곡선과 DOM 비네트가 같이 쓴다 | `MemoryRoom.tsx` |
| event pulse | 사건의 세기. 기억 수집 0.6, 라디오 각성 1.0. 색수차·그레인·카메라가 같이 반응 | `event-pulse.ts` |
| `outsideDecay` | 창밖 붕괴도. 1막 수집 비율, 2막부터 1. **되돌아가지 않는다** | `visual-state.ts` |
| 페이즈 | intro → p1 → turning → p2 → p3 → p4 → resolve → ending. 저장하지 않고 진행에서 파생 | `story-phase.ts` |
| 효과 예산 | `off`(모션 끔) / `low`(프레임 저하·터치) / `full`. **cheap**은 low부터, **heavy**는 full에서만 | `lib/effects/effect-budget.ts` |

**포스트프로세싱 한 줄** (`MemoryOutlineGlow.tsx`, 이 순서가 그림의 층이다):
N8AO → 잔상(1인칭, heavy) → 빛기둥(엔딩, heavy) → 틸트 시프트(heavy) → 색수차 → 윤곽선(만질 수 있는 것) → 숨쉬는 헤일로(기억) → 그레인 → 화면 전환(찢김 · 재구성 · 타들어감).

---

## 1. 타이틀 · 부팅

| 연출 | 무엇이 보이나 | 트리거 · 수치 | 구현 |
|---|---|---|---|
| 부팅 커튼 | 모델이 다 오면 커튼이 위로 걷힌다 | 최소 0.9초 유지, 12초 넘으면 포기하고 걷는다. 걷힘 1.1초 | `ui/BootCurtain.tsx` |
| 떠오르는 먼지 | 커튼과 타이틀 뒤에서 DOM 먼지가 11~24초 주기로 오른다 | 모션 끔이면 정지 그림 | `ui/RisingDust.tsx` |
| 계단식 등장 | 로고 → 메뉴 → 안내 → 언어 순으로 55ms 간격 | 커튼이 걷히기 시작하는 프레임에 | `ui/TitleScreen.tsx`, `stagger.ts` |
| 모서리 선 긋기 | 네 귀에서 선이 자라고 금빛 점이 한 번 훑는다 | 0.62초, 훑기 1.5초. 작은 화면에서는 숨긴다 | `TitleScreen.tsx` |
| 카메라 드리프트 | 방 모형이 저 혼자 아주 느리게 돈다 (26초 주기) | "이건 진짜 공간"이라는 신호. 모션 끔이면 0 | `CameraRig.tsx` |
| 마우스 패럴랙스 | 손을 따라 2도 미만으로 기운다 | 손보다 늦게 따라와야 무게가 읽힌다 | `CameraRig.tsx` |
| 방 안으로 내려앉기 | 시작하면 타이틀이 물러나고 카메라가 모형 안으로 2.2초 동안 내려앉는다 | 평소 추적보다 훨씬 느린 속도(λ1.25) | `CameraRig.tsx` `ENTER_*` |

## 2. 인트로: 1인칭으로 스위치 찾기

| 연출 | 무엇이 보이나 | 트리거 · 수치 | 구현 |
|---|---|---|---|
| 1인칭 카메라 | 직교 카메라가 원근(FOV 68, 눈높이 1.38)으로 바뀐다. 처음엔 침대 쪽을 본다 | `viewpoint === "intro"` | `FirstPersonRig.tsx`, `first-person.ts` |
| 눈을 뜨는 덮개 | 어둠(void)이 1.4초에 걸쳐 걷힌다 | | `ui/ViewpointTransition.tsx` |
| 가운데만 남는 비네트 | 화면 가운데만 보이고 가장자리는 어둠 | 조명이 아니라 비네트가 "일부만 보이는" 느낌을 만든다 | `MemoryRoom.tsx` |
| 암전 | 간접광·전등에 0.18을 곱한다. 창빛은 그대로 | | `visual-state.ts` `BLACKOUT_FACTOR` |
| 스위치만 빛난다 | 나머지 윤곽선은 전부 죽이고 스위치 표시등만 1.6초 주기로 맥동 | | `LightSwitch.tsx`, `MemoryOutlineGlow.tsx` |
| 걷는 잔상 | 움직일수록 잔상이 길게 끌린다 (0.55 → 0.94) | heavy, 1인칭에서만 | `AfterimagePass.ts`, `afterimage.ts` |
| 거울 속 자기 몸 | 1인칭에서는 몸이 거울에만 비친다 (거울 전용 레이어) | | `MirrorReflection.tsx` |
| 무음 | 스위치를 켜기 전에는 곡이 없다 | `selectMusicPlaying` | `store/memory-room.ts` |
| **불 켜기** | 순백이 아닌 누런 덮개가 1.3초에 걸쳐 걷히고, 흐림 14px이 0으로 맞춰진다 | 번쩍임 금지 규칙(DESIGN.md). 모션 끔이면 어둠으로 잇는다 | `ViewpointTransition.tsx` |
| 조명과 곡이 차오른다 | 조명은 λ2.2로 진입값까지, 곡은 밝기를 따라 음량·컷오프·리버브가 glide | | `MemoryRoomScene.tsx`, `audio/index.ts` |

## 3. p1: 1차 조사, 방이 어두워진다

| 연출 | 무엇이 보이나 | 트리거 · 수치 | 구현 |
|---|---|---|---|
| 하강 곡선 | 조사할수록 간접광이 깎인다. 볕은 아직 없다 | `cool = level`, `warm = 0` | `visual-state.ts` |
| 창밖이 식는다 | 지평선의 볕이 회색으로 식는다 (도시가 꺼지는 것을 색으로) | `outsideDecay`, 단조 증가 | `WindowView.tsx` `skyColors` |
| 곡의 열화 | 컷오프 16k → 460Hz, 리버브 0.08 → 0.46. 바닥 근처에서는 급히 재워진다 | 밝기의 순수 함수 | `audio/music-curve.ts` |
| 조사 확대 | 물건을 조사하면 배율 ×1.45로 컷처럼 붙는다 (λ7) | | `CameraRig.tsx`, `room-canvas-runtime.ts` |
| 기억 수집의 튐 | 색수차가 가장자리에서 한 번 갈라지고 그레인이 잠깐 거칠어진다. 1초 안에 잦아든다 | pulse 0.6. 한 번뿐 (번쩍임 규칙) | `FilmLook.tsx`, `film-look.ts` |
| 카메라 눌림 | 배율이 1.2% 물러났다 돌아온다. 흔들지는 않는다 | | `CameraRig.tsx` `KICK_ZOOM` |
| 금빛 티끌 | 물건에서 티끌 140알이 솟아 수첩 쪽(오른쪽 위)으로 쓸려 간다 | 1차·2차 수집 모두 | `MemoryBurst.tsx` |
| 커튼 틈 광선 | 커튼을 젖힌 만큼 광선 판이 열린다. 1막에는 바닥값 | `warm` × 커튼 | `WindowLight.tsx` |
| 광선 속 먼지 | 커서가 밀어내면 흩어지고, 어두울수록 천천히 다시 쌓인다 | `settle = level` | `DustMotes.tsx` |
| 등 (랜턴) | 방이 0.35 아래로 어두워지면 손(커서) 가까이만 비추는 점광원이 켜진다 | cheap. 터치는 몸을 따라간다 | `Lantern.tsx`, `lantern-light.ts` |
| 꺼진 모니터의 도트 반사 | 모니터에 방이 도트로 비친다. 어두울수록 도트가 성글다 | heavy, 방에서만 | `DotReflection.tsx` |
| 컵라면 물때 | 조사할수록 용기의 얼룩이 자란다 | `1 - level` | `StudentProps.tsx` |
| 멈춘 탁상시계 | 10월 19일 16:20에 서 있다 | | `RoomFurniture.tsx` |
| 회상 컷씬 | 게임기 · 공 조사 뒤 짧은 그림 컷 | 재생 공통 연출(10장) | `content/cutscenes.yaml` |
| 1막 끝 과거편 | 정적 노이즈 1.1초 → 라디오 끊김 소리 → 암전 0.9초 → 7컷 → 검정 화면 컷(`black`, 대사창만) | 1바퀴 완주에 스토어가 연다 | `ui/PlaybackScene.tsx` |
| 곡이 삼켜진다 | 컷오프 180Hz로 가라앉으며 멎는다. 문이 열릴 때까지 **turning 전체가 무음** | | `audio/music.ts` `stopMusic` |

## 4. turning: 라디오 각성 → 생존자 방송 → 방문

| 연출 | 무엇이 보이나 · 들리나 | 트리거 · 수치 | 구현 |
|---|---|---|---|
| 라디오 각성 | 컷씬이 닫히고 방으로 돌아온 순간 라디오가 저 혼자 지직거린다 | `selectRadioSignaling` | `MemoryObjects.tsx`, `radio-signal.ts` |
| 최대 세기의 튐 | 색수차·그레인이 꼭대기까지 튀고 카메라가 눌린다 | pulse 1.0 | `event-pulse.ts` |
| 방이 한 번 떤다 | 눈치챌 듯 말 듯한 롤·요 떨림이 잦아든다 | "흔들렸다"가 아니라 "떨었다" | `CameraRig.tsx` `SHAKE` |
| 재구성 | 방이 선(와이어프레임)으로 풀렸다가 0.45초에 면으로 채워진다 | cheap | `WireframeReveal.tsx`, `reconstruction.ts` |
| 빨간 발광 | 라디오가 불규칙한 봉우리로 붉게 번지고 점광원이 방을 물들인다 | 분기점 동안 | `radio-signal.ts` |
| 가장 어두운 방 | `level = 0`. 등이 가장 세고, 곡은 없다 | | |
| **생존자 방송 웹툰** | 3페이지 10칸. 칸이 떠오르고 말풍선이 찍히면 다음 칸, 페이지가 슬라이드 | 라디오 2차 | `ui/WebtoonViewer.tsx` |
| 미트 소리가 먼저 온다 | 1컷(마이크)이 뜨는 순간 실제 미트 소리. 그 컷은 대사 없이 1.5초 | 포수 복선. 소리가 그림·대사보다 앞선다 | `PlaybackScene.tsx`, `sfx-mitt-tap.ogg` |
| 말풍선의 지직 · 끝의 끊김 | 대사 칸마다 짧은 정적, 10번째 칸 뒤 노이즈 0.8초 → 끊김 | | `audio/voices.ts` |
| `● SIGNAL FOUND` | HUD 기록 라벨이 바뀐다 | | `ui/HudLogLine.tsx` |
| 방문 금빛 | 문이 금빛으로 켜지고 안내문 한 줄이 떠오른다. 여는 것은 플레이어다 | | `RoomShell.tsx`, `MemoryRoom.tsx` |
| 방문 넘기 (1인칭) | 다시 1인칭. 열린 문 너머로 거실이 보이고 잔상이 낀다 | `doorOpened && !doorwayDone` | `FirstPersonRig.tsx` |
| 2막 곡이 든다 | 문이 열리는 순간 정적 위에 따뜻한 곡이 처음 든다 | `selectMusicPhase` | `audio/index.ts` |
| 문턱의 금빛 덮개 | 문턱을 넘는 순간 금빛(memory) 덮개 1초. 로그 번호가 02로 | | `ViewpointTransition.tsx` |

## 5. p2: 거실 · 화장실, 볕이 차오른다

| 연출 | 무엇이 보이나 | 트리거 · 수치 | 구현 |
|---|---|---|---|
| 상승 곡선 | 창빛(point · directional)이 회복도를 따라 오른다. 간접광은 0.16까지만 | `warm = recovery`. 구석은 차갑게 남아야 한다 | `visual-state.ts` |
| 공간마다 한 단계 어둡게 | 거실은 방보다 0.12 낮게 출발 | 나가는 것만으로 회복한 것처럼 보이면 안 된다 | `spaces.ts` `lightOffset` |
| 틸트 시프트가 옅어진다 | 1막의 좁은 초점 띠(닫힌 모형)가 2막부터 넓어진다 | heavy | `tilt-focus.ts` |
| 초침이 다시 간다 | 탁상시계 초침이 한 초에 한 칸 | `act >= 2` | `RoomFurniture.tsx` `SecondHand` |
| 혼잣말의 퇴장이 바뀐다 | 1막은 뒤 글자부터 떨어지고, 2막부터는 위로 모인다 | cheap | `ui/Monologue.tsx`, `monologue-exit.ts` |
| 새 공간 첫 진입의 재구성 | 화장실 · 안방에 처음 들어서면 선에서 면으로 | cheap | `WireframeReveal.tsx` |
| 화장실 거울 | 방의 전신거울과 같은 진짜 거울. 세로줄마다 시간이 어긋나던 slit-scan은 2026-09-30에 걷었다: 멀리서는 깨진 텍스처, 가까이서는 고장 난 거울로 읽혔다 | 3인칭 간격 | `MirrorReflection.tsx` (`BathroomFixtures.tsx`) |
| 화장실 물때 | 타일·샤워 벽의 반응확산 무늬 | 정적 | `BathroomStains.tsx` |
| 평면도 순간이동 | 목적지로 뛸 때 8px 흐림 0.36초 | cheap | `ViewpointTransition.tsx` `warp` |
| 그림 없는 컷씬 | `trip-doubt` · `p2-close`는 방이 비친 채 대사창만 뜬다 | | `content/cutscenes.yaml` |

## 6. p3: 하부장 · 안방 열쇠

| 연출 | 무엇이 보이나 | 트리거 · 수치 | 구현 |
|---|---|---|---|
| **[신규] 크레인 샷** | 하부장이 열리는 순간 화장실 전체를 잡고 있던 카메라가 열쇠가 있던 칸까지 3초 남짓 밀고 들어가, "…안방 열쇠." 한 줄과 함께 4.2초 머문 뒤 돌아온다 | 히치콕 *오명*. 배율은 조사 확대의 1.6배, λ1.15. 그동안 씬 입력 잠김 | `crane-shot.ts`, `CameraRig.tsx`, 스토어 `cameraHold` |
| 세면대 파문 | 열쇠가 손에 들어온 순간 고인 물에 파문 한 번 (2.5초) | cheap | `SinkWater.tsx`, `water-ripple.ts` |
| 앰플 유리 굴절 | 보냉 케이스를 돌려 보는 인스펙트에서 유리가 뒤를 굴절시킨다 | | `Ampoule.tsx`, `canvas/InspectTurntable.tsx` |
| 로그 03 오염 | HUD 기록 번호에 오염 표식. 깜빡이지 않는다 | | `ui/HudLogLine.tsx` |

## 7. p4: 안방, 곡이 없다

| 연출 | 무엇이 보이나 · 들리나 | 트리거 · 수치 | 구현 |
|---|---|---|---|
| **[신규] 무음** | 안방 문이 열리는 순간 곡이 가라앉으며 멎고, 4페이즈 내내 방의 소리만 남는다 | 히치콕 *새*. `storyPhaseOf === "p4"` | `store` `selectMusicPlaying` |
| 안방 첫 진입 재구성 | 선에서 면으로 | cheap | `WireframeReveal.tsx` |
| `p4-close` | 서류 순서 + 출입증 뒤 한 줄. 끝나면 액자에 금빛 | | `content/cutscenes.yaml` |
| 액자 사진 밀림 | 액자 2차에서 틀이 물러나며 사진이 물 얼룩 변위로 밀린다 (0.7초 뒤 1.3초) | cheap | `ui/PhotoMorph.tsx`, `photo-morph.ts` |
| **정적 비트** | 대사 없는 컷 2.6초 → "…갔다 올게." 방이 비친 채 대사창도 없다 | 액자 2차 직후. 곡은 이미 없다 | `cutscenes.yaml` `still-beat` |
| 악보 잉크 | 악보 조각을 들고 거실에 서면 번진 잉크가 1.5초에 모인다 | cheap | `PianoSheet.tsx`, `sheet-ink.ts` |

## 8. resolve: 결심

| 연출 | 무엇이 보이나 · 들리나 | 트리거 | 구현 |
|---|---|---|---|
| 곡이 다시 든다 | 정적 비트를 지나 결심에 들어서면 2막 곡이 그 정적 위에 다시 든다 | resolve 진입 | `selectMusicPlaying` |
| 배트의 금빛 | 현관 옆 배트의 발광이 0.06 → 0.55로 오른다 | `selectBatReady` | `EndingTrigger.tsx` |
| 현관 안내문 | 한 줄이 떠오른다 | | `MemoryRoom.tsx` |
| `bat-grip` | 배트를 쥐는 대사. 그림 없음, 도입 없음 | | `cutscenes.yaml` |

## 9. ending

| 연출 | 무엇이 보이나 | 수치 | 구현 |
|---|---|---|---|
| 곡이 멎는다 | 가라앉으며 정지 | `!endingStarted` | `selectMusicPlaying` |
| 카메라가 현관에 붙는다 | 거실 끝 현관문 구도 | 엔딩 영상 첫 컷과 이어진다 | `layout.ts` `CAMERA_PRESETS.ending` |
| 문이 열리고 배트가 딸려 나간다 | 문 λ4, 배트 0.45초 | | `LivingRoomShell.tsx`, `EndingTrigger.tsx` |
| 문밖 빛기둥 | 현관 개구부 밖 빛 판에서 GodRays | heavy | `ending-light.ts`, `MemoryOutlineGlow.tsx` |
| 처음으로 깨끗한 화면 | 그레인과 색수차가 0으로 | 게임에서 화면이 처음 깨끗해지는 순간 | `film-look.ts` `clean` |
| 필름이 타들어간다 | 가장자리부터 1.5초 | | `ScreenTransition.tsx` burn |
| 엔딩 영상 → 카드 → 색종이 | 영상 뒤 카드가 떠오르고 색종이 160조각 | 모션 끔이면 색종이 없음 | `ui/EndingScreen.tsx`, `EndingConfetti.tsx` |

---

## 10. 상시 연출 (어느 페이즈에도 묶이지 않는 것)

**화면 질감 · 카메라**

| 연출 | 수치 · 게이트 | 구현 |
|---|---|---|
| 셰이더 그레인 | overlay 0.09. 사건에 ×2까지 튀고 잦아든다. 모션 끔이면 정지 그레인(CSS 0.13)으로 | `FilmLook.tsx`, `MemoryRoom.tsx` |
| 색수차 | 0.0006 × (1 + 1.5·dim). 화면 가운데 반지름 0.3 안쪽은 깨끗 | `film-look.ts` |
| 비네트 | 어두울수록 조여든다 (0.62 → 0.24) | `MemoryRoom.tsx` |
| 틸트 시프트 · 앉기 초점 | 앉으면 띠가 앉은 눈높이로 내려오고 좁아진다. heavy | `tilt-focus.ts` |
| 플레이어 추적 | λ3.2. 축소할수록 공간 가운데로. 문턱은 컷이 아니라 이동 | `CameraRig.tsx` |
| 벽 걷힘 | 카메라 쪽 두 벽의 윗부분이 스러지고 굽도리만 남는다 | `CulledWall.tsx`, `wall-culling.ts` |
| 전신거울 반사 | 3인칭 2프레임에 1번 | `MirrorReflection.tsx` |
| 이불 호흡 | 침대에 누웠을 때만 이불이 숨을 쉰다. cheap | `BedModel.tsx` |

**금빛 · 표식**

| 연출 | 구현 |
|---|---|
| 윤곽선 두 등급: 만질 수 있는 것은 선 한 줄, 기억은 숨쉬는 헤일로 | `MemoryOutlineGlow.tsx` |
| 호버 순간 윤곽선이 한 번 밝아진다 | `GlowHoverPulse` |
| 기억 비컨: 바닥 고리 맥동, 마름모 회전. 가까우면 커진다 | `MemoryBeacon.tsx` |
| 문 금빛 (방문 · 새 공간 문 · 현관) | `RoomShell.tsx`, `SpaceDoor.tsx`, `LivingRoomShell.tsx` |
| 안 읽은 기록의 금빛 고리 (수첩 손잡이) | `ui/NotebookTab.tsx` |

**UI 모션 · 텍스트 · 소리**

| 연출 | 수치 · 게이트 | 구현 |
|---|---|---|
| 커스텀 커서 | 점 + 늦게 따라오는 링. DOM 위에서 조여들고 3D 물건에 흡수된다. 마우스만 | `ui/CustomCursor.tsx`, `cursor-ring.ts` |
| 대사 타자기 · 타자 틱 | 70ms/글자, 두 글자에 한 틱. 화자마다 음높이가 다르고 전파 화자는 따로 | `lib/use-typewriter.ts`, `dialogue-sfx.ts` |
| 화자 라벨 교체 · 혼잣말 글자 퇴장 · 한 줄 혼잣말 | 0.22초 / 글자당 260ms / fade-rise | `globals.css`, `Monologue.tsx`, `RemarkLine.tsx` |
| BGM 덕킹 | 대사 0.72, 미니게임 0.42 | `audio/index.ts` |
| 미니게임 층 | 백드롭 → 카드 0.22초, 닫힐 때 잔상 0.2초, 클리어 입자 84알 | `ui/MinigameHost.tsx`, `ExitFade.tsx`, `SuccessBurst.tsx` |
| 호버 소리 | DOM 버튼과 3D 물건이 같은 샘플. 터치는 무음 | `ui/hover-sfx.ts` |

**재생 공통 (컷씬 · 다시보기)**

| 연출 | 수치 · 게이트 | 구현 |
|---|---|---|
| 신호 끊김 찢기 | 재생이 시작되는 순간 0.15초에 꼭대기, 0.5초에 잦아든다 | `ScreenTransition.tsx` tear |
| 영사기 소리 + 테이프 히스 | 그림이 있는 재생만 | `PlaybackScene.tsx` |
| 컷 전환: 셔터 + 노이즈 장막 | 0.6초. 결은 종이 / 필름 / 물 얼룩을 컷마다 순환. cheap | `ui/CutDissolve.tsx`, `cut-dissolve.ts` |
| 필름 먼지 · 스크래치 · 재생 비네트 | 모션 끔이면 숨김 | `globals.css`, `PlaybackScene.tsx` |
| 그림이 없는 컷의 자리 | 파형 막대 56개 + 스캔라인 | `PlaybackScene.tsx` `SignalVisual` |
| 컷씬 동안 BGM 정지 | 컷씬만. 다시보기는 곡이 계속 흐른다 | `selectMusicPlaying` |

---

## 11. 소리의 지도

| 구간 | 곡 | 이유 |
|---|---|---|
| 타이틀 · 인트로 | 없음 | 어둠 속에서는 정적뿐. 스위치가 곡을 켠다 |
| p1 | 1막 곡 (발랄) | 조사할수록 열화. 라디오 직전엔 거의 정적 |
| 과거편 컷씬 ~ 방문 열기 전 | 없음 | 방송이 끊긴 정적 위에 라디오가 말을 건다 |
| p2 · p3 | 2막 곡 (따뜻) | 문이 열리는 순간 정적 위에 처음 든다 |
| p4 | **없음 [신규]** | 부모님의 서류를 읽는 동안은 방의 소리만 |
| resolve | 2막 곡 | "…갔다 올게." 뒤에 다시 든다 |
| ending | 없음 → 영상의 소리 | |

효과음은 `audio/voices.ts`의 합성음이 기본이고, 파일이 있는 것은 둘뿐이다: 미트 소리(`sfx-mitt-tap.ogg`)와 배트 타격(`mg-ball-catch-bat-hit.mp3`). 파일이 없으면 합성음으로 돌아간다.

---

## 12. 원칙 (모든 항목이 지키는 것)

- **번쩍임 금지.** 전면 순백 덮개 없음. 사건 반응은 한 번뿐이고 1초 안에 잦아든다. 초당 3회 넘는 밝기 변화 없음 (DESIGN.md > Accessibility).
- **어둠은 조명이 만들고, 질감은 그 위에 얹힌다.** 그레인·색수차는 어둠을 만들지 않는다.
- **되돌아가지 않는 것**은 되돌아가지 않는다: 창밖 붕괴도, 로그 오염.
- **문턱은 컷이 아니라 이동.** 공간 전환에 카메라 컷이 없다. 컷은 재생(컷씬)과 1인칭 전환에만 있다.
- **모션을 끈 사람**에게는 같은 정보를 정지 그림이나 즉시 전환으로 준다. 정보를 빼지 않는다.
- **효과 예산.** heavy(잔상 · 빛기둥 · 틸트 시프트 · 도트 반사)는 프레임이 떨어지면 자동으로 빠진다.

---

## 13. 코드와 설명이 어긋나는 곳 (손볼 후보)

조사하면서 걸린 것. 고치지는 않았다.

1. **이불 호흡**: `visual-experiments.md` 13장 표는 "고정 진폭"이지만 코드는 침대에 누웠을 때(`seatedAt === "bed"`)만 숨을 쉰다.
2. **찢김(tear)**: 주석은 "컷씬이 시작되는 순간"이지만 조건은 재생 시작 전부라 다시보기에도 돈다.
3. **타들어감(burn)**: 모션 끔 게이트가 없다. tear · settle만 막혀 있다.
4. **배트를 쥐면 카메라가 문 쪽으로**: `MemoryRoomScene.tsx` 주석과 달리 조건은 현관문을 누른 순간(`endingStarted`)이다.
5. **수집 반응의 범위**: 금빛 티끌은 2차 수집에도 터지지만 event pulse와 수집 소리는 1차에만 반응한다. 의도인지 확인.
6. **앰플 굴절의 자리**: 13장 표는 `ampoule-pickup`을 적었지만 v4.1부터 그 미니게임은 안 쓰인다. 실제 자리는 인스펙트 턴테이블이고 거기는 게이트가 없다.
7. `content-design.md` 4-3의 **DoorNudge**는 코드에 없다.
