# room-of-memory 연출·효과·인터랙션 카탈로그

이 프로젝트에 들어간 three.js 연출, CSS·DOM 효과, 인터랙션을 코드 기준으로 정리한 문서다. 포트폴리오나 회고에 옮겨 쓰기 쉽도록 각 항목에 **보이는 것**과 **구현 방법**을 함께 적었고, 섹션마다 끝에 `### 관련 코드`로 실제 소스 발췌를 붙였다.

- 경로는 `src/` 기준이다. 디렉터리를 생략한 3D 파일은 `src/scenes/memory-room/` 아래에 있다.
- 줄 번호는 자주 바뀌므로 적지 않았다. 파일명과 심볼 이름으로 찾으면 된다.
- 코드 발췌는 소스에서 그대로 옮겼다. 관계없는 줄은 `// ...`나 `/* ... */`로 생략했다.
- 기준 커밋: `06ab5ad` (2026-09-28)

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
19. [미니게임 19종](#19-미니게임-19종)
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
| 미니게임 | 격투(AI와 프레임 데이터), 배팅, 액자 닦기(Canvas destination-out), 두 조각 맞바꾸기 퍼즐, 3D 턴테이블, 돋보기, 3D 피아노, 숫자 드럼 등 19종 |
| 오디오 | 효과음은 파일 없이 Web Audio로 합성. BGM은 방 밝기에 따라 필터·리버브가 움직이고, 루프 이음새를 크로스페이드로 굽는다 |

---

## 2. 공통 기반

### 2-1. 효과 예산 게이트 (`lib/effects/effect-budget.ts`)
- 등급은 `off`(reduced motion) / `low`(프레임 저하 또는 터치 기기) / `full` 세 가지다. 첫 렌더는 항상 full이다(미디어 쿼리는 브라우저에만 있다).
- `useEffectEnabled("cheap")`은 low부터, `"heavy"`는 full에서만 켜진다. 실험성 효과는 전부 이 한 곳을 거쳐 켜지고 꺼진다. 효과 컴포넌트는 스토어를 직접 읽지 않는다.
- drei `<PerformanceMonitor>`(`flipflops={3}`)가 프레임 저하를 감지하면 DPR 상한을 1.5에서 1로 내리고, 같은 신호로 `useEffectsStore`의 `degraded`를 올린다. 프레임이 회복되면 둘 다 되돌린다.
- 개발 모드에서는 localStorage `rom-effect-tier`로 등급을 강제할 수 있다. 프로덕션 번들에서는 `NODE_ENV` 치환으로 통째로 빠진다.

### 2-2. r3f 코딩 규약 (거의 모든 3D 파일에 공통)
- `useFrame` 안에서는 ref, uniform, material 속성만 바꾸고 setState는 하지 않는다. 벡터는 모듈 스코프에서 재사용한다.
- 순수 곡선 함수는 별도 파일로 뺀다(`film-look.ts`, `water-ripple.ts`, `slit-scan.ts`, `dot-screen.ts`, `tilt-focus.ts`, `afterimage.ts`, `memory-motion.ts` 등). 브라우저 없이 테스트하기 위해서다.
- 프레임마다 바뀌는 값은 스토어가 아니라 **모듈 스코프 싱글턴**으로 넘긴다(`cursorTarget`, `endingLight`, `screenTransitionInput`).
- glb 로더는 모두 자기 `<Suspense>`를 안에 둔다. 서스펜드가 위로 새면 EffectComposer가 렌더러 없이 다시 붙다가 `addPass`에서 터지고, 1인칭 리그가 언마운트되기 때문이다.
- Canvas 설정: orthographic 아이소메트릭, `shadows="percentage"`(r185에서 PCFSoft가 deprecated), `alpha: true`. 창밖 번짐 같은 워시는 캔버스 아래 DOM(`.room-backdrop`)이 맡는다. 엔딩 영상이 덮는 동안은 `frameloop="never"`로 멈춘다.

### 2-3. 디자인 토큰과 무드 (`DESIGN.md` → `app/globals.css @theme`)
- 핵심 3색
  - `night #0B1320`: 바탕이자 모든 어두운 표면의 재료. 표면은 `color-mix(in srgb, night N%, transparent)`로 night를 얼마나 남기느냐로만 구분한다.
  - `memory #D5AE78`: 앰버 시그니처 색. 선택·포커스·진행·핵심 행동에만 쓴다. 3D 글로우와 창빛도 같은 토큰을 읽는다.
  - `ember #B8655A`: 되돌릴 수 없는 동작과 실패, 3막의 "오염" 표현.
- 무드 문장: "공포가 아니라 쓸쓸함과 그리움. 차가운 어둠 속 국소적인 따뜻한 빛."
- 타이포: Pretendard(본문)와 Galmuri14 픽셀(포인트). 둘 다 `next/font/local`로 셀프호스팅한다(`app/fonts.ts`).
  - 크기 토큰 `--text-hud/-monologue/-dialogue`는 브레이크포인트 없이 `clamp()` 하나로 자란다.
  - `--hud-zoom`은 rem 기반 패널을 CSS `zoom`으로 통째로 키운다.
- 공통 UI 클래스는 `components/ui/ui-classes.ts`에 있다(PANEL_*, BUTTON_*, CHIP_*, HUD_CHOICE_*, FOCUS_RING). 테두리는 늘 있고 hover 때 색만 바뀌므로 레이아웃이 흔들리지 않는다.
- 3D 재질 색도 CSS 토큰에서 읽는다(`resolveRoomPalette`). 캔버스 2D 효과도 `getComputedStyle`로 토큰 색을 읽는다.
- 유틸리티: `break-ko`(`keep-all` + `overflow-wrap:anywhere`), 종이용 잉크 스크롤바 `.scroll-paper`.

### 관련 코드

**효과 예산 게이트** — `lib/effects/effect-budget.ts` · `effectTier` / `effectEnabled` / `useEffectTier`

```ts
export function effectTier({ reducedMotion, degraded, touch }: EffectBudgetInput): EffectTier {
  if (reducedMotion) return "off";
  if (degraded || touch) return "low";
  return "full";
}

/** 이 등급에서 이 값의 효과를 켤 수 있는가. */
export function effectEnabled(tier: EffectTier, cost: EffectCost): boolean {
  if (tier === "off") return false;
  if (tier === "low") return cost === "cheap";
  return true;
}
// ...
/** 지금 기기의 등급. 첫 렌더는 항상 full이다 (미디어 쿼리는 브라우저에만 있다). */
export function useEffectTier(): EffectTier {
  const reducedMotion = useMemo(prefersReducedMotion, []);
  const degraded = useEffectsStore((state) => state.degraded);
  const touch = usePointerKind() === "touch";
  const override = useMemo(tierOverride, []);
  return override ?? effectTier({ reducedMotion, degraded, touch });
}
```

**PerformanceMonitor와 DPR 상한** — `components/canvas/RoomCanvas.tsx` · `DPR_CAP`, `degrade` / `restore`

```tsx
const DPR_CAP = { high: 1.5, low: 1 } as const;
// ...
  const [dprCap, setDprCap] = useState<number>(DPR_CAP.high);
  const dpr = useMemo<[number, number]>(() => [1, dprCap], [dprCap]);
  // 효과 예산(effect-budget)도 같은 판정을 본다. 배율이 내려간 기기에서는 무거운 효과가 빠진다
  const setDegraded = useEffectsStore((state) => state.setDegraded);
  const degrade = useCallback(() => {
    setDprCap(DPR_CAP.low);
    setDegraded(true);
  }, [setDegraded]);
  const restore = useCallback(() => {
    setDprCap(DPR_CAP.high);
    setDegraded(false);
  }, [setDegraded]);
// ...
            <PerformanceMonitor
              onDecline={degrade}
              onIncline={restore}
              onFallback={degrade}
              flipflops={3}
            />
```

**개발용 등급 강제** — `lib/effects/effect-budget.ts` · `tierOverride`

```ts
const TIER_OVERRIDE_KEY = "rom-effect-tier";

function tierOverride(): EffectTier | null {
  if (process.env.NODE_ENV === "production" || typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(TIER_OVERRIDE_KEY);
    return value === "off" || value === "low" || value === "full" ? value : null;
  } catch {
    return null;
  }
}
```

**모듈 스코프 싱글턴** — `scenes/memory-room/cursor-target.ts` · `cursorTarget`, `lib/effects/screen-transition-input.ts` · `screenTransitionInput`

```ts
export const cursorTarget: CursorTargetState = { object: null, screen: null, hoverAt: 0 };

/** 호버가 켜졌다. 같은 오브젝트가 다시 켜져도 밝아지는 순간은 새로 센다. */
export function setCursorTargetObject(object: Object3D): void {
  cursorTarget.object = object;
  cursorTarget.hoverAt = performance.now();
}
```

```ts
export const screenTransitionInput: ScreenTransitionInputState = { settle: 0 };

export function setScreenTransitionSettle(value: number): void {
  screenTransitionInput.settle = Number.isNaN(value) ? 0 : Math.min(1, Math.max(0, value));
}
```

**glb 로더 안쪽의 Suspense** — `scenes/memory-room/FurnitureModel.tsx` · `FurnitureModel`

```tsx
/**
 * ...
 * Suspense 경계를 컴포넌트 안에 둔다. 이게 없으면 로딩 중 서스펜드가 부모인
 * MemoryGlowRoot까지 올라가서, 아웃라인 글로우의 EffectComposer가 렌더러 없이
 * 다시 붙었다가 addPass에서 터진다.
 */
export function FurnitureModel(props: FurnitureModelProps) {
  return (
    <Suspense fallback={null}>
      <LoadedFurniture {...props} />
    </Suspense>
  );
}
```

**Canvas 설정** — `components/canvas/RoomCanvas.tsx` · `<Canvas>`

```tsx
          <Canvas
            ref={attachCanvasRef}
            className="absolute inset-0 z-0"
            orthographic
            // three r185에서 PCFSoftShadowMap(= shadows 기본값)이 deprecated라 PCF로 명시한다
            shadows="percentage"
            dpr={dpr}
            // 엔딩 영상이 덮는 동안은 멈춘다. 마지막 프레임이 그대로 남아 페이드 뒤에 선다
            frameloop={sceneCovered ? "never" : "always"}
            camera={initialCamera}
            // alpha: true: 캔버스 뒤 DOM 워시가 비쳐야 한다 (창밖 번짐을 3D에 두면
            // three가 투명 오브젝트를 항상 불투명 뒤에 그려서 벽을 뚫고 덧칠된다)
            gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
          >
```

**색 토큰과 night 표면** — `app/globals.css` · `@theme`

```css
@theme {
  /* 어두운 표면 위: 화면 바탕과 그 위의 글자 (DESIGN.md > Colors) */
  --color-night: #0b1320;
  /* ... */
  --color-memory: #d5ae78;
  --color-ember: #b8655a;
  /* ... */
  --color-surface: color-mix(in srgb, var(--color-night) 84%, transparent);
  --color-surface-strong: color-mix(in srgb, var(--color-night) 92%, transparent);
  --color-surface-subtle: color-mix(in srgb, var(--color-night) 40%, transparent);
```

**서체 셀프호스팅** — `app/fonts.ts` · `pretendard` / `galmuri`

```ts
export const pretendard = localFont({
  src: "../../public/assets/fonts/PretendardVariable.woff2",
  variable: "--font-pretendard",
  weight: "45 920",
  display: "swap",
});

export const galmuri = localFont({
  src: "../../public/assets/fonts/Galmuri14.woff2",
  variable: "--font-galmuri",
  weight: "400",
  display: "swap",
});
```

**유동 크기 토큰과 HUD 배율** — `app/globals.css` · `--text-*`, `--hud-zoom`

```css
  --text-hud: clamp(1rem, 0.5rem + 0.85vw, 1.625rem);
  --text-hud-caption: clamp(0.75rem, 0.45rem + 0.5vw, 1.0625rem);
  --text-monologue: clamp(1.25rem, 0.75rem + 0.9vw, 1.875rem);
  --text-dialogue: clamp(1rem, 0.6rem + 0.7vw, 1.5rem);
  /* ... */
  --hud-zoom: clamp(1, 0.5 + 100vw / 1882px, 1.625);
```

**공통 UI 클래스** — `components/ui/ui-classes.ts` · `FOCUS_RING`, `PANEL_*`, `BUTTON_PRIMARY`

```ts
export const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-memory";

/** 어두운 패널: 메뉴·설정·미니게임 셸·모달. */
export const PANEL_DARK = "rounded-md border border-line bg-surface text-ivory shadow-panel";
// ...
/** 종이 패널: 수첩과 방에서 집어 든 종이. */
export const PANEL_PAPER = "rounded-lg border border-ink/12 bg-paper text-ink shadow-panel";

const BUTTON_BASE = `inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-sm border text-sm font-medium leading-none transition-colors duration-150 disabled:cursor-default disabled:opacity-40 ${FOCUS_RING}`;
/** 핵심 행동: 시작·확인. 금빛은 여기와 선택·진행에만 쓴다. */
export const BUTTON_PRIMARY = `${BUTTON_BASE} border-memory bg-memory px-4 py-2.5 text-night hover:border-memory/85 hover:bg-memory/85 active:bg-memory/75`;
```

**3D 팔레트를 CSS 토큰에서 읽기** — `scenes/memory-room/palette.ts` · `resolveRoomPalette`

```ts
export function resolveRoomPalette(): RoomPalette {
  const styles = getComputedStyle(document.documentElement);
  const read = (key: keyof RoomPalette) => {
    const value = styles.getPropertyValue(TOKEN_BY_KEY[key]).trim();
    if (value !== "") return value;
    // ...
    return FALLBACK[key];
  };

  return Object.fromEntries(
    (Object.keys(TOKEN_BY_KEY) as (keyof RoomPalette)[]).map((key) => [key, read(key)]),
  ) as Record<keyof RoomPalette, string>;
}
```

**한글 줄바꿈과 종이 스크롤바** — `app/globals.css` · `@utility break-ko`, `.scroll-paper`

```css
.scroll-paper {
  --scrollbar-thumb: color-mix(in srgb, var(--color-ink) 20%, transparent);
  --scrollbar-thumb-hover: color-mix(in srgb, var(--color-ink) 38%, transparent);
}
/* ... */
@utility break-ko {
  word-break: keep-all;
  overflow-wrap: anywhere;
}
```

---

## 3. three.js: 포스트프로세싱 체인

`MemoryOutlineGlow.tsx`의 `MemoryGlowRoot`가 EffectComposer 하나에 모든 패스를 쌓는다(`multisampling: 2`, `stencilBuffer: true`). 스텐실은 쓰려는 게 아니라 postprocessing 6.39와 three r185 사이에서 MSAA 깊이 블릿 포맷을 `DEPTH24_STENCIL8`로 맞추려는 것이다. 패스 순서가 곧 그림의 층이다.

> **N8AO → Afterimage → GodRays → TiltShift → ChromaticAberration → Outline(inner) → Outline(outer) → Noise → ScreenTransition**

이펙트 인스턴스는 `useMemo`로 직접 만들어 `<primitive>`로 꽂고 uniform만 바꾼다. 래퍼 컴포넌트가 prop 변화마다 인스턴스를 새로 만드는 것을 피하기 위해서다. 패스 배열 자체도 `useMemo`로 묶는다. 배열이 새로 오면 EffectComposer가 모든 패스를 떼고 렌더 타깃을 다시 할당해 화면이 멈칫했다. 아웃라인 선택도 prop이 아니라 effect에서 `selection.set`으로 직접 넣는다.

| 효과 | 파일 | 보이는 것 | 구현 |
|---|---|---|---|
| **앰비언트 오클루전** | MemoryOutlineGlow.tsx | 가구가 바닥·벽에 닿은 자리가 살짝 눌려 물건이 "놓여" 보인다 | `<N8AO halfRes quality="performance">`, 반경 0.6, intensity 1.8. AO 색은 검정이 아니라 팔레트의 `void`(`MemoryRoomScene`이 넘긴다) |
| **아웃라인 글로우 2등급** | MemoryOutlineGlow.tsx | 만질 수 있는 것에 금빛 윤곽이 생긴다. "기억" 등급은 숨 쉬는 헤일로가 가구 너머까지 비치고(xRay), "곁가지" 등급은 윤곽선 한 줄뿐이다 | `<Outline>` 두 개. inner는 edge 5, blur 없음, 전체 해상도. outer는 edge 8, VERY_LARGE 커널, `pulseSpeed 0.45`, 절반 해상도, xRay. **selectionLayer를 11/12로 강제로 나눴다**: 래퍼 기본값 10을 공유하면 곁가지가 xRay 패스로 새어 커튼 윤곽이 벽을 뚫고 나왔다. 가려진 부분의 윤곽은 채도·명도를 각각 0.12 내린 색. 대상 메쉬는 `useLayoutEffect` traverse로 등록하고, glb가 늦게 붙으면 `selectionVersion`으로 다시 훑는다 |
| **호버 순간 윤곽 펄스** | MemoryOutlineGlow.tsx, cursor-target.ts | 커서가 올라가는 순간 윤곽이 한 번 밝아졌다가 0.6초 남짓에 잦아든다. 상시 펄스는 없다 | `edgeStrength = base*(1+exp(-5t)*gain)`. gain은 윤곽선 1.2, 헤일로 0.5 |
| **틸트 시프트 DOF** | MemoryOutlineGlow.tsx, tilt-focus.ts | 화면 가운데 띠만 또렷한 디오라마 느낌. 서 있을 때 띠는 화면의 6할이고, 1막은 흐림이 세고 2·3막은 절반으로 옅어지며 번짐 폭이 넓다. **앉으면 초점 띠가 눈높이로 내려오며 좁아지고 흐림이 1.6배가 된다** | postprocessing 본판 `TiltShiftEffect`(래퍼의 TiltShift2가 아니다. 그쪽의 start/end는 초점선의 두 점이라 띠가 세로선이 됐다). `offset`/`focusArea`/`feather`/`blurPass.scale` 네 값을 `damp`(λ3)로 옮기고, 1e-4 넘게 움직일 때만 setter를 부른다. 절반 해상도, heavy 전용 |
| **색수차** | FilmLook.tsx, film-look.ts | 방이 어두울수록 가장자리 색이 더 어긋나고, 기억을 줍는 순간 한 번 튄다. **엔딩에서는 0으로 수렴해 처음으로 화면이 깨끗해진다** | `radialModulation`(반지름 0.3 안쪽 보호)으로 가운데는 보호. 쉬는 값은 damp(λ2.2), 펄스는 `exp(-4Δ)` 감쇠, 엔딩 `clean` 축은 따로 damp(λ2.6) |
| **필름 그레인** | FilmLook.tsx | 프레임마다 다시 뿌려지는 필름 결(overlay 0.09). 사건 때 두 배가 되고 엔딩에서 사라진다 | `NoiseEffect`. reduced motion이면 `BlendFunction.SKIP`으로 셰이더에서 빼고, DOM 정지 타일 `.film-grain`이 대신한다 |
| **사건 펄스 버스** | event-pulse.ts | 색수차, 그레인, 카메라 킥이 같은 사건에 함께 반응한다 | 스토어 `subscribe`로 수집 증가(0.6)와 라디오 신호 상승 엣지(1.0)를 듣는다 |
| **화면 전환 셰이더** | ScreenTransition.tsx | ① **tear**: 컷씬 시작 순간 가로 띠가 밀리고 주사선과 잡음이 지나간다(0.15초 꼭대기, 0.5초에 잦아듦). ② **settle**: 굵은 셀이 덮였다가 같은 자리부터 차오른다. ③ **burn**: 엔딩에서 가장자리부터 따뜻한 빛이 1.5초에 걸쳐 번진다 | 커스텀 `postprocessing.Effect`(`CONVOLUTION` 속성, inputBuffer를 다른 uv로 읽는다). tear는 `floor(uv.y*28+t*9)` 띠 해시로 x를 밀고 `sin(y*900)` 주사선을 더한다. settle은 96×54 셀 해시에 `step`을 걸어 시간과 무관하게 깜빡이지 않는다(값은 `WireframeReveal`이 `screenTransitionInput`으로 흘린다). burn은 iris smoothstep에 warm 색을 섞는다 |
| **1인칭 잔상** | AfterimagePass.ts, afterimage.ts | 1인칭으로 어둠 속을 걸을 때 빛이 끌린다. 멈추면 걷힌다 | Effect로는 되먹임이 안 되어 **커스텀 `Pass`**로 만들었다. HalfFloat RT 두 장을 ping-pong하며 `max(prev*uDamp, cur)`를 누적한다(밝은 쪽만 남음). 절반 해상도. `uDamp`는 이동 입력량(damp λ4)을 따라 0.55~0.94 |
| **GodRays** | MemoryOutlineGlow.tsx, ending-light.ts, LivingRoomShell.tsx | 엔딩에 열린 현관 틈으로 빛기둥이 거실을 가로지른다. 게임에서 광원이 화면에 서는 유일한 자리다 | `GodRaysEffect`(samples 40, 절반 해상도). 광원은 문 뒤의 `toneMapped=false` 판이고 모듈 싱글턴으로 컴포저에 건넨다. heavy이면서 엔딩일 때만 생성한다 |

### 관련 코드

**앰비언트 오클루전** — `scenes/memory-room/MemoryOutlineGlow.tsx` · `AO_SETTINGS`, `MemoryGlowRoot`의 `passes`

```tsx
const AO_SETTINGS = {
  aoRadius: 0.6,
  distanceFalloff: 0.8,
  intensity: 1.8,
  aoSamples: 8,
  denoiseSamples: 4,
  denoiseRadius: 6,
} as const;
// ...
  const passes = useMemo(
    () => [
      ...(aoColor
        ? [<N8AO key="ao" halfRes quality="performance" color={aoColor} {...AO_SETTINGS} />]
        : []),
      // 잔상은 장면 바로 다음: 뒤의 패스들이 끌린 화면 위에 얹힌다
      ...(afterimage ? [<primitive key="afterimage" object={afterimage} />] : []),
      // 빛기둥은 광원 판을 따로 그려 합치는 이펙트라 제 패스를 혼자 쓴다
      ...(godRays ? [<primitive key="godrays" object={godRays} />] : []),
      // 초점 띠는 색수차보다 앞: 윤곽선·그레인은 흐려진 화면 위에 또렷하게 얹혀야 한다
      ...(tiltEnabled ? [<primitive key="tilt" object={tilt} />] : []),
      <primitive key="aberration" object={film.aberration} />,
      // ...
      <primitive key="grain" object={film.grain} />,
      <primitive key="transition" object={transition} />,
    ],
    [aoColor, afterimage, godRays, tiltEnabled, tilt, film, settings, transition],
  );
```

**아웃라인 글로우 2등급** — `scenes/memory-room/MemoryOutlineGlow.tsx` · `createMemoryOutlineSettings`, 선택 주입 effect

```tsx
const INNER_SELECTION_LAYER = 11;
const OUTER_SELECTION_LAYER = 12;

export function createMemoryOutlineSettings(color: string) {
  // 앰버가 밝아진 만큼(#D5AE78) 들어 올리는 폭을 줄인다. 더 올리면 윤곽이 흰 줄로 뜬다
  const edgeColor = new Color(color).offsetHSL(0, -0.05, 0.06).getHex();
  // 가려진 쪽 테두리는 한 단계 어둡게: 벽 너머까지 같은 밝기로 타오르지 않게 한다.
  const hiddenEdgeColor = new Color(color).offsetHSL(0, -0.12, -0.12).getHex();

  return {
    // ...
    composer: { autoClear: false, multisampling: 2, stencilBuffer: true },
    edgeColor,
    hiddenEdgeColor,
    // inner는 윤곽선, outer는 그 바깥으로 번지는 숨쉬는 광량: 둘 다 약하면 화면에서 안 보인다.
    inner: {
      blur: false,
      edgeStrength: 5,
      kernelSize: KERNEL_SIZE_SMALL,
      pulseSpeed: 0,
      resolutionScale: 1,
      selectionLayer: INNER_SELECTION_LAYER,
      xRay: false,
    },
    // ...
    outer: {
      blur: true,
      edgeStrength: 8,
      kernelSize: KERNEL_SIZE_VERY_LARGE,
      pulseSpeed: 0.45,
      resolutionScale: 0.5,
      selectionLayer: OUTER_SELECTION_LAYER,
      xRay: true,
    },
  } as const;
}
```

```tsx
  // 패스가 다시 만들어지면 Outline이 선택을 비우고 시작하므로 그때도 다시 넣는다
  useEffect(() => {
    void passes;
    innerRef.current?.selection.set(touchable);
  }, [touchable, passes]);
  useEffect(() => {
    void passes;
    outerRef.current?.selection.set(selection.memory);
  }, [selection.memory, passes]);
```

**호버 순간 윤곽 펄스** — `scenes/memory-room/cursor-target.ts` · `hoverGlowPulse`, `MemoryOutlineGlow.tsx` · `GlowHoverPulse`

```ts
export function hoverGlowPulse(now: number, hoverAt: number): number {
  if (hoverAt <= 0 || now < hoverAt) return 0;
  const pulse = Math.exp((-(now - hoverAt) / 1000) * 5);
  return pulse < 0.01 ? 0 : pulse;
}
```

```tsx
  useFrame(() => {
    const effect = effectRef.current;
    if (!effect) return;
    const pulse = reducedMotion ? 0 : hoverGlowPulse(performance.now(), cursorTarget.hoverAt);
    effect.edgeStrength = baseStrength * (1 + pulse * gain);
  });
```

**틸트 시프트 DOF** — `scenes/memory-room/tilt-focus.ts` · `tiltFocus`, `MemoryOutlineGlow.tsx` · `TiltShiftDriver`

```ts
const BY_ACT: Record<Act, { blur: number; taper: number }> = {
  1: { blur: 0.14, taper: 0.55 },
  2: { blur: 0.07, taper: 0.7 },
  3: { blur: 0.07, taper: 0.7 },
};
// ...
const STANDING = { center: 0.5, half: 0.3 } as const;
/** 앉았을 때: 눈높이가 내려온 만큼 띠도 내려오고, 반폭은 줄어든다. */
const SEATED = { center: 0.42, half: 0.18 } as const;
// ...
const BLUR_SCALE = 2;

export function tiltFocus(act: Act, seated: boolean): TiltFocus {
  const band = seated ? SEATED : STANDING;
  const { blur, taper } = BY_ACT[act];
  // 화면 비율(0~1)을 이펙트의 축(−1~1)으로: 중심은 2c−1, 폭은 두 배
  const focusArea = band.half * 2;
  return {
    offset: band.center * 2 - 1,
    focusArea,
    feather: focusArea * taper,
    blurScale: (seated ? blur * 1.6 : blur) * BLUR_SCALE,
  };
}
```

```tsx
  useFrame((_, delta) => {
    const goal = tiltFocus(act, seated);
    const value = current.current;
    const offset = MathUtils.damp(value.offset, goal.offset, TILT_LAMBDA, delta);
    const focusArea = MathUtils.damp(value.focusArea, goal.focusArea, TILT_LAMBDA, delta);
    const feather = MathUtils.damp(value.feather, goal.feather, TILT_LAMBDA, delta);
    const blurScale = MathUtils.damp(value.blurScale, goal.blurScale, TILT_LAMBDA, delta);
    if (Math.abs(offset - value.offset) > TILT_EPSILON) effect.offset = offset;
    if (Math.abs(focusArea - value.focusArea) > TILT_EPSILON) effect.focusArea = focusArea;
    if (Math.abs(feather - value.feather) > TILT_EPSILON) effect.feather = feather;
    if (Math.abs(blurScale - value.blurScale) > TILT_EPSILON) effect.blurPass.scale = blurScale;
    current.current = { offset, focusArea, feather, blurScale };
  });
```

**색수차** — `scenes/memory-room/film-look.ts` · `restingAberration` / `aberrationAmount`, `FilmLook.tsx` · `FilmLookDriver`

```ts
export function restingAberration(dim: number): number {
  const clamped = Math.min(1, Math.max(0, dim));
  return ABERRATION.base * (1 + clamped * ABERRATION.dimGain);
}
// ...
export function aberrationAmount(resting: number, pulse: number, clean = 0): number {
  return (resting + clamp01(pulse) * ABERRATION.pulse) * (1 - clamp01(clean));
}
```

```tsx
  useFrame((_, delta) => {
    const current = motion.current;
    // 쉬는 값은 조명처럼 천천히 따라가고, 튄 값은 곧바로 붙었다가 잦아든다
    current.resting = MathUtils.damp(
      current.resting,
      restingAberration(dim),
      ABERRATION.followLambda,
      delta,
    );
    current.pulse = decayPulse(current.pulse, delta);
    current.clean = MathUtils.damp(current.clean, endingStarted ? 1 : 0, CLEAN_LAMBDA, delta);
    const amount = aberrationAmount(current.resting, current.pulse, current.clean);
    effects.aberration.offset.set(amount, amount * ABERRATION.aspect);
    // 그레인도 같은 순간 잠깐 거칠어진다. 모션을 끈 판에서는 펄스가 없어 그대로다
    effects.grain.blendMode.opacity.value = grainOpacity(current.pulse, current.clean);
  });
```

**필름 그레인** — `scenes/memory-room/FilmLook.tsx` · `useFilmLookEffects`, `film-look.ts` · `grainOpacity`

```tsx
  const effects = useMemo(() => {
    const aberration = new ChromaticAberrationEffect({
      offset: new Vector2(ABERRATION.base, ABERRATION.base * ABERRATION.aspect),
      radialModulation: true,
      modulationOffset: ABERRATION.modulationOffset,
    });
    // 모션을 끈 사람에게는 정지 그레인(.film-grain, motion-reduce에서만 보인다)이 남는다.
    // 프레임마다 뿌려지는 노이즈는 낮은 세기라도 깜빡임이다. SKIP은 셰이더에서 빠진다.
    const grain = new NoiseEffect({
      blendFunction: reducedMotion ? BlendFunction.SKIP : BlendFunction.OVERLAY,
    });
    grain.blendMode.opacity.value = FILM_GRAIN_OPACITY;
    return { aberration, grain };
  }, [reducedMotion]);
```

```ts
export function grainOpacity(pulse: number, clean = 0): number {
  return FILM_GRAIN_OPACITY * (1 + clamp01(pulse) * GRAIN_PULSE_GAIN) * (1 - clamp01(clean));
}
```

**사건 펄스 버스** — `scenes/memory-room/event-pulse.ts` · `subscribeEventPulse`

```ts
export const EVENT_PULSE = {
  collect: 0.6,
  radioWake: 1,
} as const;

/** 사건이 날 때마다 세기를 넘긴다. 돌려주는 함수로 구독을 끊는다. */
export function subscribeEventPulse(onPulse: (strength: number) => void): () => void {
  return useMemoryRoomStore.subscribe((state, previous) => {
    if (state.collected.length > previous.collected.length) onPulse(EVENT_PULSE.collect);
    if (selectRadioSignaling(state) && !selectRadioSignaling(previous)) {
      onPulse(EVENT_PULSE.radioWake);
    }
  });
}
```

**화면 전환 셰이더** — `scenes/memory-room/ScreenTransition.tsx` · `FRAGMENT`, `ScreenTransitionEffect`

```glsl
    if (uTear > 0.001) {
      // 가로 띠마다 제멋대로 밀린다. 띠와 밀림은 시간에 따라 다시 뽑힌다
      float band = floor(uv.y * 28.0 + uTime * 9.0);
      float pick = hash(band + floor(uTime * 20.0) * 0.37);
      float shift = (pick - 0.5) * 0.18 * uTear * step(0.55, pick);
      vec2 p = vec2(uv.x + shift, fract(uv.y + uTear * uTear * 0.06 * sin(uTime * 3.0)));
      color = texture2D(inputBuffer, p);
      float scan = 0.85 + 0.15 * sin(p.y * 900.0 + uTime * 40.0);
      color.rgb = mix(color.rgb, color.rgb * scan, uTear);
      float grain = hash(p.x * 311.0 + p.y * 917.0 + uTime * 13.0);
      color.rgb = mix(color.rgb, vec3(grain) * 0.35, uTear * 0.35);
      color.rgb *= 1.0 - 0.6 * uTear;
    }

    if (uSettle > 0.001) {
      // 굵은 결: 아직 채워지지 않은 자리가 어둡게 남는다. 결은 시간과 무관하게 고정이라
      // 잦아드는 동안 같은 자리가 차오른다 (프레임마다 바뀌는 잡음이 아니다)
      float cell = hash(floor(uv.x * 96.0) * 3.1 + floor(uv.y * 54.0) * 57.0);
      float fill = step(cell, uSettle);
      color.rgb = mix(color.rgb, color.rgb * 0.45, fill * 0.85);
    }

    if (uBurn > 0.001) {
      vec2 d = uv - 0.5;
      float r = length(d) * 1.35;
      // 가장자리부터 안쪽으로: uBurn이 1이면 화면 전체
      float iris = smoothstep(uBurn * 1.25 - 0.3, uBurn * 1.25 + 0.05, 1.0 - r + 0.2) ;
      iris = 1.0 - iris;
      vec3 warm = vec3(0.98, 0.82, 0.58);
      color.rgb = mix(color.rgb, color.rgb * 0.25 + warm * 0.85, iris * uBurn);
      color.rgb += warm * uBurn * uBurn * 0.15;
    }
```

```ts
export class ScreenTransitionEffect extends Effect {
  constructor() {
    super("ScreenTransitionEffect", FRAGMENT, {
      blendFunction: BlendFunction.NORMAL,
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map<string, Uniform>([
        ["uTear", new Uniform(0)],
        ["uBurn", new Uniform(0)],
        ["uSettle", new Uniform(0)],
        ["uTime", new Uniform(0)],
      ]),
    });
  }
  // ...
}

/** 찢김의 꼭대기까지, 그리고 잦아들기까지 (초). */
const TEAR_ATTACK_S = 0.15;
const TEAR_RELEASE_S = 0.5;
/** 타들어감이 다 차는 시간(초). EndingScreen의 DOOR_BEAT(1.8초)보다 짧아야 덮이기 전에 다 찬다 */
const BURN_RISE_S = 1.5;
```

**1인칭 잔상** — `scenes/memory-room/AfterimagePass.ts` · `BLEND_FRAGMENT`, `AfterimagePass.render`, `afterimage.ts` · `afterimageDamp`

```glsl
  void main() {
    vec4 previous = texture2D(tOld, vUv);
    vec4 current = texture2D(tNew, vUv);
    // 어두운 쪽으로는 빨리, 밝은 쪽으로는 느리게: 빛의 잔상만 남고 어둠은 곧 따라잡는다
    vec3 held = max(previous.rgb * uDamp, current.rgb);
    gl_FragColor = vec4(held, 1.0);
  }
```

```ts
  override render(
    renderer: WebGLRenderer,
    inputBuffer: WebGLRenderTarget,
    outputBuffer: WebGLRenderTarget | null,
  ): void {
    const previous = this.accumulation[this.read];
    const next = this.accumulation[1 - this.read];

    this.blend.uniforms.tOld.value = previous.texture;
    this.blend.uniforms.tNew.value = inputBuffer.texture;
    this.fullscreenMaterial = this.blend;
    renderer.setRenderTarget(next);
    renderer.render(this.scene, this.camera);

    this.copy.inputBuffer = next.texture;
    this.fullscreenMaterial = this.copy;
    renderer.setRenderTarget(this.renderToScreen ? null : outputBuffer);
    renderer.render(this.scene, this.camera);

    this.read = 1 - this.read;
  }
```

```ts
export const AFTERIMAGE_DAMP: readonly [number, number] = [0.55, 0.94];
// ...
export function afterimageDamp(speed: number): number {
  const s = clamp01(speed);
  return AFTERIMAGE_DAMP[0] + (AFTERIMAGE_DAMP[1] - AFTERIMAGE_DAMP[0]) * s;
}
```

**GodRays** — `scenes/memory-room/MemoryOutlineGlow.tsx` · `useGodRaysEffect`, `LivingRoomShell.tsx` · `EndingLightPlane`

```tsx
function useGodRaysEffect(active: boolean) {
  const camera = useThree((state) => state.camera);
  const effect = useMemo(() => {
    const light = active ? endingLight.mesh : null;
    if (!light) return null;
    return new GodRaysEffect(camera, light, {
      density: 0.92,
      decay: 0.94,
      weight: 0.5,
      exposure: 0.45,
      clampMax: 1,
      samples: 40,
      kernelSize: KernelSize.SMALL,
      resolutionScale: 0.5,
      blur: true,
    });
  }, [active, camera]);
  useEffect(() => () => effect?.dispose(), [effect]);
  return effect;
}
```

```tsx
function EndingLightPlane({ color, visible }: { color: string; visible: boolean }) {
  const meshRef = useRef<Mesh>(null);
  useEffect(() => {
    setEndingLightMesh(meshRef.current);
    return () => setEndingLightMesh(null);
  }, []);
  return (
    <mesh ref={meshRef} position={[0, 0.05, -0.32]} visible={visible} frustumCulled={false}>
      <planeGeometry args={[1.5, 3.4]} />
      <meshBasicMaterial color={color} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}
```

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
| **StageLighting** | scenes/MemoryRoomScene.tsx | 조명 전환이 1.5~3초에 걸쳐 스며든다 | 광원 6개를 모두 `MathUtils.damp`(λ2.2)로 목표값에 붙인다. 창가 point light는 닿는 거리(5~9)도 같이 따라간다. 세기가 0.01 이하인 sun은 `visible`을 끄지 않고 `shadow.autoUpdate`만 꺼서 그림자맵을 다시 그리지 않는다(`sun-shadow.ts`). 광원 수가 바뀌면 모든 재질이 재컴파일되기 때문이다. 단 맵이 아직 없으면 한 번은 그린다 |
| **창을 통과한 볕** | scenes/MemoryRoomScene.tsx | 2막에 창 모양 그대로의 빛이 책상과 바닥에 떨어진다 | sun을 창 밖 위에서 쏘고, 뒷벽이 그림자로 창 개구부 모양을 만든다. 커튼이 닫혀 있으면 0.6배, 창이 없는 공간이면 0 |
| **전등 스위치와 인트로 블랙아웃** | visual-state.ts `lampScaled` | 불을 끄면 실내광만 0.26배가 되고 창빛은 남는다. 인트로는 0.18배 | `dim = 1 - lampScaled(level, lightsOn, blackout)`가 비네트와 색수차 축으로 쓰인다 |
| **공간별 밝기 오프셋** | spaces.ts | 거실·화장실은 한 단계(0.12), 안방은 두 단계 어둡게 시작한다 | `cool - lightOffset` |
| **등불** | Lantern.tsx, lantern-light.ts | 1막 후반(밝기 0.35 아래)에 손 가까이만 비추는 따뜻한 점광원. 마우스는 커서가 가리키는 바닥, 터치는 몸 앞(카메라 쪽)을 따라간다 | 매 프레임 raycaster로 y=0 평면과 교차하고 damp(λ7)로 따라간다. 광원이 머리 속에 들지 않게 몸에서 0.9 밖으로 민다. 세기와 거리는 smoothstep. 꺼져도 `visible`은 끄지 않고 세기만 0으로 내린다(광원 수가 바뀌면 모든 재질이 재컴파일된다). 세기 0.02 이하에서는 위치 계산을 건너뛴다 |
| **스위치 표시등** | LightSwitch.tsx | 인트로 어둠 속에서 표시등 점이 1.6초 주기로 숨 쉬고 벽 한 뼘을 물들인다. 로커는 딸깍 기운다 | emissive와 pointLight를 sin으로 움직인다. 인트로 동안은 글로우 등급을 `memory`로 올린다 |
| **책상 스탠드** | RoomFurniture.tsx | 누르면 전구가 데워지며 켜진다 | emissive와 pointLight를 damp(λ6) |
| **라디오 붉은 신호** | MemoryObjects.tsx, radio-signal.ts | 분기점에서 라디오가 저 혼자 불규칙하게 붉게 깜빡인다. 깨어나는 순간 탁 켜지지 않고 1.4초에 걸쳐 차오른다 | `max(0, 0.6·sin(2.3t)+0.4·sin(11.7t+1.3))²`: 대부분 0이고 가끔 봉우리가 선다. 여기에 smoothstep 램프(`radioWakeRamp`)를 곱한다 |
| **수집 완료 금빛 틴트** | MemoryObjects.tsx | 조사를 마친 물건은 회색이 아니라 금빛으로 남는다 | `WeakMap`에 원래 emissive를 보관한다. **`needsUpdate`를 걸지 않는다**(재컴파일 때문에 사진이 깜빡였다) |
| **문틈 빛, 문 금빛** | RoomShell.tsx, SpaceDoor.tsx, LivingRoomShell.tsx | 닫힌 방문 아래로 금빛 한 줄이 샌다. 열 수 있는 문은 손잡이가 빛난다 | 문틈은 emissive 상자(문이 열리면 사라진다), 방문 손잡이는 열 수 있을 때 고정 emissive 0.8. 문짝 회전과 현관문 금빛은 `approach`(지수 damp)로 따라간다 |
| **창밖 하늘** | WindowView.tsx | 해 진 직후의 하늘 그라데이션과 별 12개. 1막을 진행할수록 지평선 볕이 식고, 되돌아가지 않는다 | 4×256 캔버스 그라데이션 `CanvasTexture`를 벽 바로 뒤 판에 붙인다(무대 배경막 방식). 단조 증가하는 `outsideDecay`로 아래 세 띠를 밤색 쪽으로 lerp하고, 값이 바뀔 때 텍스처를 다시 굽는다 |

### 관련 코드

**밝기 V곡선과 두 축** — `scenes/memory-room/visual-state.ts` · `roomLightLevel`, `roomLightMix`

```ts
export function roomLightLevel({ collected, memoryTotal, recovery }: RoomLightInput): number {
  if (collected < memoryTotal) {
    const progress = memoryTotal <= 0 ? 1 : collected / memoryTotal;
    return ENTRY_LIGHT_LEVEL * (1 - progress);
  }
  return Math.min(1, Math.max(0, recovery));
}
```

```ts
const ACT2_COOL_CEILING = 0.16;
// ...
export function roomLightMix(input: RoomLightInput): RoomLightMix {
  if (input.collected < input.memoryTotal) {
    return { cool: roomLightLevel(input), warm: 0 };
  }
  const recovery = Math.min(1, Math.max(0, input.recovery));
  return { cool: ACT2_COOL_CEILING * recovery, warm: recovery };
}
```

**StageLighting** — `scenes/MemoryRoomScene.tsx` · `StageLighting`, `scenes/memory-room/sun-shadow.ts` · `sunShadowAutoUpdate`

```tsx
  useFrame((_, delta) => {
    // ...
    const follow = (current: number, goal: number) =>
      MathUtils.damp(current, goal, LIGHT_LAMBDA, delta);

    // 방 안의 빛(간접광·전등)만 스위치를 탄다. 창으로 드는 볕은 스위치와 무관하다
    ambient.intensity = follow(
      ambient.intensity,
      lampScaled(roomLightValue(ROOM_LIGHT_RAMP.ambient, cool), lightsOn, blackout),
    );
    // ...
    windowGlow.intensity = follow(
      windowGlow.intensity,
      roomLightValue(ROOM_LIGHT_RAMP.windowGlow, warm),
    );
    windowGlow.distance = follow(windowGlow.distance, roomLightValue(WINDOW_GLOW_REACH, warm));
    sun.intensity = follow(sun.intensity, sunGoal);
    // 볕이 꺼지면 그림자맵을 다시 그리지 않는다. 단 맵이 아직 없으면 그린다 (sun-shadow.ts)
    sun.shadow.autoUpdate = sunShadowAutoUpdate(sun.intensity, sun.shadow.map !== null);
  });
```

```ts
export function sunShadowAutoUpdate(intensity: number, mapReady: boolean): boolean {
  return !mapReady || intensity > 0.01;
}
```

**창을 통과한 볕** — `scenes/MemoryRoomScene.tsx` · `SUN_POSITION`, `sunGoal`, sun `<directionalLight>`

```tsx
const SUN_POSITION: [number, number, number] = [7.15, 6.5, -7.2];
const SUN_TARGET: [number, number, number] = [-4.35, 0.5, -0.4];
// ...
const CURTAIN_SUN_FACTOR = 0.6;
// ...
  const sunGoal =
    roomLightValue(ROOM_LIGHT_RAMP.sun, warm) *
    (curtainsOpen ? 1 : CURTAIN_SUN_FACTOR) *
    (sunlit ? 1 : 0);
// ...
      <directionalLight
        ref={sunRef}
        position={SUN_POSITION}
        target={sunTarget}
        color={palette.sun}
        intensity={0}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        // ...
      />
```

**전등 스위치와 인트로 블랙아웃** — `scenes/memory-room/visual-state.ts` · `lampScaled`, `scenes/MemoryRoomScene.tsx` · `dim`

```ts
export const LIGHTS_OFF_FACTOR = 0.26;
// ...
export const BLACKOUT_FACTOR = 0.18;
// ...
export function lampScaled(value: number, lightsOn: boolean, blackout = false): number {
  if (lightsOn) return value;
  return value * (blackout ? BLACKOUT_FACTOR : LIGHTS_OFF_FACTOR);
}
```

```tsx
  const blackout = viewpoint === "intro";
  const level = roomLightLevel({ collected: collectedCount, memoryTotal: MEMORY_TOTAL, recovery });
  const dim = 1 - lampScaled(level, lightsOn, blackout);
```

**공간별 밝기 오프셋** — `scenes/memory-room/spaces.ts` · `AWAY_LIGHT_OFFSET`, `scenes/MemoryRoomScene.tsx` · `cool`

```ts
const AWAY_LIGHT_OFFSET = 0.12;
// ...
    // 부모님 방은 가장 오래 닫혀 있던 공간이다. 한 단계 더 어둡다
    lightOffset: AWAY_LIGHT_OFFSET * 2,
```

```tsx
  const cool = Math.max(0, mix.cool - SPACES[space].lightOffset);
  const warm = mix.warm;
```

**등불** — `scenes/memory-room/lantern-light.ts` · `lanternAmount`, `Lantern.tsx` · `Lantern`

```ts
export const LANTERN_THRESHOLD = 0.35;
// ...
export function lanternAmount(level: number): number {
  const clamped = clamp01(level);
  if (clamped >= LANTERN_THRESHOLD) return 0;
  const t = 1 - clamped / LANTERN_THRESHOLD;
  return t * t * (3 - 2 * t);
}
```

```tsx
  useFrame((state, delta) => {
    const light = lightRef.current;
    if (!light) return;
    const goalIntensity = enabled ? lanternIntensity(level) : 0;
    light.intensity = MathUtils.damp(light.intensity, goalIntensity, LEVEL_LAMBDA, delta);
    light.distance = MathUtils.damp(light.distance, lanternReach(level), LEVEL_LAMBDA, delta);
    /*
     * 꺼진 등도 광원으로 남겨 둔다 (visible을 끄지 않는다). 광원 수가 바뀌면 화면의 모든
     * 재질이 재컴파일돼 멈칫한다. 세기 0인 광원 하나의 값보다 그 멈칫이 훨씬 비싸다.
     */
    if (light.intensity <= 0.02) return;

    let x = player.current.x;
    let z = player.current.z;
    if (followCursor) {
      state.raycaster.setFromCamera(state.pointer, state.camera);
      if (state.raycaster.ray.intersectPlane(FLOOR_PLANE, hit)) {
        x = hit.x;
        z = hit.z;
      }
    }
    if (Number.isNaN(x) || Number.isNaN(z)) return;
    // 몸 자리에 그대로 서면 광원이 머리 속에 든다 (LANTERN_BODY_CLEARANCE). 몸 밖으로 민다
    goal.x = x;
    goal.z = z;
    lanternClearOfBody(goal, player.current, state.camera.position, place);
    light.position.x = MathUtils.damp(light.position.x, place.x, FOLLOW_LAMBDA, delta);
    light.position.z = MathUtils.damp(light.position.z, place.z, FOLLOW_LAMBDA, delta);
```

**스위치 표시등** — `scenes/memory-room/LightSwitch.tsx` · `PILOT`, `LightSwitch`

```tsx
const PILOT = { base: 1.6, introBase: 1.3, introSwing: 0.5, periodS: 1.6 } as const;
const PILOT_LIGHT = { intensity: 0.45, distance: 2.6, decay: 2 } as const;
// ...
    const breath = intro
      ? PILOT.introBase +
        PILOT.introSwing *
          (0.5 + 0.5 * Math.sin((state.clock.elapsedTime / PILOT.periodS) * Math.PI * 2))
      : PILOT.base;
    pilot.emissiveIntensity = MathUtils.damp(pilot.emissiveIntensity, breath, 8, delta);
    pilotLight.intensity = MathUtils.damp(
      pilotLight.intensity,
      intro ? PILOT_LIGHT.intensity * (breath / (PILOT.introBase + PILOT.introSwing)) : 0,
      8,
      delta,
    );
// ...
      <MemoryGlowSelection
        selectionKey="light-switch"
        tier={intro ? "memory" : "prop"}
        enabled={intro || hovered || near}
        inFirstPerson="keep"
      >
```

**책상 스탠드** — `scenes/memory-room/RoomFurniture.tsx` · `DeskLamp`

```tsx
  useFrame((_, delta) => {
    const light = lightRef.current;
    const bulb = bulbRef.current;
    if (!light || !bulb) return;
    light.intensity = MathUtils.damp(light.intensity, on ? LAMP_INTENSITY : 0, 6, delta);
    bulb.emissiveIntensity = MathUtils.damp(bulb.emissiveIntensity, on ? 1.4 : 0, 6, delta);
  });
```

**라디오 붉은 신호** — `scenes/memory-room/radio-signal.ts` · `radioSignalLevel` / `radioWakeRamp`, `MemoryObjects.tsx` · `RadioSignal`

```ts
export function radioSignalLevel(time: number): number {
  const slow = Math.sin(time * 2.3);
  const fast = Math.sin(time * 11.7 + 1.3);
  const raw = slow * 0.6 + fast * 0.4;
  const gated = Math.max(0, raw);
  return gated * gated;
}

/** 깨어난 뒤 깜빡임이 제 세기에 닿기까지(초). 소리(radioWake)가 부풀어 오르는 길이와 맞춘다. */
export const RADIO_WAKE_RAMP_S = 1.4;
// ...
export function radioWakeRamp(elapsed: number): number {
  const t = Math.min(1, Math.max(0, elapsed / RADIO_WAKE_RAMP_S));
  return t * t * (3 - 2 * t);
}
```

```tsx
  useFrame((state) => {
    const time = state.clock.elapsedTime;
    if (!signaling) wokeAtRef.current = null;
    else if (wokeAtRef.current === null) wokeAtRef.current = time;
    const woke = wokeAtRef.current === null ? 0 : time - wokeAtRef.current;
    const level = radioSignalLevel(time) * radioWakeRamp(woke);
    if (materialRef.current) materialRef.current.emissiveIntensity = level * 2.2;
    if (lightRef.current) lightRef.current.intensity = signaling ? level * RADIO_SIGNAL_LIGHT : 0;
  });
```

**수집 완료 금빛 틴트** — `scenes/memory-room/MemoryObjects.tsx` · `setMaterialCollected`

```tsx
const emissiveBaselines = new WeakMap<Material, EmissiveBaseline>();
// ...
function setMaterialCollected(material: Material, collected: boolean, memoryColor: string) {
  const target = material as EmissiveMaterial;
  if (!target.emissive) return;

  let baseline = emissiveBaselines.get(material);
  if (!baseline) {
    baseline = { color: target.emissive.getHex(), intensity: target.emissiveIntensity ?? 0 };
    emissiveBaselines.set(material, baseline);
  }

  if (collected) {
    target.emissive.set(memoryColor);
    target.emissiveIntensity = COLLECTED_EMISSIVE_INTENSITY;
  } else {
    target.emissive.setHex(baseline.color);
    target.emissiveIntensity = baseline.intensity;
  }
  /*
   * needsUpdate는 걸지 않는다. emissive 색·세기는 유니폼이라 다음 프레임에
   * 그대로 반영된다. needsUpdate를 걸면 셰이더가 통째로 재컴파일되면서 수집
   * 확정 프레임(미니게임을 닫는 순간)에 그 메쉬가 한 번 비어 보인다. 액자
   * 사진이 닫을 때마다 깜빡이던 원인이다.
   */
}
```

**문틈 빛, 문 금빛** — `scenes/memory-room/RoomShell.tsx` · 문틈 `ShellBox`, `SpaceDoor.tsx` · `SpaceDoor`, `LivingRoomShell.tsx` · `FrontDoor`, `memory-motion.ts` · `approach`

```tsx
        {/* 문틈으로 새는 빛: 거실에서 오는 빛이다 (v2). 문이 열리면 틈 자체가
            사라지므로 같이 사라진다. doorReady 금빛과 헷갈리지 않게 세기를 낮게. */}
        {!doorOpen && (
          <ShellBox
            size={[1.3, 0.045, 0.05]}
            position={[0, -1.71, 0.08]}
            color={palette.memory}
            emissive={palette.memory}
            emissiveIntensity={0.9}
          />
        )}
```

```tsx
  useFrame((_, delta) => {
    const leaf = leafRef.current;
    if (!leaf) return;
    leaf.rotation.y = approach(leaf.rotation.y, open ? -ROOM_DOOR_LEAF.openAngle : 0, 4, delta);
  });
// ...
              <meshStandardMaterial
                color={palette.amber}
                emissive={palette.memory}
                emissiveIntensity={ready ? 0.8 : 0}
                roughness={0.82}
              />
```

```tsx
    glowRef.current = approach(
      glowRef.current,
      clickable && (hovered || near) ? READY_EMISSIVE : ready ? 0.3 : DORMANT_EMISSIVE,
      3,
      delta,
    );
```

```ts
export function approach(current: number, target: number, lambda: number, delta: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * delta));
}
```

**창밖 하늘** — `scenes/memory-room/WindowView.tsx` · `skyColors`, `useSkyTexture`

```tsx
export function skyColors(palette: RoomPalette, decay: number): string[] {
  const clamped = Math.min(1, Math.max(0, Number.isNaN(decay) ? 0 : decay));
  const night = new Color(palette.storm);
  const cool = (hex: string) => new Color(hex).lerp(night, clamped * DECAY_DIM).getStyle();
  // 밤 → 저녁의 파랑 → 지평선에 남은 볕. 채도가 센 ember는 쓰지 않는다: 창 하나가
  // 방보다 붉으면 방이 배경이 된다
  return [palette.abyss, palette.storm, cool(palette.clay), cool(palette.amber), cool(palette.sun)];
}

function useSkyTexture(palette: RoomPalette, decay: number): CanvasTexture {
  return useMemo(() => {
    const canvas = document.createElement("canvas");
    // 가로로는 변하지 않는 그림이라 4픽셀이면 된다
    canvas.width = 4;
    canvas.height = 256;
    const context = canvas.getContext("2d");
    if (canBake(context)) {
      const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
      const colors = skyColors(palette, decay);
      SKY_STOPS.forEach((stop, index) => {
        gradient.addColorStop(stop, colors[index]);
      });
      context.fillStyle = gradient;
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    return texture;
  }, [palette, decay]);
}
```

---

## 5. three.js: 카메라

| 효과 | 파일 | 보이는 것 | 구현 |
|---|---|---|---|
| **아이소메트릭 추적 리그** | CameraRig.tsx | 걸으면 카메라가 가슴 높이(1.5)를 따라온다. 방 모서리에서는 덜 따라와 방 밖이 덜 보인다 | 위치, 타깃, 줌을 매 프레임 damp(추적 λ3.2, 프리셋 전환 λ7)로 붙인다. 추적 한계는 열린 문간들로 닿는 공간의 **합집합 AABB**(안쪽 1.6 여유)라 문턱에서 카메라가 튀지 않는다 |
| **타이틀 드리프트와 패럴랙스** | CameraRig.tsx | 타이틀 뒤에서 디오라마가 26초 주기로 ±0.16rad 저 혼자 돌고, 마우스를 따라 2도 미만 기운다 | 오버레이가 캔버스를 덮으므로 `window pointermove`를 직접 듣는다(마우스만). 시작하면 목표가 0이 되어 같은 damp로 수렴한다 |
| **방 안으로 내려앉기** | CameraRig.tsx | 시작을 누르면 2.2초에 걸쳐 방 안으로 들어선다 | 별도 트윈 없이 그 2.2초 동안만 damp의 λ를 1.25로 낮춘다 |
| **포커스 프리셋** | layout.ts `CAMERA_PRESETS`, room-canvas-runtime.ts | 조사할 때 물건 구도로 옮겨 가며 1.45배 확대된다. 엔딩은 현관문 옆 구도 | 프리셋 오프셋을 방위각·드리프트·패럴랙스만큼 Y축으로 회전시킨다. 배율은 `focusZoomFor` |
| **크레인 샷** | CameraRig.tsx, crane-shot.ts | 화장실 하부장(`sink-cabinet`)을 붙들 때는 조사 확대보다 한 단계 깊이(1.45×1.6배), 더 느리게 밀고 들어간다 | `craneZoomFor`와 `CRANE_SHOT.lambda`(1.15)로 줌·λ만 바꾼다 |
| **사용자 궤도와 줌** | components/canvas/RoomCanvas.tsx, room-canvas-runtime.ts | 좌드래그로 ±0.5rad 회전, 휠·핀치·키로 0.45~1.8배 줌. 조사가 끝나면 사용자가 잡아 둔 값으로 돌아온다 | 드래그가 6px를 넘으면 뒤따르는 click을 캡처 단계에서 삼킨다 |
| **줌아웃할수록 공간 중앙으로** | CameraRig.tsx | 멀리 뺄수록 목표점이 공간 중심으로 옮겨 가 빈 검정이 한쪽에 쏠리지 않는다 | `lerp(player, spaceCenter, zoomOutAmount)` |
| **사건 킥과 흔들림** | CameraRig.tsx | 기억을 주우면 화면이 숨 들이쉬듯 1.2% 물러났다 돌아온다. 라디오가 깨어나면 방이 한 번 떤다 | 줌 본값은 `zoomRef`로 따로 굴리고 킥은 곱하기만 한다. 흔들림은 `lookAt` **뒤에** rotateZ/Y로 얹어 누적되지 않게 한다 |
| **1인칭 리그** | FirstPersonRig.tsx, components/canvas/use-first-person-look.ts | 인트로와 문 넘기 구간에서 눈높이 1.38, FOV 68로 둘러본다 | 자체 `PerspectiveCamera`를 `useThree().set({camera})`로 **기본 카메라와 바꿔 끼우고**, 언마운트 때 되돌린다. 시선은 damp(λ16). 직교와 원근은 보간할 수 없어 컷으로 넘기고 DOM 덮개가 그 컷을 가린다 |
| **피아노 건반 카메라** | minigames/piano-melody | 피아노를 치는 동안 건반 정면 고정 카메라 | 거실 변환으로 위치를 계산한다. 세로 화면(가로/세로 1.6 미만)에서는 가로 폭을 지키도록 FOV를 넓힌다(`keyboardFov`, 상한 100도) |
| **카메라 쪽 벽 걷어내기** | wall-culling.ts, CulledWall.tsx, wall-materials.ts | 카메라를 향한 벽 윗부분이 스러지고 굽도리만 남는다. 벽에 붙은 포스터·창·거울도 함께 사라진다 | 벽 법선과 카메라 방향의 내적에 smoothstep(0.28~0.42)을 걸고 damp(λ9)로 따라간다. 카메라가 벽 안쪽에 있거나 1인칭이면 걷지 않는다. 변화가 0.001 넘을 때만 traverse하고, 0.02 아래면 `visible=false`. `transparent`는 마운트 때 미리 켜서 재컴파일이 한 프레임에 몰리지 않게 한다 |

### 관련 코드

**아이소메트릭 추적 리그** — `scenes/memory-room/CameraRig.tsx` · `CameraRig` useFrame, `spaces.ts` · `followLimits`

```tsx
    if (follows) {
      // 자유 이동 중: 방 한가운데 고정이 아니라 플레이어를 따라본다.
      const player = playerPositionRef.current;
      const store = useMemoryRoomStore.getState();
      const limits = followLimitsFor(store);
      const center = spaceCenter(store.space);
      const toCenter = zoomOutAmount(zoomScale);
      cameraTargetGoal.set(
        MathUtils.lerp(MathUtils.clamp(player.x, limits.minX, limits.maxX), center.x, toCenter),
        FOLLOW_TARGET_Y,
        MathUtils.lerp(MathUtils.clamp(player.z, limits.minZ, limits.maxZ), center.z, toCenter),
      );
    } else {
      cameraTargetGoal.set(preset.target[0], preset.target[1], preset.target[2]);
    }
// ...
    camera.position.x = MathUtils.damp(camera.position.x, cameraPositionGoal.x, lambda, delta);
    camera.position.y = MathUtils.damp(camera.position.y, cameraPositionGoal.y, lambda, delta);
    camera.position.z = MathUtils.damp(camera.position.z, cameraPositionGoal.z, lambda, delta);
```

```ts
export function followLimits(openDoorways: readonly DoorwayId[], inset: number): Aabb2 {
  const spaces = reachableSpaces(openDoorways);
  const union = { ...SPACES[spaces[0]].bounds };
  for (const id of spaces) {
    const box = SPACES[id].bounds;
    union.minX = Math.min(union.minX, box.minX);
    union.maxX = Math.max(union.maxX, box.maxX);
    union.minZ = Math.min(union.minZ, box.minZ);
    union.maxZ = Math.max(union.maxZ, box.maxZ);
  }
  return {
    minX: union.minX + inset,
    maxX: union.maxX - inset,
    minZ: union.minZ + inset,
    maxZ: union.maxZ - inset,
  };
}
```

**타이틀 드리프트와 패럴랙스** — `scenes/memory-room/CameraRig.tsx` · `TITLE_DRIFT_*`, `PARALLAX_*`

```tsx
const TITLE_DRIFT_AMPLITUDE = 0.16;
const TITLE_DRIFT_PERIOD_S = 26;
// ...
const PARALLAX_AZIMUTH = 0.03;
const PARALLAX_LIFT = 0.12;
const PARALLAX_LAMBDA = 3;
// ...
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      pointerRef.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      pointerRef.current.y = (event.clientY / window.innerHeight) * 2 - 1;
    };
// ...
    const drift =
      following || reducedMotion
        ? 0
        : Math.sin((state.clock.elapsedTime / TITLE_DRIFT_PERIOD_S) * Math.PI * 2) *
          TITLE_DRIFT_AMPLITUDE;
// ...
      .applyAxisAngle(ORBIT_AXIS, orbitAzimuth + drift + parallax.x * PARALLAX_AZIMUTH);
```

**방 안으로 내려앉기** — `scenes/memory-room/CameraRig.tsx` · `ENTER_LAMBDA`, λ 선택

```tsx
const ENTER_LAMBDA = 1.25;
const ENTER_DURATION_S = 2.2;
// ...
    if (follows) enterElapsed.current += delta;
    const entering = follows && enterElapsed.current < ENTER_DURATION_S;
    const lambda = reducedMotion
      ? 18
      : entering
        ? ENTER_LAMBDA
        : follows
          ? FOLLOW_LAMBDA
          : crane
            ? CRANE_SHOT.lambda
            : 7;
```

**포커스 프리셋** — `scenes/memory-room/layout.ts` · `CAMERA_PRESETS`, `components/canvas/room-canvas-runtime.ts` · `focusZoomFor`

```ts
export const CAMERA_PRESETS = {
  // room.target.y를 올리면 시선 중심이 위로 가면서 방이 화면 아래쪽으로 내려온다
  room: { position: [14.2, 10.4, 15.4], target: [0.8, 2.35, 1.2] },
  /** 엔딩: 거실 끝 현관문을 열 때 (v2에서 배트 → 현관문으로 옮겨왔다). */
  ending: { position: [-12.1, 3.1, 0.95], target: [-15.95, 0.9, -1.6] },
  // ...
  radio: { position: [-1.1, 2.5, 2.1], target: [-4.05, 1.31, 0.1] },
```

```ts
export const FOCUS_ZOOM_SCALE = 1.45;

export function focusZoomFor(baseZoom: number, focused: boolean): number {
  if (!Number.isFinite(baseZoom)) return baseZoom;
  return focused ? baseZoom * FOCUS_ZOOM_SCALE : baseZoom;
}
```

**크레인 샷** — `scenes/memory-room/crane-shot.ts` · `CRANE_SHOT`, `craneZoomFor`

```ts
export const CRANE_SHOT = {
  /** 기본 배율에 곱하는 값. 조사 확대의 한 단계 위. */
  zoomScale: FOCUS_ZOOM_SCALE * 1.6,
  /** 미는 속도 (damp lambda). 1.15면 3초 남짓에 거의 닿는다. */
  lambda: 1.15,
  // ...
};
// ...
export function craneZoomFor(baseZoom: number): number {
  if (!Number.isFinite(baseZoom)) return baseZoom;
  return baseZoom * CRANE_SHOT.zoomScale;
}
```

**사용자 궤도와 줌** — `components/canvas/room-canvas-runtime.ts` · `MAX_ROOM_ORBIT`, `roomOrbitFromDrag`, `components/canvas/RoomCanvas.tsx` · 드래그 핸들러

```ts
export const MIN_ROOM_ZOOM_SCALE = 0.45;
export const MAX_ROOM_ZOOM_SCALE = 1.8;
// ...
export const MAX_ROOM_ORBIT = 0.5;
const ORBIT_DRAG_SENSITIVITY = 0.004;
const ORBIT_KEY_STEP = 0.08;
/** 이 픽셀 이상 끌면 회전으로 보고, 그 포인터의 클릭은 삼킨다. */
export const ORBIT_DRAG_THRESHOLD = 6;
```

```tsx
    const handlePointerMove = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      const travel = event.clientX - drag.x;
      if (!swallowClick && Math.abs(travel) < ORBIT_DRAG_THRESHOLD) return;
      swallowClick = true;
      applyOrbit(roomOrbitFromDrag(drag.angle, travel));
    };
    // ...
    const handleClickCapture = (event: MouseEvent) => {
      if (!swallowClick) return;
      swallowClick = false;
      event.stopPropagation();
      event.preventDefault();
    };
    // ...
    container.addEventListener("click", handleClickCapture, { capture: true });
```

**줌아웃할수록 공간 중앙으로** — `scenes/memory-room/CameraRig.tsx` · `zoomOutAmount`, `spaces.ts` · `spaceCenter`

```ts
export function zoomOutAmount(zoomScale: number): number {
  const range = 1 - MIN_ROOM_ZOOM_SCALE;
  if (range <= 0 || !Number.isFinite(zoomScale)) return 0;
  return MathUtils.clamp((1 - zoomScale) / range, 0, 1);
}
```

```ts
export function spaceCenter(id: SpaceId): { x: number; z: number } {
  const { bounds } = SPACES[id];
  return { x: (bounds.minX + bounds.maxX) / 2, z: (bounds.minZ + bounds.maxZ) / 2 };
}
```

**사건 킥과 흔들림** — `scenes/memory-room/CameraRig.tsx` · `KICK_ZOOM`, `SHAKE`

```tsx
const KICK_ZOOM = 0.012;
const KICK_LAMBDA = 5;
// ...
const SHAKE = { roll: 0.011, yaw: 0.007, lambda: 2.4, rollHz: 37, yawHz: 29 } as const;
// ...
    return subscribeEventPulse((strength) => {
      kickRef.current = Math.max(kickRef.current, strength);
      if (strength >= EVENT_PULSE.radioWake) shakeRef.current = 1;
    });
// ...
      // 본값은 따로 굴린다. 눌림을 camera.zoom에 곱한 채 다음 프레임에 읽으면 damp가 그걸 목표와의 거리로 오해한다
      const zoom = MathUtils.damp(
        zoomRef.current ?? orthographicCamera.zoom,
        zoomGoal,
        lambda,
        delta,
      );
      zoomRef.current = zoom;
      kickRef.current *= Math.exp(-KICK_LAMBDA * delta);
      if (kickRef.current < 0.001) kickRef.current = 0;
      orthographicCamera.zoom = zoom * (1 - kickRef.current * KICK_ZOOM);
      orthographicCamera.updateProjectionMatrix();
// ...
    camera.lookAt(target);

    // 떨림은 lookAt 위에 얹는다. lookAt이 프레임마다 자세를 새로 놓으므로 누적되지 않는다
    if (shakeRef.current > 0) {
      const shake = shakeRef.current;
      const time = state.clock.elapsedTime;
      camera.rotateZ(Math.sin(time * SHAKE.rollHz) * SHAKE.roll * shake);
      camera.rotateY(Math.sin(time * SHAKE.yawHz) * SHAKE.yaw * shake);
      shakeRef.current = shake * Math.exp(-SHAKE.lambda * delta);
      if (shakeRef.current < 0.001) shakeRef.current = 0;
    }
```

**1인칭 리그** — `scenes/memory-room/FirstPersonRig.tsx` · `FirstPersonRig`, `first-person.ts` · `EYE_HEIGHT` / `FIRST_PERSON_FOV`

```ts
export const EYE_HEIGHT = 1.38;
// ...
export const FIRST_PERSON_FOV = 68;
```

```tsx
  const camera = useMemo(() => {
    const perspective = new PerspectiveCamera(FIRST_PERSON_FOV, 1, 0.05, 60);
    // yaw(Y)를 먼저, pitch(X)를 나중에: 고개를 돌린 뒤 끄덕여야 수평이 안 기운다
    perspective.rotation.order = "YXZ";
    perspective.name = "first-person-camera";
    return perspective;
  }, []);
// ...
  // 기본 카메라를 바꿔 끼운다. 되돌리는 것까지가 이 리그의 몫이다
  useLayoutEffect(() => {
    let previous: PerspectiveCamera | null = null;
    set((state) => {
      previous = state.camera as PerspectiveCamera;
      return { camera };
    });
    return () => {
      if (previous) set({ camera: previous });
    };
  }, [camera, set]);

  useFrame((_, delta) => {
    const player = playerPositionRef.current;
    camera.position.set(player.x, player.y + EYE_HEIGHT, player.z);
    const smooth = smoothRef.current;
    const goal = lookRef.current;
    smooth.yaw = MathUtils.damp(smooth.yaw, goal.yaw, LOOK_LAMBDA, delta);
    smooth.pitch = MathUtils.damp(smooth.pitch, goal.pitch, LOOK_LAMBDA, delta);
    camera.rotation.set(smooth.pitch, smooth.yaw, 0);
  });
```

**피아노 건반 카메라** — `minigames/piano-melody/index.tsx` · `keyboardFov`

```tsx
const CAMERA_FOV = 40;
// ...
const CAMERA_FIT_ASPECT = 1.6;
/** 세로 화각의 상한(도). 이 위로는 화면 위아래가 눈에 띄게 휜다. */
const CAMERA_MAX_FOV = 100;

/** 화면 비율에 맞춘 세로 화각(도). 넓은 화면은 CAMERA_FOV 그대로다. */
export function keyboardFov(aspect: number): number {
  if (aspect >= CAMERA_FIT_ASPECT) return CAMERA_FOV;
  const half = Math.tan(((CAMERA_FOV / 2) * Math.PI) / 180);
  const fov = (2 * Math.atan((half * CAMERA_FIT_ASPECT) / aspect) * 180) / Math.PI;
  return Math.min(CAMERA_MAX_FOV, fov);
}
```

**카메라 쪽 벽 걷어내기** — `scenes/memory-room/wall-culling.ts` · `wallOpacity`, `CulledWall.tsx` · `CulledWall`

```ts
const FADE_START = 0.28;
const FADE_END = 0.42;
// ...
export function wallOpacity(side: WallSide, dirX: number, dirZ: number): number {
  const length = Math.hypot(dirX, dirZ);
  if (!Number.isFinite(length) || length === 0) return 1;

  const [normalX, normalZ] = WALL_NORMALS[side];
  const facing = (normalX * dirX + normalZ * dirZ) / length;
  return 1 - smoothstep(FADE_START, FADE_END, facing);
}
```

```tsx
  useLayoutEffect(() => {
    const group = groupRef.current;
    if (group) prepareWallMaterials(group);
  }, []);

  useFrame(({ camera }, delta) => {
    // ...
    const firstPerson = viewpointOf(useMemoryRoomStore.getState()) !== null;
    const goal = hidden
      ? 0
      : firstPerson
        ? 1
        : wallOpacityAt(side, camera.position.x, camera.position.z, wallCenter, wallBounds);
    let next = MathUtils.damp(opacityRef.current, goal, 9, delta);
    // damp는 목표에 수렴만 하고 닿지는 않는다. 눈에 안 보이는 나머지를 끊어야
    // 벽이 멈춘 뒤 트래버스도 같이 멈춘다.
    if (Math.abs(next - goal) < WALL_OPACITY_EPSILON) next = goal;
    opacityRef.current = next;

    // 완전히 투명해지면 아예 그리지 않는다. 투명 패스 정렬 비용과
    // 그림자 캐스팅을 같이 덜어낸다.
    group.visible = next > WALL_HIDDEN_OPACITY;
    if (!group.visible) return;
    if (Math.abs(next - appliedRef.current) < WALL_OPACITY_EPSILON) return;

    applyWallOpacity(group, next);
    appliedRef.current = next;
  });
```

---

## 6. three.js: 플레이어

| 효과 | 파일 | 보이는 것 | 구현 |
|---|---|---|---|
| **카메라 기준 이동과 충돌 슬라이드** | Player.tsx, spatial.ts, doorway-funnel.ts | WASD나 조이스틱으로 화면 기준 방향으로 걷고, 가구에 걸리면 미끄러진다. 좁은 문간 앞에서 문 쪽으로 밀면 몸이 통로 가운데로 당겨진다 | 카메라 방향을 xz로 평탄화한다. `moveThroughZones`는 축을 하나씩 푼다(x 먼저, 그다음 z). 이미 파묻힌 상자는 더 파고드는 쪽만 막는다(`blocksStep`: 열린 문짝이 몸 위에 생겨도 갇히지 않는다). 걸음은 그 전에 `funnelIntoDoorway`가 열린 문간 쪽으로 보정한다. 몸 회전은 최단각 `dampAngle` |
| **클릭 이동** | pathfind.ts, Player.tsx | 누른 곳으로 걷고, 막혀 있으면 돌아간다 | 곧장 보이면 격자를 돌지 않는다(`lineClear`). 아니면 0.25 격자에서 8방향 **A\***(대각선은 양옆이 열려 있을 때만, octile 휴리스틱)로 경로를 찾는다. 설 수 없는 목표는 1.6 이내 가장 가까운 칸으로 옮긴다. 경로는 **string pulling**으로 편다 |
| **목적지 링** | WalkMarker.tsx | 목적지 바닥에서 금빛 링이 숨 쉬다가 도착하면 사라진다 | 지수 fade와 sin 스케일 |
| **스켈레탈 믹싱** | player-animation.ts | Idle·Walk·Sit·커튼 클립이 가중치로 섞인다 | `SkeletonUtils.clone`(일반 clone은 원본 뼈대에 묶인다). **Walk는 paused 상태로 두고 이동 거리만큼 time을 스크럽해** 발이 미끄러지지 않는다. StrictMode에서 이펙트가 다시 돌면 액션을 다시 얻는다 |
| **눈 깜빡임** | player-animation.ts | 2.8~6초마다 깜빡인다 | 믹서 **뒤에** morph `eyeBlinkLeft/Right`를 적용한다. 모프가 없으면 눈 뼈 scale로 대체 |
| **커튼 당기기** | curtain-animation.ts, Player.tsx | 커튼을 잡으면 창가로 걸어가 손을 뻗고, 드래그한 만큼 클립이 스크럽된다. 놓으면 팔이 내려온다 | 클립을 paused로 두고 `action.time`에 직접 쓴다. 손이 올라온 뒤(`motion.ready`)부터 커튼이 손을 따른다 |
| **앉기와 눕기** | sit-motion.ts, seat-route.ts, Player.tsx | 책상 의자·소파·식탁 의자·피아노 걸상·침대를 누르면 **가구를 돌아** 옆·앞·뒤의 다가서는 자리까지 걸어가서 앉는다. 침대는 걸터앉았다가 발을 올리며 눕는다. 일어서면 같은 길을 거꾸로 걸어 돌아온다 | 길은 바닥 클릭과 같은 A\*(`planSeatRoute`, 후보 `approaches` 중 가장 가까운 것). 걷기(travel)와 앉기(sit) 두 구간이 겹치지 않고, 모든 전이를 smoothstep으로 처리한다. 눕기는 sit 진행도를 걸터앉기 40%·젖히기 60%로 가르고, 눕기 클립 없이 Idle을 발 원점 기준으로 눕힌다 |
| **의자 빼기** | use-seat.ts, seats.ts | 책상 의자는 앉을 때 뒤로 빠지며 살짝 틀어진다 | 좌석 데이터 `pull`만큼 damp(λ4.5). 빠진 의자 발자국은 걸어가는 길에서도 막는다 |
| **1인칭인데 거울에는 비친다** | Player.tsx, MirrorReflection.tsx | 1인칭에서는 몸이 안 보이지만 거울에는 보인다 | 몸을 `layers.set(1)`로 옮긴다. 메인 카메라는 레이어 0만 보고, 반사 카메라만 레이어 1을 켠다 |

### 관련 코드

**카메라 기준 이동과 충돌 슬라이드** — `scenes/memory-room/Player.tsx` · `LoadedPlayer` useFrame

```tsx
if (moving && !seated && !sitting) {
  camera.getWorldDirection(cameraForward);
  cameraForward.y = 0;
  cameraForward.normalize();
  cameraRight.crossVectors(cameraForward, camera.up).normalize();

  const frameDistance = PLAYER_SPEED * step;
  const movementDelta = deltaRef.current;
  movementDelta.x = (cameraRight.x * horizontal + cameraForward.x * vertical) * frameDistance;
  movementDelta.z = (cameraRight.z * horizontal + cameraForward.z * vertical) * frameDistance;
  walkBy(movementDelta);
}
```

`walkBy` 안에서 문간 보정 → 축별 충돌 → 최단각 회전 순으로 처리한다.

```tsx
// 문 앞에서 문 쪽으로 미는 걸음은 통로 가운데로 당긴다. 좁은 문간에서 문틀에 걸려 서지 않게
const funneled = funnelIntoDoorway(
  origin,
  movementDelta,
  walkable.doorways,
  funnelRef.current,
);
const result = moveThroughZones(
  origin,
  funneled,
  PLAYER_RADIUS,
  walkable.zones,
  walkable.colliders,
  resultRef.current,
);
// ...
facing.rotation.y = dampAngle(
  facing.rotation.y,
  Math.atan2(movementDelta.x, movementDelta.z),
  TURN_LAMBDA,
  delta,
);
```

```tsx
/** 최단 회전 방향으로 각도를 damp: -π/π 경계에서 한 바퀴 도는 걸 막는다. */
function dampAngle(current: number, target: number, lambda: number, delta: number): number {
  const shortest = MathUtils.euclideanModulo(target - current + Math.PI, Math.PI * 2) - Math.PI;
  return current + shortest * (1 - Math.exp(-lambda * delta));
}
```

**축 분리 슬라이드** — `scenes/memory-room/spatial.ts` · `moveThroughZones`, `blocksStep`

```ts
export function moveThroughZones(
  origin: Vec2,
  delta: Vec2,
  radius: number,
  zones: readonly Aabb2[],
  obstacles: readonly Aabb2[],
  output?: Vec2,
): Vec2 {
  const nextX = slideAxis(origin.x + delta.x, origin.z, origin.x, radius, zones, "x");
  const afterX = blocksStep(origin.x, origin.z, nextX, origin.z, radius, obstacles)
    ? origin.x
    : nextX;
  const nextZ = slideAxis(origin.z + delta.z, afterX, origin.z, radius, zones, "z");
  const afterZ = blocksStep(afterX, origin.z, afterX, nextZ, radius, obstacles) ? origin.z : nextZ;
  // ...
}
```

```ts
for (let index = 0; index < obstacles.length; index += 1) {
  const box = obstacles[index];
  if (!intersects(toX, toZ, radius, box)) continue;
  if (!intersects(fromX, fromZ, radius, box)) return true;
  if (distanceSquaredToBox(toX, toZ, box) < distanceSquaredToBox(fromX, fromZ, box)) return true;
}
return false;
```

**문간 빨려 들어가기** — `scenes/memory-room/doorway-funnel.ts` · `funnelIntoDoorway`

```ts
if (pos < min - APPROACH || pos > max + APPROACH) continue;
if (side < sideMin - SIDE_MARGIN || side > sideMax + SIDE_MARGIN) continue;
if (Math.abs(along) < length * MIN_ALONG_SHARE) continue;
// 문간 밖에서는 문 쪽으로 걸을 때만. 문을 등지고 걸어 나가는 몸은 놓아준다
const inside = pos >= min && pos <= max;
if (!inside && Math.sign(along) !== Math.sign((min + max) / 2 - pos)) continue;

const offset = (sideMin + sideMax) / 2 - side;
const pull = Math.sign(offset) * Math.min(Math.abs(offset), length * MAX_PULL);
const kept = Math.sign(across) === -Math.sign(offset) ? across * AWAY_KEEP : across;
const nextAcross = Math.max(-length, Math.min(length, kept + pull));
```

**클릭 이동 (A\*)** — `scenes/memory-room/pathfind.ts` · `search`

```ts
const heuristic = (column: number, row: number) => {
  const dx = Math.abs(column - goal.column);
  const dz = Math.abs(row - goal.row);
  return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz);
};
// ...
for (const [dc, dr, cost] of NEIGHBORS) {
  const nextColumn = column + dc;
  const nextRow = row + dr;
  if (!isOpen(grid, nextColumn, nextRow)) continue;
  if (
    dc !== 0 &&
    dr !== 0 &&
    (!isOpen(grid, column + dc, row) || !isOpen(grid, column, row + dr))
  ) {
    continue;
  }
  const next = index(nextColumn, nextRow);
  if (closed[next]) continue;
  const tentative = gScore[current] + cost;
  if (tentative >= gScore[next]) continue;
  cameFrom[next] = current;
  gScore[next] = tentative;
  fScore[next] = tentative + heuristic(nextColumn, nextRow);
  if (!open.includes(next)) open.push(next);
}
```

**string pulling** — `scenes/memory-room/pathfind.ts` · `findPath`

```ts
// 곧장 보이면 격자를 돌 이유가 없다
if (lineClear(start, goalPoint, radius, zones, obstacles)) return [goalPoint];

const cells = search(grid, startCell, goalCell);
if (!cells) return null;
const points = [start, ...cells.map((cell) => pointOf(grid, cell.column, cell.row)), goalPoint];

// 보이는 데까지 한 번에: 현재 점에서 가장 먼 보이는 점으로 건너뛴다
const waypoints: Vec2[] = [];
let at = 0;
while (at < points.length - 1) {
  let farthest = at + 1;
  for (let candidate = points.length - 1; candidate > at + 1; candidate -= 1) {
    if (lineClear(points[at], points[candidate], radius, zones, obstacles)) {
      farthest = candidate;
      break;
    }
  }
  waypoints.push(points[farthest]);
  at = farthest;
}
```

**목적지 링** — `scenes/memory-room/WalkMarker.tsx` · `WalkMarker`

```tsx
useFrame((state, delta) => {
  // ...
  const goal = walkTarget ? 1 : 0;
  opacityRef.current += (goal - opacityRef.current) * (1 - Math.exp(-FADE_LAMBDA * delta));
  material.opacity = opacityRef.current * 0.85;
  group.visible = opacityRef.current > 0.02;
  const pulse =
    1 + PULSE_SCALE * Math.sin((state.clock.elapsedTime / PULSE_PERIOD_S) * Math.PI * 2);
  ring.scale.setScalar(pulse);
});
```

**스켈레탈 믹싱** — `scenes/memory-room/player-animation.ts` · `createPlayerRig`, `startPlayerRig`, `updatePlayerRig`

```ts
// Object3D.clone leaves skinned meshes bound to the cached source skeleton.
const root = clone(scene);
// ...
const idle = action("Idle");
const walk = action("Walk");
const sit = action("Sit");
// ...
walk.paused = true;
sit.paused = true;
```

```ts
export function startPlayerRig(rig: PlayerRig) {
  // Strict Mode re-runs effect setup after cleanup; reacquire uncached actions.
  rig.idle = rig.mixer.clipAction(rig.idle.getClip()).play();
  rig.walk = rig.mixer.clipAction(rig.walk.getClip()).play();
  rig.sit = rig.mixer.clipAction(rig.sit.getClip()).play();
  // ...
}
```

```ts
const sitWeight = Math.max(0, Math.min(1, sitting));
const walkWeight = Math.max(0, Math.min(1, walking)) * (1 - sitWeight);
const cycle = phase / (Math.PI * 2);
rig.walk.time = (((cycle % 1) + 1) % 1) * rig.walk.getClip().duration;
rig.idle.setEffectiveWeight((1 - sitWeight - walkWeight) * (1 - curtainWeight));
rig.walk.setEffectiveWeight(walkWeight * (1 - curtainWeight));
rig.sit.setEffectiveWeight(sitWeight * (1 - curtainWeight));
rig.mixer.update(delta);
```

`phase`는 Player가 실제로 간 거리로 올린다(`phaseRef.current += STEP_RATE * traveled`).

**눈 깜빡임** — `scenes/memory-room/player-animation.ts` · `updatePlayerRig`

```ts
// Apply after the mixer so locomotion cannot overwrite eye scale.
const blink = rig.blink;
blink.elapsed += Math.max(0, delta);
const time = blink.elapsed - blink.next;
let closed = 0;
if (time >= 0 && time < 0.21) {
  const progress = time < 0.07 ? time / 0.07 : time < 0.1 ? 1 : (0.21 - time) / 0.11;
  closed = progress * progress * (3 - 2 * progress);
} else if (time >= 0.21) {
  blink.elapsed = 0;
  blink.next = 2.8 + Math.random() * 3.2;
}
for (const eyelid of blink.eyelids) eyelid.influences[eyelid.index] = closed;
if (blink.eyelids.length === 0) {
  for (const eye of blink.eyes) eye.scale.set(1 + closed * 0.12, 1 - closed * 0.94, 1);
}
```

**커튼 당기기** — `scenes/memory-room/curtain-animation.ts` · `advanceCurtainMotion`

```ts
motion.ready = motion.elapsed >= REACH_END + GRIP_SECONDS;
if (!motion.ready) {
  // Reach first, then move continuously to the grip at the curtain's current opening.
  const grip = Math.max(0, (motion.elapsed - REACH_END) / GRIP_SECONDS);
  const eased = grip * grip * (3 - 2 * grip);
  const gripTime = PULL_START + (PULL_END - PULL_START) * motion.shown;
  motion.time = Math.min(motion.elapsed, REACH_END) + (gripTime - REACH_END) * eased;
  return;
}
motion.shown = held
  ? progress
  : motion.shown + (progress - motion.shown) * (1 - Math.exp(-5.5 * step));
motion.time = PULL_START + (PULL_END - PULL_START) * motion.shown;
```

`scenes/memory-room/player-animation.ts` · `updatePlayerRig`: paused 클립에 시간을 직접 쓴다.

```ts
for (const side of ["left", "right"] as const) {
  const action = rig.curtain[side];
  action.setEffectiveWeight(curtainPose?.side === side ? curtainWeight : 0);
  if (curtainPose?.side === side)
    action.time = Math.min(action.getClip().duration - 0.001, Math.max(0, curtainPose.time));
}
```

**앉기와 눕기** — `scenes/memory-room/sit-motion.ts` · `advanceSitPhases`, `liePhasesOf`

```ts
if (seated) {
  travel = travelSeconds <= 0 ? 1 : Math.min(1, travel + step / travelSeconds);
  if (travel >= 1) sit = Math.min(1, sit + step / sitSeconds);
} else {
  sit = Math.max(0, sit - step / sitSeconds);
  if (sit <= 0) travel = travelSeconds <= 0 ? 0 : Math.max(0, travel - step / travelSeconds);
}
```

```ts
export function liePhasesOf(sit: number, out: LiePhases): LiePhases {
  const clamped = Math.max(0, Math.min(1, sit));
  out.perch = Math.min(1, clamped / LIE_PERCH_SHARE);
  out.recline = Math.max(0, (clamped - LIE_PERCH_SHARE) / (1 - LIE_PERCH_SHARE));
  return out;
}
```

`scenes/memory-room/seat-route.ts` · `planSeatRoute`: 다가서는 자리 후보마다 A\*를 돌려 가장 짧은 길을 고른다.

```ts
const blocked = withPulledSeat(seat, obstacles);
let best: SeatRoute | null = null;
for (const spot of approachesOf(seat)) {
  const path = findPath(start, spot, radius, zones, blocked);
  if (!path) continue;
  const points = [{ x: start.x, z: start.z }, ...path.slice(0, -1), { x: spot.x, z: spot.z }];
  const length = lengthOf(points);
  // ...
}
```

`scenes/memory-room/Player.tsx` · `LoadedPlayer` useFrame: 걷는 구간은 길을 따라가고, 앉는 구간에서 걸터앉는 자리와 눕는 자리로 옮긴다.

```tsx
const walked = pointAlong(parked.route, eased, routePointRef.current);
// ...
const nextX = lerp(lerp(walked.x, perchX, settle01), anchor.x, recline01);
const nextZ = lerp(lerp(walked.z, perchZ, settle01), anchor.z, recline01);
// ...
group.position.y = lerp(lerp(0, perchY, settle01), bodyY, recline01);
// ...
if (lieRef.current) {
  lieRef.current.rotation.x = lying ? -(Math.PI / 2 - LIE_TILT) * recline01 : 0;
}
// 젖히는 동안 다리를 편다. 다 누우면 Idle을 눕힌 자세다.
sitWeight = settle01 * (1 - recline01);
```

**의자 빼기** — `scenes/memory-room/use-seat.ts` · `useSeatPull`

```ts
useFrame((_, delta) => {
  const group = groupRef.current;
  if (!group || !pull) return;
  const lambda = reducedMotion ? REDUCED_LAMBDA : PULL_LAMBDA;
  const { x, z, rotationY } = baseRef.current;
  const out = occupied ? 1 : 0;
  group.position.x = MathUtils.damp(group.position.x, x + pull.x * out, lambda, delta);
  group.position.z = MathUtils.damp(group.position.z, z + pull.z * out, lambda, delta);
  group.rotation.y = MathUtils.damp(group.rotation.y, rotationY + pull.turn * out, lambda, delta);
});
```

**1인칭인데 거울에는 비친다** — `scenes/memory-room/Player.tsx` · `LoadedPlayer`

```tsx
const firstPerson = useMemoryRoomStore(selectViewpoint) !== null;
useEffect(() => {
  rig.root.traverse((object) => object.layers.set(firstPerson ? MIRROR_ONLY_LAYER : 0));
}, [rig, firstPerson]);
```

`scenes/memory-room/MirrorReflection.tsx` · `MirrorReflection`

```tsx
mirror.getReflectionCamera(camera).layers.enable(MIRROR_ONLY_LAYER);
render.call(mirror, renderer, scene, camera, ...rest);
```

---

## 7. three.js: 파티클과 빛 볼륨

세 파티클 모두 `points` + 커스텀 ShaderMaterial이다. 움직임은 **정점 셰이더에서 시간의 함수로** 계산하므로 CPU는 uniform만 올린다.

| 효과 | 파일 | 보이는 것 | 구현 |
|---|---|---|---|
| **창빛 먼지** | DustMotes.tsx | 창에서 내리꽂히는 빛줄기 안에서만 반짝이는 먼지 240개. 커서가 지나가면 비켜났다가 돌아오고, 어두울수록 천천히 돌아온다 | 상승(mod로 감아 도는 band), 두 주파수 흔들림, 명멸. 커서 밀어내기는 NDC에서 aspect를 보정해 계산한다. 크기는 세제곱 분포라 가끔 흐린 보케가 섞인다. Additive, depthWrite off |
| **창빛 광선판** | WindowLight.tsx | 커튼 틈에서 양옆으로 열리는 빛 판이 흐른다 | 비스듬한 평면 한 장에 두 옥타브 fbm을 두 겹으로 흘린다. 커튼 틈 `slit(uOpen)` smoothstep. 거의 0이면 `material.visible=false` |
| **기억 수집 버스트** | MemoryBurst.tsx | 조사를 마치는 순간 금빛 티끌 140개가 터졌다가 **화면 오른쪽 위 수첩 손잡이 쪽으로 쓸려 간다** | 반구 방향 attribute, ease-out scatter, pull². 쓸려 가는 방향은 카메라 행렬의 right·up을 섞은 월드 벡터 |
| **방 둘레 티끌** | RoomSurroundings.tsx | 디오라마 바깥 허공에 느린 금빛 티끌 320개 | DustMotes와 같은 셰이더 구조이고 조명과 무관하다 |

### 관련 코드

**창빛 먼지** — `scenes/memory-room/DustMotes.tsx` · `VERTEX_SHADER`

```glsl
// 제 구간 안에서만 오르내린다. mod로 감아 돌리면 위로 빠져나간 먼지가
// 저절로 아래에서 다시 올라온다. 빛줄기 밖으로 새지 않는다.
float travel = mod(pos.y - aBand.x + uTime * aRise, aBand.y);
pos.y = aBand.x + travel;

// 주파수가 다른 두 흔들림을 겹친다. 하나만 쓰면 전부 같은 박자로 흔들려 기계적이다.
pos.x += sin(uTime * aDrift + aPhase) * uSway;
pos.z += cos(uTime * aDrift * 0.61 + aPhase * 1.7) * uSway * 0.55;

gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);

// ...
vec2 ndc = gl_Position.xy / gl_Position.w;
vec2 away = (ndc - uPointer) * vec2(uAspect, 1.0);
float dist = length(away);
float push = (1.0 - smoothstep(0.0, uPushRadius, dist)) * uPush;
ndc += normalize(away + vec2(0.0001, 0.0)) * push / vec2(uAspect, 1.0);
gl_Position.xy = ndc * gl_Position.w;
```

`createMotes`(크기 분포)와 useFrame(커서 추적 속도가 밝기를 탄다):

```tsx
// 세제곱이라 큰 알갱이는 드물게 나온다. 큰 만큼 흐려야 보케로 읽힌다.
const bulk = Math.random() ** 3;
sizes[index] = MOTE_MIN_SIZE + bulk * MOTE_SIZE_RANGE;
glows[index] = lerp(1, 0.32, bulk);
```

```tsx
const pointer = material.uniforms.uPointer.value as Vector2;
const lambda = MathUtils.lerp(
  POINTER_LAMBDA[0],
  POINTER_LAMBDA[1],
  MathUtils.clamp(settle, 0, 1),
);
pointer.x = MathUtils.damp(pointer.x, state.pointer.x, lambda, delta);
pointer.y = MathUtils.damp(pointer.y, state.pointer.y, lambda, delta);
```

**창빛 광선판** — `scenes/memory-room/WindowLight.tsx` · `FRAGMENT_SHADER`, `WindowLight`

```glsl
float fbm(vec2 p) {
  return noise(p) * 0.65 + noise(p * 2.3 + 7.1) * 0.35;
}

void main() {
  // v=1이 창가(위), v=0이 방 안 끝(아래)
  float head = vUv.y;
  float along = smoothstep(0.0, 0.7, head);
  // 결은 판의 길이 방향으로 흐른다. 두 겹의 속도·주기가 달라야 한 덩어리로 안 흐른다
  float rays = 0.55 + 0.45 * fbm(vec2(vUv.x * 5.0 + uTime * 0.02, head * 2.2 - uTime * 0.09));
  rays *= 0.7 + 0.3 * fbm(vec2(vUv.x * 11.0 - uTime * 0.05, head * 4.0 - uTime * 0.16));
  // 판의 좌우 끝을 부드럽게: 광선이 네모난 판으로 읽히면 안 된다
  float edge = smoothstep(0.0, 0.22, vUv.x) * smoothstep(1.0, 0.78, vUv.x);
  // 커튼 틈: 가운데서 양옆으로 열린다. 조금 열린 커튼은 가는 빛줄기 하나다
  float gap = mix(0.04, 0.5, uOpen);
  float slit = smoothstep(0.5 - gap - 0.08, 0.5 - gap + 0.04, vUv.x)
             * smoothstep(0.5 + gap + 0.08, 0.5 + gap - 0.04, vUv.x);
  float alpha = along * rays * edge * slit * uOpacity;
  // ...
}
```

```tsx
uniforms.uOpen.value = MathUtils.damp(uniforms.uOpen.value, open, 8, delta);
const goal = open > 0.02 ? MAX_SHAFT_OPACITY * intensity * (0.35 + 0.65 * open) : 0;
uniforms.uOpacity.value = MathUtils.damp(uniforms.uOpacity.value, goal, 3, delta);
material.visible = uniforms.uOpacity.value > 0.002;
```

**기억 수집 버스트** — `scenes/memory-room/MemoryBurst.tsx` · `VERTEX_SHADER`, `MemoryBurst`

```glsl
float u = clamp(uTime / uDuration, 0.0, 1.0);
// 터져 나오는 구간: 빠르게 나갔다가 서고(ease-out), 낱알마다 조금씩 늦게 출발한다
float delay = aSeed * 0.12;
float scatter = 1.0 - pow(1.0 - clamp((u - delay) * 2.2, 0.0, 1.0), 3.0);
// 쓸려 가는 구간: 뒤로 갈수록 세게 끌려간다
float pull = pow(smoothstep(0.3, 1.0, u), 2.0);
vec3 pos = uOrigin
  + aDir * scatter * BURST_SPREAD * (0.6 + 0.4 * aSeed)
  + vec3(0.0, 0.35 * u, 0.0)
  + uPull * pull * BURST_PULL * (0.7 + 0.3 * aSeed);
```

```tsx
camera.matrixWorld.extractBasis(cameraRight, cameraUp, pull);
pull.copy(cameraRight).multiplyScalar(0.8).addScaledVector(cameraUp, 0.6).normalize();
(uniforms.uPull.value as Vector3).copy(pull);
elapsed.current = 0;
```

반구 방향 attribute는 `createBurst`에서 한 번 만든다.

```tsx
// 위로 치우친 반구: 바닥으로 파고드는 티끌은 없다
const theta = Math.random() * Math.PI * 2;
const lift = 0.15 + Math.random() * 0.85;
const ring = Math.sqrt(1 - lift * lift);
dirs[index * 3] = Math.cos(theta) * ring;
dirs[index * 3 + 1] = lift;
dirs[index * 3 + 2] = Math.sin(theta) * ring;
```

**방 둘레 티끌** — `scenes/memory-room/RoomSurroundings.tsx` · `OuterDrift`

```glsl
// 제 구간 안에서만 오른다. mod로 감으면 위로 빠져나간 티끌이 저절로 아래에서 돌아온다.
float travel = mod(pos.y - aBand.x + uTime * aRise, aBand.y);
pos.y = aBand.x + travel;

pos.x += sin(uTime * aSway + aPhase) * 0.55;
pos.z += cos(uTime * aSway * 0.63 + aPhase * 1.7) * 0.4;
```

```tsx
useFrame((state) => {
  const material = materialRef.current;
  if (!material) return;
  material.uniforms.uTime.value = state.clock.elapsedTime;
});
```

---

## 8. three.js: 반사와 렌더 타깃

| 효과 | 파일 | 보이는 것 | 구현 |
|---|---|---|---|
| **전신거울** | MirrorReflection.tsx | 방과 캐릭터가 실시간으로 비친다. 유리에 빛줄기 두 개가 얹혀 어두운 방에서도 유리로 읽힌다 | three `Reflector`(512²). **`onBeforeRender`를 감싸** `overrideMaterial` 렌더(AO·아웃라인 패스)와 메인 카메라가 아닌 렌더를 건너뛴다. 이게 없으면 반사 하나가 프레임 비용을 서너 배로 만든다. 3인칭에서는 2프레임에 한 번 그린다(`renderer.info.render.frame` 기준) |
| **slit-scan 거울** | SlitScanMirror.tsx, slit-scan.ts | 30일 만에 보는 얼굴이 **세로줄마다 시간이 어긋나** 비친다(오른쪽일수록 최대 0.6초 전). 2막 볕이 오를수록 줄이 맞아 보통 거울이 된다 | Reflector(256²) 출력을 직교 카메라로 한 번 더 그려 **유리 uv 이미지**로 만들고, 12장 HalfFloat RT **링버퍼**에 3프레임마다 넣는다. 유리를 24열로 갈라 열마다 지연 칸을 고른다. 샘플러 배열 동적 인덱싱은 드라이버마다 틀릴 수 있어 **if 사슬을 코드로 생성**한다. 프레임 카운터는 `renderer.info` 대신 useFrame 카운터(render 호출마다 올라서 시간축이 틀어진다). heavy가 아니면 금속판 폴백 |
| **모니터 도트 반사** | DotReflection.tsx, dot-screen.ts | 꺼진 모니터에 방이 **인광체 도트 격자**로 뭉개져 비친다. 어두울수록 도트가 굵고(22개), 되찾을수록 촘촘해진다(88개) | Reflector 셰이더 문자열을 **anchor 치환으로 패치**한다. 로컬 uv varying을 추가하고(Reflector의 vUv는 투영 좌표라 격자가 미끄러진다) `fract(uv*uDots)` 원형 마스크를 건다. anchor가 없으면 패치 없이 폴백. heavy가 아니면 컴포넌트를 아예 마운트하지 않는다 |
| **앰플 유리 굴절** | Ampoule.tsx | 들어 올린 앰플 너머가 굴절돼 보인다 | `MeshPhysicalMaterial` transmission은 `refractive`일 때만 남긴다. 앰플 집기 미니게임(카메라 고정 판)은 heavy일 때, 3D 인스펙트 판은 늘 켠다. 그 밖(방 안 서랍 모델)에서는 transmission 0, opacity 0.4 |

### 관련 코드

**전신거울** — `scenes/memory-room/MirrorReflection.tsx` · `MirrorReflection`

```tsx
const mirror = new Reflector(new PlaneGeometry(width, height), {
  // 거울은 조금 어둡고 차갑다. 반사가 방보다 밝으면 유리가 아니라 창이다
  color: palette.daylight,
  textureWidth: REFLECTION_SIZE,
  textureHeight: REFLECTION_SIZE,
  clipBias: 0.003,
});
mirror.name = "mirror-reflection";
const render = mirror.onBeforeRender;
let renderedFrame = Number.NEGATIVE_INFINITY;
mirror.onBeforeRender = (renderer: WebGLRenderer, scene: Scene, camera: Camera, ...rest) => {
  if (scene.overrideMaterial !== null || camera !== get().camera) return;
  const frame = renderer.info.render.frame;
  const interval = firstPersonRef.current ? 1 : THIRD_PERSON_INTERVAL;
  if (frame - renderedFrame < interval) return;
  renderedFrame = frame;
  mirror.getReflectionCamera(camera).layers.enable(MIRROR_ONLY_LAYER);
  render.call(mirror, renderer, scene, camera, ...rest);
};
```

**slit-scan 거울** — `scenes/memory-room/SlitScanMirror.tsx` · `FRAME_LOOKUP`, `FRAGMENT_SHADER`

```ts
const FRAME_LOOKUP = Array.from(
  { length: RING },
  (_, i) => `    if (index == ${i}) return texture2D(uFrames[${i}], uv);`,
).join("\n");
```

```glsl
uniform sampler2D uFrames[${RING}];
uniform int uWrite;     // 다음에 쓸 칸. 가장 최근 프레임은 그 앞 칸
uniform float uSmear;   // 시간차 폭 (0: 보통 거울, 1: 오른쪽 끝이 링에서 가장 오래된 칸)
// ...
vec4 frameAt(int index, vec2 uv) {
${FRAME_LOOKUP}
  return texture2D(uFrames[${RING - 1}], uv);
}

void main() {
  // ...
  float column = clamp(floor(vUv.x * ${COLUMNS}.0), 0.0, ${COLUMNS - 1}.0);
  float spread = column / ${COLUMNS - 1}.0;
  int delay = int(floor(spread * clamp(uSmear, 0.0, 1.0) * ${RING - 1}.0 + 0.5));
  int index = (uWrite + ${RING - 1} - delay) % ${RING};

  // 링의 프레임은 Reflector 재질이 색까지 얹어 둔 선형 색이다. 여기서는 읽어 내기만 한다
  gl_FragColor = vec4(frameAt(index, vUv).rgb, 1.0);
  // ...
}
```

`buildRing`: Reflector의 원래 재질로 유리와 같은 판을 직교 카메라에 그려 링에 편다.

```ts
new WebGLRenderTarget(REFLECTION_SIZE, REFLECTION_SIZE, {
  depthBuffer: false,
  stencilBuffer: false,
  type: HalfFloatType,
}),
// ...
const scene = new Scene();
const quad = new Mesh(geometry, reflectorMaterial);
quad.frustumCulled = false;
scene.add(quad);
const camera = new OrthographicCamera(-width / 2, width / 2, height / 2, -height / 2, 0.1, 10);
camera.position.z = 1;
```

`SlitScanGlass`: 같은 가드에 화장실 여부와 useFrame 카운터 간격을 더한다.

```tsx
reflector.onBeforeRender = (renderer: WebGLRenderer, scene: Scene, camera: Camera, ...rest) => {
  if (scene.overrideMaterial !== null || camera !== get().camera) return;
  const state = stateRef.current;
  if (!state.inBathroom) return;
  if (state.frame - state.renderedFrame < RENDER_INTERVAL) return;
  state.renderedFrame = state.frame;

  reflector.getReflectionCamera(camera).layers.enable(MIRROR_ONLY_LAYER);
  render.call(reflector, renderer, scene, camera, ...rest);

  if (!state.primed) {
    // 빈 링은 검다. 처음 들어선 0.6초 동안 오른쪽 줄이 검게 비는 대신 첫 프레임으로 채운다
    for (const target of ring.targets) ring.capture(renderer, target);
    state.primed = true;
    state.write = 0;
  } else {
    ring.capture(renderer, ring.targets[state.write]);
    state.write = (state.write + 1) % RING;
  }
  material.uniforms.uWrite.value = state.write;
};
```

```tsx
useFrame((_, delta) => {
  const state = stateRef.current;
  state.frame += 1;
  const smear = mirror.material.uniforms.uSmear;
  smear.value = MathUtils.damp(smear.value, smearFromWarm(state.warm), SMEAR_LAMBDA, delta);
});
```

`scenes/memory-room/slit-scan.ts` · `slitFrameIndex`: 셰이더와 같은 식을 테스트용 순수 함수로 둔다.

```ts
const clampedColumn = Math.min(Math.max(0, Math.floor(column)), columns - 1);
const spread = columns <= 1 ? 0 : clampedColumn / (columns - 1);
const width = Math.min(1, Math.max(0, smear));
const delay = Math.round(spread * width * (ringSize - 1));
return (((writeIndex - 1 - delay) % ringSize) + ringSize) % ringSize;
```

**모니터 도트 반사** — `scenes/memory-room/DotReflection.tsx` · `patchDotScreen`

```ts
const vertexAnchor = "varying vec4 vUv;";
const vertexAssign = "vUv = textureMatrix * vec4( position, 1.0 );";
const fragmentAnchor = "varying vec4 vUv;";
const fragmentOutput = "gl_FragColor = vec4( blendOverlay( base.rgb, color ), 1.0 );";
if (
  !vertexShader.includes(vertexAnchor) ||
  !vertexShader.includes(vertexAssign) ||
  !fragmentShader.includes(fragmentAnchor) ||
  !fragmentShader.includes(fragmentOutput)
) {
  return { vertexShader, fragmentShader, patched: false };
}
// ...
      .replace(
        fragmentOutput,
        [
          "vec3 reflected = blendOverlay( base.rgb, color );",
          // 셀 중심에서의 거리. 0.25 안쪽이 꽉 찬 인광체, 0.5(셀 모서리)에서 사라진다
          "float cellDistance = length( fract( vLocalUv * uDots ) - 0.5 );",
          "float dotMask = smoothstep( 0.5, 0.25, cellDistance );",
          "gl_FragColor = vec4( mix( reflected * uBetweenDots, reflected, dotMask ) * uGain, 1.0 );",
        ].join("\n\t\t\t"),
      ),
```

`DotReflection`(게이트)과 `DotGlass` useFrame(밝기 → 도트 수):

```tsx
export function DotReflection(props: DotReflectionProps) {
  if (!props.enabled) return null;
  return <DotGlass {...props} />;
}
```

```tsx
dots.x = MathUtils.damp(dots.x, dotsForLevel(level), LEVEL_LAMBDA, delta);
dots.y = dotsAcrossHeight(dots.x);
```

`scenes/memory-room/dot-screen.ts` · `dotsForLevel`

```ts
export function dotsForLevel(level: number): number {
  const t = clamp01(level);
  return DOT_SCREEN_DOTS.coarse + (DOT_SCREEN_DOTS.fine - DOT_SCREEN_DOTS.coarse) * t;
}
```

**앰플 유리 굴절** — `scenes/memory-room/Ampoule.tsx` · `LoadedAmpoule`

```tsx
if (material.name === GLASS_MATERIAL && material instanceof MeshStandardMaterial) {
  material.emissive.set(palette.memory);
  material.emissiveIntensity = 0;
  glassMaterial = material;
  if (!refractive && material instanceof MeshPhysicalMaterial) {
    material.transmission = 0;
    material.transparent = true;
    material.opacity = 0.4;
    material.depthWrite = false;
  }
}
```

`minigames/ampoule-pickup/index.tsx` · `refractive` 게이트

```tsx
/*
 * 굴절 유리 (docs/visual-experiments.md 11장): 들어 올린 앰플 너머로 냉장고 안이 굴절돼
 * 보인다. transmission은 씬을 렌더 타깃에 한 번 더 그리는 heavy 효과라, 카메라가
 * 붙박이인 이 판에서만, 예산이 full인 기기에서만 켠다.
 */
const refractive = useEffectEnabled("heavy");
```

---

## 9. three.js: 커스텀 셰이더와 재질 패치

| 효과 | 파일 | 보이는 것 | 구현 |
|---|---|---|---|
| **세면대 물 파문** | SinkWater.tsx, water-ripple.ts | 고인 물이 열쇠(`parents-key`)를 집는 순간 파문으로 번지고, 바닥 배수구가 굴절로 흔들리다 잔잔해진다 | RT 없는 ShaderMaterial 한 장. 배수구 바닥을 **셰이더가 절차적으로 그린다**. `cos(dist*70-age*21)` 파문. **가짜 굴절**은 바닥 샘플 좌표를 기울기만큼 민다. 기울인 법선으로 스펙큘러를 만든다. 진폭·파두 반경은 CPU 순수 함수가 uniform으로 넘긴다 |
| **이불 호흡** | BedModel.tsx | 누가 누워 있을 때만 이불이 숨 쉬듯 일렁인다 | `onBeforeCompile`로 `begin_vertex` 뒤에 sin 변위를 넣는다. uniform 객체를 바깥 useMemo에서 셰이더에 그대로 꽂는다 |
| **이불 접힘** | BedModel.tsx | 침대를 누르면 이불이 발치로 접힌다 | shape key `folded`를 damp. **StrictMode 대책**으로 메쉬를 ref가 아니라 useMemo 반환값에 담는다 |
| **컵라면 물때** | FurnitureModel.tsx, StudentProps.tsx, BathroomStains.tsx | 방이 어두워질수록 용기에 물때가 자란다 | 화장실 물때와 같은 반응확산 텍스처를 방 밝기에 따른 스텝 수(`stainStepsForLevel`, 40스텝 단위)로 굽는다. `map_fragment` 뒤에 `diffuseColor.rgb *= texture2D(uStain,vUv)`를 넣는다. map이 없는 재질도 `USE_UV`를 강제로 켠다 |
| **화장실 물때** | BathroomStains.tsx, lib/effects/reaction-diffusion.ts | 타일에 대비가 낮은 곰팡이 무늬 | CPU **Gray-Scott 반응확산**(96², 320스텝, 결정적 시드). `MultiplyBlending` + `premultipliedAlpha` 판으로 얹는다 |
| **악보 잉크가 모인다** | PianoSheet.tsx, sheet-ink.ts | 찢어진 악보 조각을 들고 거실에 들어서면, 물에 번진 마디가 1.5초에 걸쳐 거꾸로 음표로 모인다 | Canvas 2D `ctx.filter = blur(11px*(1-g))`로 다시 칠하고 `needsUpdate`. 모임 정도가 바뀐 프레임에만 다시 굽는다 |
| **3D 표면의 글자** | minigames/piano-melody, components/canvas/DialDrums.tsx, components/canvas/inspect-textures.ts | 건반 계이름과 인스펙트 면의 글자는 언어를 따른다. 드럼 숫자는 팔레트와 본문 글꼴을 따른다 | 모두 CanvasTexture로 굽는다. 언어·팔레트·글꼴이 바뀌면 다시 굽고 dispose |
| **재구성 연출** | WireframeReveal.tsx, reconstruction.ts | 라디오 재점화와 화장실·안방 첫 진입 때 보이는 공간 전체가 0.45초간 **와이어프레임으로 풀렸다가** 면으로 돌아온다 | `scene.traverse`로 보이는 메쉬의 Standard·Physical·Basic 재질에 `wireframe=true`를 켰다가 되돌린다. settle 값(0.55초)은 ScreenTransition으로 넘긴다 |

### 관련 코드

**세면대 물 파문** — `scenes/memory-room/SinkWater.tsx` · `FRAGMENT_SHADER`

```glsl
float bottomShade(vec2 p) {
  float r = length(p);
  float disc = smoothstep(0.072, 0.064, r);
  float rim = 1.0 - smoothstep(0.0, 0.011, abs(r - 0.078));
  float wall = smoothstep(0.18, 0.5, r) * 0.22;
  return 1.0 - disc * 0.55 + rim * 0.28 + wall;
}

void main() {
  vec2 p = (vUv - 0.5) * uAspect;
  float dist = length(p);
  float age = uTime - uImpactAt;

  // ...
  float slope = 0.0;
  if (uAmplitude > 0.0005) {
    float inside = 1.0 - smoothstep(uFront - 0.015, uFront + 0.03, dist);
    float trail = exp(-(uFront - dist) * 3.5);
    float phase = dist * WAVE_NUMBER - age * ANGULAR_SPEED;
    slope = cos(phase) * uAmplitude * inside * trail;
  }
  // 가짜 굴절: 바닥 그림을 파문의 기울기 방향(방사)으로 밀어 읽는다
  vec2 radial = dist > 0.0005 ? p / dist : vec2(0.0);
  vec2 offset = radial * slope * REFRACT_SCALE;
  vec3 base = uColor * bottomShade(p + offset);

  // ...
  vec3 normal = normalize(vec3(-radial * slope * 2.2, 1.0));
  vec3 light = normalize(vec3(0.42, 0.55, 0.72));
  float spec = pow(clamp(dot(normal, light), 0.0, 1.0), 28.0);
  // ...
}
```

`scenes/memory-room/SinkWater.tsx` · `SinkWater` useFrame

```tsx
const age = now - uniforms.uImpactAt.value;
// 잔 뒤에는 진폭 0으로 두면 셰이더가 파문 분기를 건너뛴다. 정지한 물은 그만큼 싸다
if (rippleAlive(age)) {
  uniforms.uAmplitude.value = rippleAmplitude(age) * intensityRef.current;
  uniforms.uFront.value = rippleWavefront(age);
} else {
  uniforms.uAmplitude.value = 0;
  uniforms.uFront.value = 0;
}
```

`scenes/memory-room/water-ripple.ts` · `rippleAmplitude`, `rippleWavefront`

```ts
export function rippleAmplitude(ageS: number): number {
  if (!(ageS > 0)) return 0;
  const rise = Math.min(ageS / RIPPLE.attack, 1);
  const eased = rise * rise * (3 - 2 * rise);
  return eased * Math.exp(-RIPPLE.decay * ageS);
}

// ...
export function rippleWavefront(ageS: number): number {
  if (!(ageS > 0)) return 0;
  return RIPPLE.reach * (1 - Math.exp(-RIPPLE.spread * ageS));
}
```

**이불 호흡** — `scenes/memory-room/BedModel.tsx` · `BREATH_VERTEX`, `LoadedBed`

```tsx
const BREATH_VERTEX = /* glsl */ `
  #include <begin_vertex>
  transformed.y += sin(uBreathTime * ${BREATH_RATE.toFixed(2)} + position.x * 2.1 + position.z * 1.4) * uBreath;
`;
```

```tsx
const breath = useMemo(() => ({ time: { value: 0 }, amount: { value: 0 } }), []);
// ...
if (part === "blanket") {
  // 이불만 숨 쉰다. uniform 객체는 바깥(breath)의 것을 그대로 꽂아 useFrame이 만진다
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uBreathTime = breath.time;
    shader.uniforms.uBreath = breath.amount;
    shader.vertexShader = `uniform float uBreathTime;\nuniform float uBreath;\n${shader.vertexShader.replace(
      "#include <begin_vertex>",
      BREATH_VERTEX,
    )}`;
  };
}
```

```tsx
breath.time.value = state.clock.elapsedTime;
// 켜고 끌 때 툭 멈추지 않게 진폭만 damp로 따라간다
breath.amount.value = MathUtils.damp(
  breath.amount.value,
  breathing ? BREATH_AMPLITUDE : 0,
  2,
  delta,
);
```

**이불 접힘** — `scenes/memory-room/BedModel.tsx` · `LoadedBed`

```tsx
let blanketMesh: Mesh | null = null;
copy.traverse((object) => {
  // ...
  if (mesh.name === "blanket") blanketMesh = mesh;
});
return { cloned: copy, materials: [...made.values()], blanket: blanketMesh as Mesh | null };
```

```tsx
const influences = blanket?.morphTargetInfluences;
const index = blanket?.morphTargetDictionary?.[FOLD_KEY];
if (!influences || index === undefined) return;
// 누르면 접히기 시작하고(걸어오는 동안 접힌다), 일어나 가장자리로 나온 뒤에야 펴진다.
const folded = occupied || isOnMattress(playerPosition.current) ? 1 : 0;
const lambda = reducedMotion ? REDUCED_LAMBDA : FOLD_LAMBDA;
influences[index] = MathUtils.damp(influences[index], folded, lambda, delta);
```

**컵라면 물때** — `scenes/memory-room/FurnitureModel.tsx` · `STAIN_FRAGMENT`, `applyStain`

```tsx
const STAIN_FRAGMENT = /* glsl */ `
  #include <map_fragment>
  #ifdef USE_UV
  diffuseColor.rgb *= texture2D(uStain, vUv).rgb;
  #endif
`;

function applyStain(material: Material, stain: Texture) {
  const standard = material as MeshStandardMaterial;
  if (!standard.isMeshStandardMaterial) return;
  standard.defines = { ...(standard.defines ?? {}), USE_UV: "" };
  standard.onBeforeCompile = (shader) => {
    shader.uniforms.uStain = { value: stain };
    shader.fragmentShader = `uniform sampler2D uStain;\n${shader.fragmentShader.replace(
      "#include <map_fragment>",
      STAIN_FRAGMENT,
    )}`;
  };
  standard.needsUpdate = true;
}
```

`scenes/memory-room/StudentProps.tsx` · 컵라면 용기

```tsx
const level = roomLightLevel({ collected, memoryTotal: MEMORY_TOTAL, recovery });
const cupStain = useStainTexture(5, stainStepsForLevel(level), 0.45);
```

`scenes/memory-room/BathroomStains.tsx` · `stainStepsForLevel`

```ts
export function stainStepsForLevel(level: number): number {
  const clamped = Math.min(1, Math.max(0, Number.isNaN(level) ? 0 : level));
  // 조사 한 번(1/7)마다 눈에 띄게 자라도록 40스텝 단위로 끊는다. 같은 값이면 다시 안 굽는다
  return 40 + Math.round(((1 - clamped) * 280) / 40) * 40;
}
```

**화장실 물때** — `lib/effects/reaction-diffusion.ts` · `bakeGrayScott`

```ts
// 9점 라플라시안 (가운데 -1, 상하좌우 0.2, 대각 0.05)
const lapA =
  -a[i] +
  0.2 * (a[row + left] + a[row + right] + a[up + x] + a[down + x]) +
  0.05 * (a[up + left] + a[up + right] + a[down + left] + a[down + right]);
const lapB =
  -b[i] +
  0.2 * (b[row + left] + b[row + right] + b[up + x] + b[down + x]) +
  0.05 * (b[up + left] + b[up + right] + b[down + left] + b[down + right]);
const reaction = a[i] * b[i] * b[i];
nextA[i] = Math.min(
  1,
  Math.max(0, a[i] + (diffuseA * lapA - reaction + feed * (1 - a[i])) * dt),
);
nextB[i] = Math.min(
  1,
  Math.max(0, b[i] + (diffuseB * lapB + reaction - (kill + feed) * b[i]) * dt),
);
```

`scenes/memory-room/BathroomStains.tsx` · `BathroomStain`

```tsx
{/* three의 곱셈 블렌딩은 premultipliedAlpha를 요구한다. 없으면 블렌딩이 풀려 흰 판으로 선다 */}
<meshBasicMaterial
  map={texture}
  blending={MultiplyBlending}
  premultipliedAlpha
  transparent
  depthWrite={false}
/>
```

**악보 잉크가 모인다** — `scenes/memory-room/PianoSheet.tsx` · `paintSheet`, `PianoSheet`

```tsx
if (hidden) {
  if (gather <= 0) return;
  // 모이는 중인 음표: 번짐(blur)이 걷히며 진해진다. 잉크가 거꾸로 모이는 그림
  ctx.filter = `blur(${noteBlurPx(gather).toFixed(2)}px)`;
  ctx.globalAlpha = gather;
}
```

```tsx
useFrame((state) => {
  let gather: number;
  if (!gathered) {
    gatherStart.current = null;
    gather = 0;
  } else if (!animate) {
    gather = 1;
  } else {
    if (gatherStart.current === null) gatherStart.current = state.clock.elapsedTime;
    gather = gatherProgress(state.clock.elapsedTime - gatherStart.current, GATHER_DURATION_S);
  }
  if (gather === paint.gather) return;
  // ...
  paint.texture.needsUpdate = true;
  paint.gather = gather;
});
```

`scenes/memory-room/sheet-ink.ts` · `gatherProgress`, `noteBlurPx`

```ts
export function gatherProgress(elapsedS: number, durationS = GATHER_DURATION_S): number {
  if (durationS <= 0) return 1;
  const t = clamp01(elapsedS / durationS);
  return 1 - (1 - t) ** 3;
}

/** 모임 정도 → 음표의 번짐(px). 모일수록 또렷하다. */
export function noteBlurPx(gather: number): number {
  return NOTE_BLUR_MAX_PX * (1 - clamp01(gather));
}
```

**3D 표면의 글자** — `minigames/piano-melody/index.tsx` · `useNoteLabels`

```tsx
const textures = useMemo(() => {
  const made: Partial<Record<Solfege, CanvasTexture>> = {};
  for (const note of SOLFEGE) {
    // ...
    ctx.fillText(t(`minigame.pianoMelody.notes.${note}`), canvas.width / 2, canvas.height / 2);
    // ...
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 4;
    made[note] = texture;
  }
  return made;
}, [ink, t]);

useEffect(
  () => () => {
    for (const texture of Object.values(textures)) texture.dispose();
  },
  [textures],
);
```

`components/canvas/DialDrums.tsx` · `paintBand`: 띠 한 바퀴에 0~9를 90° 눕혀 적는다.

```tsx
// 0은 이음매에 걸쳐 있어 양 끝에 한 번씩 그린다
for (let i = 0; i <= DIGITS; i++) {
  ctx.save();
  ctx.translate(i * cell, TEXTURE_HEIGHT / 2);
  ctx.rotate(Math.PI / 2);
  ctx.fillText(String(i % DIGITS), 0, cell * 0.04);
  ctx.restore();
}
```

`components/canvas/inspect-textures.ts` · `useFaceTextures`

```ts
faces.map((face) => {
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d");
  if (ctx && typeof ctx.fillRect === "function") {
    face.paint(ctx, size, palette, font);
    face.overlay?.(ctx, size, palette, font);
  }
  const made = new CanvasTexture(canvas);
  // ...
}),
```

**재구성 연출** — `scenes/memory-room/WireframeReveal.tsx` · `WireframeReveal`

```tsx
return useMemoryRoomStore.subscribe((state, previous) => {
  if (selectRadioSignaling(state) && !selectRadioSignaling(previous)) pending.current = true;
  if (state.space !== previous.space && REVEAL_SPACES.includes(state.space)) {
    if (!seen.current.has(state.space)) {
      seen.current.add(state.space);
      pending.current = true;
    }
  }
});
```

```tsx
scene.traverse((object) => {
  const mesh = object as Mesh;
  if (!mesh.isMesh || !mesh.visible) return;
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const material of materials) {
    if (isWireframeMaterial(material) && !material.wireframe) found.push(material);
  }
});
touched.current = found;
for (const material of found) material.wireframe = true;
// ...
const frame = reconstructionAt(state.clock.elapsedTime - startAt.current);
if (!frame.wireframe && touched.current.length > 0) {
  for (const material of touched.current) material.wireframe = false;
  touched.current = [];
}
setScreenTransitionSettle(frame.settle);
```

`scenes/memory-room/reconstruction.ts` · `reconstructionAt`

```ts
if (elapsedS < WIREFRAME_S) return { wireframe: true, settle: 1, done: false };
const t = (elapsedS - WIREFRAME_S) / SETTLE_S;
if (t >= 1) return { wireframe: false, settle: 0, done: true };
// 부드럽게 잦아든다. 선형이면 마지막에 툭 끊긴다
const settle = 1 - t * t * (3 - 2 * t);
return { wireframe: false, settle, done: false };
```

---

## 10. three.js: 오브젝트 애니메이션과 3D 인터랙션

| 효과 | 파일 | 보이는 것 | 구현 |
|---|---|---|---|
| **커튼 젖히기** | RoomFurniture.tsx, curtain-motion.ts | 드래그하면 천이 뭉치며 창이 드러난다. 놓으면 **관성(flick)**을 보고 끝까지 가거나 도로 닫힌다. 탭하면 토글 | 천을 옮기지 않고 shape key `open`만 바꾼다. 움직이지 않는 커튼 평면과 광선을 교차시키고, pointer capture를 쓴다. 속도 EMA를 0.12초 앞으로 투영해 문턱(0.55)과 비교한다. 0.1초 이상 멈췄다 놓으면 속도를 버린다. 몸이 창가에 닿기 전의 끌기·놓기는 담아 두었다가 닿는 프레임에 흘린다 |
| **호버 → 커서 흡착** | use-glow-hover.ts, cursor-target.ts, CursorTargetProjector.tsx | 호버하면 DOM 커서 링이 물건 중심으로 빨려들고 윤곽이 밝아진다 | `Box3` 중심을 `project(camera)`로 화면 px로 바꿔 모듈 싱글턴에 기록하고, DOM 커서가 rAF에서 읽는다 |
| **호버 들림, 클릭 펀치** | memory-motion.ts | 호버하면 살짝 뜨고 커진다. 클릭하면 한 번 눌렸다 튄다 | `1 - 0.16·sin(2πp)(1-p)²` |
| **기억 표식** | MemoryBeacon.tsx | 바닥의 금빛 고리와 공중에서 도는 마름모. 가까이 가면 커지고 밝아진다 | Additive, `raycast={() => null}`로 클릭 대상에서 뺀다 |
| **근접 판정** | use-near-player.ts | 커튼·스위치·의자는 다가가야 빛난다 | useFrame setState를 피하려고 100ms 폴링 |
| **숨은 공간 클릭 차단** | event-visibility.ts, MemoryRoomScene.tsx | 숨은 방의 물건이 클릭을 가로채지 않는다 | `setEvents({ filter })`로 조상까지 visible인 hit만 남긴다(three raycast는 visible을 보지 않는다) |
| **투명 판정 구** | MemoryObjects.tsx | 얇은 물건도 손가락으로 짚힌다 | opacity 0 구를 글로우 선택 밖(helpers)에 둔다. 눌러서 뭔가 일어날 때(`clickable`)만 세워, 끝난 기억의 구가 옆 물건의 클릭을 삼키지 않게 한다 |
| **서랍, 문, 배트, 시계** | RoomFurniture.tsx, RoomShell.tsx, LivingRoomShell.tsx, SpaceDoor.tsx, EndingTrigger.tsx | 서랍이 밀려 나오고, 문이 경첩으로 **90°(앞벽과 나란히)** 젖혀지고, 엔딩 배트가 들려 사라지고, 멈췄던 초침이 2막부터 한 칸씩 다시 간다 | 서랍은 damp(λ6). 화장실·안방 문과 현관문은 approach(λ4)로 열리고, 방문은 열리는 순간 90°로 선다. 모든 문짝의 `openAngle`은 `ROOM_DOOR_LEAF` 하나(π/2)다. 배트는 0.45초 동안 들리며 줄어든다. 초침은 `floor(elapsed)` 스텝 회전 |
| **한 번에 한 공간** | MemoryRoomScene.tsx | 지금 서 있는 공간만 보인다 | `<group visible>` 토글. 방문 넘기(1인칭 `doorway` 시점) 동안만 방과 거실이 함께 선다 |

### 관련 코드

**커튼 젖히기** — `scenes/memory-room/RoomFurniture.tsx` · `CURTAIN_PLANE`, `Curtain`

```tsx
const CURTAIN_PLANE = new Plane(new Vector3(0, 0, 1), -CURTAIN_Z);
const curtainHit = new Vector3();

/** 포인터 광선이 커튼 평면과 만나는 x. 평행이면 null. */
function curtainPlaneX(ray: { intersectPlane: (plane: Plane, target: Vector3) => Vector3 | null }) {
  return ray.intersectPlane(CURTAIN_PLANE, curtainHit)?.x ?? null;
}
```

```tsx
onPointerMove={(event) => {
  // ...
  const x = curtainPlaneX(event.ray);
  if (x === null) return;
  // ...
  if (Math.abs(x - drag.startX) >= CURTAIN_TAP_SLOP) drag.moved = true;
  const next = pullProgress(side, x - drag.startX, drag.from);
  const now = performance.now();
  drag.velocity = pullVelocity(
    drag.velocity,
    drag.lastProgress,
    next,
    (now - drag.lastTime) / 1000,
  );
  drag.lastProgress = next;
  drag.lastTime = now;
  if (isAtCurtain(useMemoryRoomStore.getState())) pull(next);
  else pendingRef.current.pull = next;
}}
```

```tsx
const tapped = !drag.moved;
// 놓기 직전에 손이 멈춰 있었으면 속도는 없는 셈이다. 끌다가 멈춰 서서 놓는 것은
// "여기 두겠다"는 뜻이지 튕긴 게 아니다
const stale = (performance.now() - drag.lastTime) / 1000;
const velocity = stale > CURTAIN_VELOCITY_HOLD_S ? 0 : drag.velocity;
```

```tsx
shownRef.current = dragRef.current
  ? progress
  : MathUtils.damp(shownRef.current, progress, reducedMotion ? 18 : 5.5, delta);
// ...
const cloth = clothRef.current;
const index = cloth?.morphTargetDictionary?.[CURTAIN_OPEN_KEY];
if (cloth?.morphTargetInfluences && index !== undefined) {
  cloth.morphTargetInfluences[index] =
    CURTAIN_REST_GAP + shownRef.current * (1 - CURTAIN_REST_GAP);
}
```

`scenes/memory-room/curtain-motion.ts` · `releaseProgress`, `pullVelocity`

```ts
export function releaseProgress(progress: number, tapped: boolean, velocity = 0): number {
  if (tapped) return toggleProgress(progress);
  const projected = Number.isFinite(velocity) ? velocity * CURTAIN_FLICK_PROJECT_S : 0;
  return settleProgress(clamp01(progress + projected));
}
```

```ts
if (!(deltaSeconds > 0)) return previousVelocity;
const instant = (to - from) / deltaSeconds;
return previousVelocity + (instant - previousVelocity) * 0.5;
```

**호버 → 커서 흡착** — `scenes/memory-room/use-glow-hover.ts` · `useGlowHover`

```ts
useEffect(() => {
  if (!hovered) return;
  playSound("hover");
  const previous = document.body.style.cursor;
  document.body.style.cursor = "pointer";
  const target = targetRef.current;
  if (target) setCursorTargetObject(target);
  return () => {
    document.body.style.cursor = previous;
    if (target) clearCursorTargetObject(target);
  };
}, [hovered]);
```

`scenes/memory-room/CursorTargetProjector.tsx` · `CursorTargetProjector`

```tsx
useFrame(({ camera, gl }) => {
  const object = cursorTarget.object;
  if (!object) {
    cursorTarget.screen = null;
    return;
  }
  bounds.setFromObject(object);
  if (bounds.isEmpty()) {
    cursorTarget.screen = null;
    return;
  }
  bounds.getCenter(center).project(camera);
  const rect = gl.domElement.getBoundingClientRect();
  cursorTarget.screen = {
    x: rect.left + ((center.x + 1) / 2) * rect.width,
    y: rect.top + ((1 - center.y) / 2) * rect.height,
  };
});
```

**호버 들림, 클릭 펀치** — `scenes/memory-room/memory-motion.ts` · `punchScale`, `memoryMotion`

```ts
export function punchScale(elapsed: number): number {
  if (elapsed <= 0 || elapsed >= PUNCH_DURATION) return 1;
  const progress = elapsed / PUNCH_DURATION;
  const decay = 1 - progress;
  return 1 - PUNCH_DEPTH * Math.sin(progress * Math.PI * 2) * decay * decay;
}
```

```ts
export function memoryMotion(hover: number, punchElapsed: number): MemoryMotion {
  return {
    scale: (1 + HOVER_SCALE * hover) * punchScale(punchElapsed),
    lift: HOVER_LIFT * hover,
  };
}
```

`scenes/memory-room/MemoryObjects.tsx` · 기억 오브젝트 useFrame

```tsx
useFrame((_, delta) => {
  const group = motionRef.current;
  if (!group) return;
  hoverRef.current = approach(hoverRef.current, hovered ? 1 : 0, HOVER_LAMBDA, delta);
  punchRef.current = Math.min(PUNCH_DURATION, punchRef.current + delta);
  const motion = memoryMotion(hoverRef.current, punchRef.current);
  group.scale.setScalar(motion.scale);
  group.position.y = motion.lift;
});
```

**기억 표식** — `scenes/memory-room/MemoryBeacon.tsx` · `MemoryBeacon`

```tsx
const nearness = nearRef.current;
const pulse = 0.72 + 0.28 * Math.sin(state.clock.elapsedTime * 2.1);
const scale = 1 + (NEAR_SCALE - 1) * nearness;

ring.scale.setScalar(scale);
if (ringMaterialRef.current) {
  ringMaterialRef.current.opacity = shown * pulse * 0.34 * (1 + (NEAR_BOOST - 1) * nearness);
}

diamond.position.y = lift + Math.sin(state.clock.elapsedTime * 1.7) * DIAMOND_BOB;
diamond.rotation.y = spinRef.current * 1.1;
```

```tsx
<mesh
  ref={ringRef}
  position={[0, -groundOffset + 0.03, 0]}
  rotation={[-Math.PI / 2, 0, 0]}
  // 표식은 클릭 대상이 아니다. 고리를 눌러 물건이 열리면 조준이 헐거워진다.
  raycast={() => null}
>
```

**근접 판정** — `scenes/memory-room/use-near-player.ts` · `useNearPlayer`

```ts
useEffect(() => {
  if (positionRef === null) return;
  const check = () => {
    const inside = isWithin(positionRef.current, x, z, radius);
    setNear((current) => (current === inside ? current : inside));
  };
  check();
  const timer = window.setInterval(check, NEAR_POLL_MS);
  return () => window.clearInterval(timer);
}, [positionRef, x, z, radius]);
```

**숨은 공간 클릭 차단** — `scenes/memory-room/event-visibility.ts` · `isVisibleInTree`, `visibleHitsOnly`

```ts
export function isVisibleInTree(object: Object3D): boolean {
  for (let node: Object3D | null = object; node !== null; node = node.parent) {
    if (!node.visible) return false;
  }
  return true;
}

/** r3f 이벤트 필터(`setEvents({ filter })`)에 그대로 꽂는다. */
export function visibleHitsOnly<T extends Intersection>(hits: T[]): T[] {
  return hits.filter((hit) => isVisibleInTree(hit.object));
}
```

`scenes/MemoryRoomScene.tsx`

```tsx
const setEvents = useThree((state) => state.setEvents);
useEffect(() => {
  setEvents({ filter: visibleHitsOnly });
  return () => setEvents({ filter: undefined });
}, [setEvents]);
```

**투명 판정 구** — `scenes/memory-room/MemoryObjects.tsx` · `MemoryGlowLayers`의 `helpers`

```tsx
clickable ? (
  <mesh name={`memory-hit-${id}`}>
    <sphereGeometry args={[hitRadiusOf(placement), 12, 8]} />
    <meshBasicMaterial transparent opacity={0} depthWrite={false} />
  </mesh>
) : null
```

**서랍** — `scenes/memory-room/RoomFurniture.tsx` · `Drawer`

```tsx
useFrame((_, delta) => {
  const group = groupRef.current;
  if (!group) return;
  const goal = open ? travel : 0;
  group.position.z = MathUtils.damp(
    group.position.z,
    goal,
    reducedMotion ? REDUCED_LAMBDA : DRAWER_LAMBDA,
    delta,
  );
});
```

**문** — `scenes/memory-room/layout.ts` · `ROOM_DOOR_LEAF`

```ts
export const ROOM_DOOR_LEAF = {
  width: 1.45,
  height: 3.4,
  thickness: 0.12,
  hingeOffset: 0.73,
  openAngle: Math.PI / 2,
} as const;
```

`scenes/memory-room/SpaceDoor.tsx` · `SpaceDoor`: 경첩 오프셋으로 옮긴 그룹을 돌린다.

```tsx
useFrame((_, delta) => {
  const leaf = leafRef.current;
  if (!leaf) return;
  leaf.rotation.y = approach(leaf.rotation.y, open ? -ROOM_DOOR_LEAF.openAngle : 0, 4, delta);
});
// ...
<group ref={leafRef} position={[-ROOM_DOOR_LEAF.hingeOffset, 0, 0]}>
  <MemoryGlowSelection selectionKey={`door-${id}`} tier="memory" enabled={ready}>
    <group position={[ROOM_DOOR_LEAF.hingeOffset, 0, 0]}>
```

`scenes/memory-room/RoomShell.tsx` · 방문

```tsx
{/* 문짝만 경첩(왼쪽 문틀)을 축으로 열린다. 문틀·손잡이는 제자리에 남는다. */}
<group
  position={[-DOOR_HINGE_X, 0, 0]}
  rotation={[0, doorOpen ? -ROOM_DOOR_LEAF.openAngle : 0, 0]}
>
```

**배트** — `scenes/memory-room/EndingTrigger.tsx`

```tsx
if (started) {
  takenRef.current = Math.min(TAKEN_DURATION, takenRef.current + delta);
  const taken = takenRef.current / TAKEN_DURATION;
  group.position.y = taken * TAKEN_LIFT;
  group.scale.setScalar(Math.max(0, 1 - taken));
  return;
}
```

**시계** — `scenes/memory-room/RoomFurniture.tsx` · `SecondHand`

```tsx
useFrame((state) => {
  const group = groupRef.current;
  if (!group) return;
  if (!running) {
    startedAt.current = null;
    group.rotation.z = -(SECOND_STOPPED / 60) * Math.PI * 2;
    return;
  }
  if (startedAt.current === null) startedAt.current = state.clock.elapsedTime;
  const ticks = Math.floor(state.clock.elapsedTime - startedAt.current);
  group.rotation.z = -((SECOND_STOPPED + ticks) / 60) * Math.PI * 2;
});
```

**한 번에 한 공간** — `scenes/MemoryRoomScene.tsx`

```tsx
<group visible={inRoom}>{roomContent}</group>
{/* ... */}
<group visible={inLivingRoom || (inRoom && viewpoint === "doorway")}>
  {livingContent}
</group>
{/* 거실 너머의 공간들 (v3). 문은 두 껍데기 밖, 양쪽 어디서든 보이게 */}
<group visible={space === "bathroom"}>{bathroomContent}</group>
<group visible={space === "parents"}>{parentsContent}</group>
<group visible={inLivingRoom || space === "bathroom"}>{bathroomDoor}</group>
<group visible={inLivingRoom || space === "parents"}>{parentsDoor}</group>
```

---

## 11. three.js: 별도 Canvas

| 효과 | 파일 | 보이는 것 | 구현 |
|---|---|---|---|
| **3D 인스펙트 턴테이블** | components/canvas/InspectTurntable.tsx, inspect-math.ts, lib/still-capture.ts | 집어 든 물건을 돌리고 확대한다(홀로그램 씰은 기울이고, 접힌 쪽지는 펴고, 책은 넘긴다). **찾아야 할 면을 ±37° 안에서 0.35초 마주 보면 발견**으로 친다(휙 지나간 건 못 본 것). 내려놓는 순간의 판은 한 장의 정지 그림으로 굳어 결과 대사·수첩·다시보기에 선다 | 박스 면마다 CanvasTexture를 붙인다. 둥근 귀 카드는 ShapeGeometry와 Extrude 테두리. 스팟 조명과 금빛 림 라이트, `ContactShadows`. 정지 그림은 `preserveDrawingBuffer` 없이 찍는 순간 한 번 더 그리고 곧장 읽어, 무대 그라디언트와 합친 JPEG로 만든다 |
| **캐릭터 뷰어** | components/canvas/CharacterTurntable.tsx | 수첩에서 캐릭터를 돌려 보고 포즈(서기·걷기·앉기)를 고른다. 손을 떼면 2.2초 뒤 저절로 돈다 | 게임과 **같은 플레이어 리그 함수**를 재사용한다. 앉기 포즈에는 걸상이 몸과 함께 드러난다 |
| **숫자 드럼** | components/canvas/DialDrums.tsx, minigames/sink-dial | 하부장 다이얼 드럼 **세 개**(답은 세 자리)를 굴린다 | 누적 step에 드래그 몫을 더해, 9→0으로 넘어갈 때 역회전하지 않는다. 드럼 수는 답의 자리수에서 나온다 |

### 관련 코드

**3D 인스펙트 턴테이블** — `components/canvas/InspectTurntable.tsx` · `InspectedThing`

```tsx
/** 찾을 면을 마주 본 것으로 치는 기준: 목표각과의 차이의 cos가 이보다 크면 (±37° 안). */
const FACING_COS = 0.8;
```

```tsx
const facing = Math.cos(yawRef.current - object.foundYaw) > FACING_COS;
if (readRef.current.tick(facing, delta)) onFoundRef.current();
```

`components/canvas/inspect-math.ts` · `ReadTimer`

```ts
export const READ_SECONDS = 0.35;
// ...
tick(condition: boolean, delta: number): boolean {
  if (this.done) return false;
  if (!condition) {
    this.held = 0;
    return false;
  }
  this.held += delta;
  if (this.held < READ_SECONDS) return false;
  this.done = true;
  return true;
}
```

`components/canvas/InspectTurntable.tsx` · `roundedSlabGeometry`

```tsx
const shape = roundedRectShape(width, height, radius);
const face = new ShapeGeometry(shape, 8);
// ...
// 두께만 두른다: 뚜껑은 앞뒤 평면이 맡으니 테 쪽 그룹(1)만 남긴다
const rim = new ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 8 });
rim.translate(0, 0, -depth / 2);
const sides = rim.groups.find((group) => group.materialIndex === 1);
rim.clearGroups();
if (sides) rim.addGroup(sides.start, sides.count, 0);
return { face, rim };
```

`components/canvas/InspectTurntable.tsx` · 조명과 `CaptureBridge`

```tsx
<ambientLight intensity={0.4} />
<spotLight position={[1.4, 2.4, 2.8]} angle={0.3} penumbra={1} decay={0} intensity={3.2} />
<directionalLight position={[-1.5, -0.6, 2.5]} intensity={0.35} />
<directionalLight position={[-2.6, 1.4, -2.4]} intensity={2.2} color={palette.memory} />
<directionalLight position={[2.6, 0.4, -2]} intensity={1.2} color={palette.memory} />
```

```tsx
function CaptureBridge({ captureRef }: { captureRef: MutableRefObject<InspectCapture | null> }) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  useEffect(() => {
    captureRef.current = () => {
      gl.render(scene, camera);
      return composeStill(gl.domElement);
    };
    return () => {
      captureRef.current = null;
    };
  }, [captureRef, gl, scene, camera]);
  return null;
}
```

**캐릭터 뷰어** — `components/canvas/CharacterTurntable.tsx` · `ViewerModel`

```tsx
const rig = useMemo(() => createPlayerRig(scene, animations), [scene, animations]);
// ...
useFrame((_, delta) => {
  const step = Math.min(delta, 0.05);
  const group = groupRef.current;
  if (Date.now() - touchedAtRef.current > SPIN_RESUME_MS) yawRef.current += AUTO_SPIN * step;
  if (group) group.rotation.y = yawRef.current;
  sitRef.current = advanceSitProgress(sitRef.current, pose === "sit", step);
  const walking = pose === "walk" ? 1 : 0;
  walkRef.current += (walking - walkRef.current) * Math.min(1, step * 8);
  phaseRef.current += STEP_RATE * VIEWER_WALK_SPEED * walkRef.current * step;
  const sitting = sitEase(sitRef.current);
  updatePlayerRig(rig, phaseRef.current, walkRef.current, step, sitting);
  // 걸상은 몸이 내려앉는 만큼 함께 드러난다. 다 앉은 뒤에 튀어나오면 뒤늦은 변명이 된다.
  const stool = stoolRef.current;
  if (stool) {
    stool.visible = sitting > 0.02;
    (stool.material as MeshStandardMaterial).opacity = sitting;
  }
});
```

**숫자 드럼** — `components/canvas/DialDrums.tsx` · `Drums`

```tsx
useFrame((_, delta) => {
  const ease = 1 - Math.exp(-TURN_DAMP * delta);
  meshes.current.forEach((mesh, index) => {
    if (!mesh) return;
    const target = ((stepsRef.current[index] ?? 0) + (dragRef.current[index] ?? 0)) * STEP_ANGLE;
    mesh.rotation.x += (target - mesh.rotation.x) * ease;
  });
});
```

`minigames/sink-dial/index.tsx` · 드럼 수와 드래그 몫

```tsx
const [steps, setSteps] = useState<number[]>(() => SINK_DIAL_CODE.split("").map(() => 0));
const digits = steps.map((value) => ((value % 10) + 10) % 10);
```

```tsx
drag.carry += event.clientY - drag.lastY;
drag.lastY = event.clientY;
while (Math.abs(drag.carry) >= DRAG_PX_PER_STEP) {
  const step = drag.carry > 0 ? 1 : -1;
  drag.carry -= step * DRAG_PX_PER_STEP;
  turn(drag.index, step);
}
dragRef.current[drag.index] = drag.carry / DRAG_PX_PER_STEP;
```

---

## 12. CSS·DOM: 부팅, 로딩, 타이틀

| 효과 | 파일 | 보이는 것 | 구현 |
|---|---|---|---|
| **부팅 커튼** | BootCurtain.tsx, `boot-curtain-rise` | 로딩이 끝나면 커튼이 위로 접혀 올라간다. 12% 지점에서 한 번 처져 천의 무게를 낸다 | 1.1s `cubic-bezier(0.62,0,0.28,1)`. 최소 노출 900ms, 12초 뒤 포기. 걷히기 시작하는 순간 `beginBootRise`로 알려 타이틀이 그 밑에서 계단식으로 놓인다. 모션을 끄면 0.24s 페이드로 바뀐다 |
| **떠오르는 먼지** | RisingDust.tsx, `.boot-dust` | memory 색 점 34개가 아래에서 떠오른다 | 낱알마다 duration, **음수 delay**, drift/blur를 인라인 CSS 변수로 준다. 난수는 `Math.sin` 해시라 SSR과 hydration 값이 같고, 값은 자릿수를 끊은 문자열로 들고 있어 브라우저가 다시 적어도 어긋나지 않는다. 커튼·타이틀(22개)·404·오류 화면(18개)이 같은 층을 쓴다 |
| **로딩 막대** | LoadingIndicator.tsx, loading-progress.ts | 달리는 도해 gif 아래 8칸 분절 막대 | LoadingManager의 계단식 보고를 rAF 지수 감쇠로 펴고, 멈추면 남은 구간의 38%까지만 기어간다. 되감기는 금지. 다 차면 rAF를 놓는다. 부팅 커튼은 퍼센트를 늘 넘기므로 왕복 조각(`loading-sweep`)은 퍼센트가 없을 때의 대체 경로로만 남아 있다 |
| **서비스 워커와 PWA** | public/sw.js | 두 번째 방문부터 즉시 로드 | 에셋은 cache-first(200만 캐시에 넣는다), 문서는 network-first. Range 요청은 건너뛴다. 문서가 네트워크와 캐시 모두에 없으면 `offline.html`을 돌려준다 |
| **오류·오프라인 화면** | not-found.tsx, error.tsx, global-error.tsx, LoadError.tsx, public/offline.html | Next 기본 화면 대신 타이틀과 같은 문법(어둠, 떠오르는 먼지, 픽셀 제목) | `useSyncExternalStore`로 `navigator.onLine`을 구독한다. 끊긴 동안은 다시 시도 버튼을 잠그고, `online` 이벤트가 오면 스스로 다시 시도한다. offline.html은 Next 밖 정적 파일이라 토큰 값을 옮겨 적는다 |
| **픽셀 로고** | `.title-logo` | 굵은 픽셀 제목 | 크기는 **14의 정수배만** 쓴다(42/56/70px, Galmuri14 그리드). 굵은 웨이트가 없어 `text-shadow`로 **1em/14씩 세 번 더 찍어** 획을 굵힌다 |
| **계단식 등장** | TitleScreen.tsx, stagger.ts, `stagger-rise` | 신호등·로고 → 메뉴 → 안내 → 언어 순서로 놓인다 | `--stagger-index × 55ms` delay. 커튼이 걷히기 전에는 `opacity-0`으로 숨겨 둔다 |
| **모서리 선 그리기와 금빛 훑기** | `rule-draw`, `rule-sweep` | 네 귀에서 선이 자라 나오고, 아래 띠를 금빛이 한 번만 지나간다 | scaleX/Y, `origin-*`을 모서리 쪽으로 둔다. 좁은 화면(`sm` 미만)에서는 모서리 선을 걷는다 |
| **메뉴 항목** | TitleScreen.tsx, `.title-menu-item` | hover하면 ▶가 4px 미끄러져 들어오고 밑줄이 글자 폭만큼 그어지며 글로우가 생긴다 | translate, scale-x, text-shadow transition. 기본 선택(첫 항목)은 ▶·밑줄이 늘 붙은 memory 색이다. 게임 바깥 항목(만든 사람)은 본문 서체 작은 글자로 물러선다 |
| **시작 퇴장** | `title-retreat` | 올라온 순서 그대로 계단을 밟아 사라진다. 그동안 카메라가 방으로 내려앉는다 | 260ms 뒤 startGame |
| **키캡 안내** | Keycap.tsx | 조작 안내 문장 속 키 이름(WASD, Enter, E …)과 "클릭"·"탭"·"스크롤"이 키캡 모양으로 선다 | 정규식으로 문장을 글과 키로 갈라 키만 `<kbd>` 캡으로 바꿔 끼운다. 앞뒤가 라틴 글자면 낱말의 일부라 캡이 아니다. "클릭"·제스처는 나열 속에 홀로 선 것만 캡이 되고 phosphor 아이콘이 붙는다. 캡과 뒤의 "·"를 한 덩어리로 묶어 구분점만 다음 줄로 떨어지지 않게 한다. 타이틀 소리 토글도 같은 캡 옷을 입는다 |
| **언어 밑줄** | LanguageToggle.tsx, `.lang-underline` | 밑줄 하나가 고른 언어 밑으로 미끄러진다 | `offsetLeft/Width`를 재서 left/width transition. 폰트 로드(`loadingdone`)와 resize 뒤 다시 잰다 |

### 관련 코드

**부팅 커튼** — `app/globals.css` · `@keyframes boot-curtain-rise`

```css
  --animate-boot-curtain-rise: boot-curtain-rise 1.1s cubic-bezier(0.62, 0, 0.28, 1) both;
  /* ... */
  @keyframes boot-curtain-rise {
    0% {
      transform: translateY(0);
    }
    12% {
      transform: translateY(1.5%);
    }
    100% {
      transform: translateY(-100%);
    }
  }
```

**부팅 커튼의 타이밍** — `components/ui/BootCurtain.tsx` · `BootCurtain`

```tsx
const MIN_SHOW_MS = 900;
// ...
const GIVE_UP_MS = 12_000;
// ...
const RISE_MS = 1100;
// ...
  const shown = useSmoothLoadProgress(gaveUp ? 1 : loadProgress);
  const loadPercent = Math.round(shown * 100);
  const rising = (shown >= 1 || gaveUp) && !held;
// ...
  useEffect(() => {
    if (!rising) return;
    // 걷히기 시작하는 순간을 먼저 알린다. 타이틀이 이 신호에 맞춰 커튼 밑에서 놓인다
    beginBootRise();
    const timer = window.setTimeout(finishBoot, RISE_MS);
    return () => window.clearTimeout(timer);
  }, [rising, beginBootRise, finishBoot]);
```

**떠오르는 먼지** — `components/ui/RisingDust.tsx` · `hashUnit`, `DUST`

```tsx
function hashUnit(seed: number): number {
  const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
}
// ...
const DUST = Array.from({ length: 34 }, (_, index) => {
  const bulk = hashUnit(index) ** 3;
  const size = 1.5 + bulk * 5;

  return {
    id: `mote-${index}`,
    left: `${css(hashUnit(index + 100) * 100, 3)}%`,
    // ...
    rise: `${css(26 + hashUnit(index + 300) * 30, 2)}vh`,
    drift: `${css((hashUnit(index + 400) - 0.5) * 90, 2)}px`,
    duration: `${css(11 + hashUnit(index + 500) * 13, 2)}s`,
    // 음수 지연: 처음부터 제 궤도 중간에 떠 있다. 0이면 전부 바닥에서 동시에 출발한다.
    delay: `${css(-hashUnit(index + 600) * 24, 2)}s`,
  };
});
```

**떠오르는 먼지 한 알의 궤적** — `app/globals.css` · `@keyframes boot-dust`, `.boot-dust`

```css
  @keyframes boot-dust {
    0% {
      opacity: 0;
      transform: translate3d(0, 0, 0) scale(0.5);
    }
    14% {
      opacity: var(--dust-peak);
    }
    50% {
      transform: translate3d(var(--dust-drift), calc(var(--dust-rise) * -0.5), 0) scale(1);
    }
    76% {
      opacity: var(--dust-peak);
    }
    100% {
      opacity: 0;
      transform: translate3d(0, calc(var(--dust-rise) * -1), 0) scale(0.7);
    }
  }
/* ... */
.boot-dust {
  box-shadow: 0 0 var(--dust-blur) color-mix(in srgb, var(--color-memory) 55%, transparent);
}
```

**로딩 막대의 평활화** — `components/ui/loading-progress.ts` · `advanceLoadProgress`

```ts
  // 다 받았으면 기어오를 것이 없다. 남은 거리를 그대로 100까지 달린다.
  if (clampedTarget >= 1) {
    const next = damp(shown, 1, FINISH_LAMBDA, deltaSeconds);
    return 1 - next < SNAP ? 1 : next;
  }

  // 보고가 앞서 있으면 그쪽으로, 멎어 있으면 상한까지만.
  const behind = shown < clampedTarget;
  const goal = behind ? clampedTarget : clampedTarget + (1 - clampedTarget) * CREEP_SHARE;
  const lambda = behind ? CATCH_UP_LAMBDA : CREEP_LAMBDA;

  const next = damp(shown, goal, lambda, deltaSeconds);
  // 되감기 금지: 바가 뒤로 가면 다 됐다고 생각한 사람이 다시 기다린다.
  if (next <= shown) return shown;
  return goal - next < SNAP ? goal : next;
```

**로딩 막대의 칸** — `components/ui/LoadingIndicator.tsx` · `LoadingIndicator`

```tsx
  const filled = percent === undefined ? 0 : Math.round((percent / 100) * SEGMENTS);
// ...
        {Array.from({ length: SEGMENTS }, (_, index) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: 같은 칸의 반복이라 인덱스 말고 구분할 값이 없다.
            key={index}
            aria-hidden
            className={`block size-2.5 rounded-[2px] transition-colors duration-300 ${
              index < filled ? "bg-memory" : "bg-ivory/15"
            }`}
          />
        ))}
        {percent === undefined ? (
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 w-1/3 animate-loading-sweep rounded-[2px] bg-memory/60"
          />
        ) : null}
```

**서비스 워커** — `public/sw.js` · `fetch` 핸들러, `networkFirst`

```js
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(PAGE_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    const offline = await caches.match(OFFLINE_PAGE);
    if (offline) return offline;
    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  // ...
  // 영상은 브라우저가 Range로 조각조각 받는다. 캐시의 통짜 200을 돌려주면 Safari가
  // 재생을 못 하고, 206은 캐시에 넣지도 않으므로 아예 네트워크에 맡긴다.
  if (request.headers.has("range")) return;

  if (ASSET_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
  }
});
```

**오류·오프라인 화면** — `components/ui/LoadError.tsx` · `LoadError`

```tsx
const onlineNow = () => navigator.onLine;
/** 서버는 연결을 모른다. 끊겼다고 단정하면 첫 그림이 틀린 말을 한다 */
const onlineOnServer = () => true;
// ...
  const online = useSyncExternalStore(subscribeOnline, onlineNow, onlineOnServer);
// ...
  useEffect(() => {
    const onOnline = () => retry();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [retry]);

  return (
    <main className="relative grid min-h-dvh w-full place-items-center overflow-hidden bg-night px-6 py-16">
      <RisingDust count={18} />
      // ...
          <button type="button" className={BUTTON_PRIMARY} disabled={!online} onClick={retry}>
            {online ? t("loadError.retry") : t("loadError.waiting")}
          </button>
```

**픽셀 로고** — `app/globals.css` · `.title-logo`

```css
.title-logo {
  --title-pixel: calc(1em / 14);

  font-size: 2.625rem; /* 42px = 14 × 3 */
  text-shadow:
    var(--title-pixel) 0 0 currentcolor,
    0 var(--title-pixel) 0 currentcolor,
    var(--title-pixel) var(--title-pixel) 0 currentcolor,
    0 2px 6px rgb(5 10 18 / 0.7),
    0 0 40px color-mix(in srgb, var(--color-memory) 16%, transparent);
}

@media (min-width: 768px) {
  .title-logo {
    font-size: 3.5rem; /* 56px = 14 × 4 (DESIGN.md > Typography: display) */
  }
}
```

**계단식 등장** — `components/ui/stagger.ts` · `staggerStyle`, `app/globals.css` · `.stagger-item`

```ts
export const STAGGER_CLASS = "animate-stagger-rise stagger-item";

export function staggerStyle(index: number): CSSProperties {
  // 커스텀 속성은 CSSProperties 타입에 없어 캐스트한다 (RisingDust와 같은 사정)
  return { "--stagger-index": index } as CSSProperties;
}
```

```css
.stagger-item {
  animation-delay: calc(var(--stagger-index, 0) * 55ms);
}
```

**계단식 등장과 시작 퇴장의 분기** — `components/ui/TitleScreen.tsx` · `reveal`

```tsx
  const reveal = (index: number) =>
    entering
      ? { className: "animate-title-retreat stagger-item", style: staggerStyle(index) }
      : revealed
        ? { className: STAGGER_CLASS, style: staggerStyle(index) }
        : { className: "opacity-0", style: undefined };
```

**모서리 선 그리기와 금빛 훑기** — `components/ui/TitleScreen.tsx` · `FRAME_CORNERS`, 아래 띠

```tsx
const FRAME_CORNERS = [
  { key: "tl", box: "left-0 top-0", h: "left-0 top-0 origin-left", v: "left-0 top-0 origin-top" },
  // ...
] as const;
// ...
          <span
            aria-hidden
            className={`absolute inset-x-0 top-0 h-px origin-left bg-line ${drawn(afterMenu, "x").className}`}
            style={drawn(afterMenu, "x").style}
          >
            {revealed && !entering ? (
              <span className="absolute inset-y-0 left-0 block w-32 animate-rule-sweep bg-gradient-to-r from-transparent via-memory to-transparent" />
            ) : null}
          </span>
```

`app/globals.css` · `@keyframes rule-sweep`

```css
  --animate-rule-sweep: rule-sweep 1.5s cubic-bezier(0.3, 0, 0.2, 1) 0.5s both;
  /* ... */
  @keyframes rule-sweep {
    from {
      opacity: 0;
      transform: translateX(-100%);
    }
    25% {
      opacity: 1;
    }
    to {
      opacity: 0;
      transform: translateX(100%);
    }
  }
```

**메뉴 항목** — `components/ui/TitleScreen.tsx` · `MenuMarker`, `MenuHairline`

```tsx
      className={`pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-sm text-memory transition-[opacity,translate] duration-150 ease-out ${
        always
          ? "opacity-100"
          : "-translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 group-active:translate-x-0 group-active:opacity-100"
      }`}
// ...
      className={`pointer-events-none absolute -bottom-1 left-0 right-0 h-px origin-left bg-memory/60 transition-transform duration-150 ease-out ${
        always ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100 group-focus-visible:scale-x-100"
      }`}
```

`app/globals.css` · `.title-menu-item`

```css
.title-menu-item:hover,
.title-menu-item:focus-visible {
  text-shadow: 0 0 16px color-mix(in srgb, var(--color-memory) 55%, transparent);
}
```

**시작 퇴장** — `components/ui/TitleScreen.tsx` · `enterGame`

```tsx
const ENTER_DELAY_MS = 260;
// ...
  const enterGame = () => {
    playSound("open");
    setEnteringAtRevision(useMemoryRoomStore.getState().resetRevision);
    enterTimerRef.current = window.setTimeout(startGame, ENTER_DELAY_MS);
  };
```

**키캡 안내** — `components/ui/Keycap.tsx` · `KEY_SOURCE`, `KeyHint`

```tsx
const KEY_SOURCE = String.raw`(?<![A-Za-z])(?:WASD|Space|SPACE|Enter|Esc|Shift|Tab|[EZXC]|↑\/↓|←\/→|[←→↑↓])(?![A-Za-z])`;
// ...
const CLICK_SOURCE = String.raw`(?<=^|[:：·・]\s*)(?:클릭|[Cc]lick|クリック)(?=\s*(?:[·・]|$))`;
// ...
        // 캡과 뒤의 "·"를 한 덩어리로 묶는다. 캡은 inline-flex 상자라 경계에서 줄이 갈라지고,
        // 그러면 "·"만 다음 줄 맨 앞에 떨어진다
        const trailing = parts[index + 1]?.value.match(SEPARATOR_HEAD)?.[0] ?? "";
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: 같은 문장에서 나온 조각이라 순서가 곧 정체다
          <span key={index} className="whitespace-nowrap">
            <Keycap className="mx-0.5 gap-1">
              {PartIcon && <PartIcon size="1.1em" weight="bold" aria-hidden />}
              {part.value}
            </Keycap>
            {trailing}
          </span>
        );
```

**언어 밑줄** — `components/ui/LanguageToggle.tsx` · `LanguageToggle`

```tsx
  useLayoutEffect(() => {
    if (tone !== "bare") return;
    const measure = () => {
      const button = buttonsRef.current[locale];
      if (!button) return;
      setUnderline({ left: button.offsetLeft, width: button.offsetWidth });
    };
    measure();
    // 폰트가 늦게 오거나 창이 바뀌면 글자 폭이 달라진다
    window.addEventListener("resize", measure);
    document.fonts?.addEventListener?.("loadingdone", measure);
    // ...
  }, [tone, locale]);
```

`app/globals.css` · `.lang-underline`

```css
.lang-underline {
  transition:
    left 220ms cubic-bezier(0.2, 0.7, 0.2, 1),
    width 220ms cubic-bezier(0.2, 0.7, 0.2, 1);
}
```

---

## 13. CSS·DOM: 인게임 HUD와 혼잣말

- **레이어 순서**: 씬(z-0) < 대사·혼잣말(z-10) < 조이스틱(z-20) < HUD·수첩(z-30) < 타이틀·미니게임·컷씬·단서(z-40) < 대사창·커튼·파티클(z-50) < 대사 로그(z-60) < 커서(z-100000).
- **방 비네트**: radial-gradient의 불투명도가 밝기 V곡선(`ROOM_LIGHT_RAMP.vignette`)을 따른다. 1인칭 비네트는 따로 있다(인트로 1, 문간 0.55).
- **필름 그레인 타일** `.film-grain`: 인라인 SVG `feTurbulence` + `mix-blend-mode: overlay`. 방에서는 셰이더 그레인(FilmLook)이 기본이고, 이 타일은 **모션을 끈 사람에게만**(`motion-reduce:block`) 대신 선다. 부팅 커튼과 컷씬 정적 구간에도 쓴다.
- **`.room-backdrop`**: 캔버스 뒤 라디얼 두 겹(RoomCanvas). 3D 스프라이트로 두면 투명 정렬 때문에 벽을 뚫고 보여서 DOM으로 뺐다.
- **진행 카운터**: 숫자는 `key={count}` 재마운트로 밀려 올라온다(`count-tick`). 진행 칸은 **새로 찬 칸만** `segment-fill`(scaleX + 글로우)을 돈다.
- **HUD 배율**: 헤더·버튼 글자는 `--text-hud` clamp 하나를 따르고 안쪽은 em으로 자란다. rem으로 짜인 조립 패널(메뉴 드롭다운, 수첩 손잡이)은 `zoom: var(--hud-zoom)`으로 통째로 키운다. 1800px부터는 햄버거를 접지 않고 메뉴를 한 줄로 펼친다(`HudMenu inline`).
- **햄버거 ↔ X**: 아이콘을 바꾸지 않고 SVG line 세 개를 `transform-box: fill-box`로 접는다.
- **소리 토글**: **켤 때만** 파문 링이 번진다. 끌 때 소리가 나면 안 꺼진 것처럼 들리기 때문이다.
- **목표 배너 → 도크**: 배너는 왼쪽 위로 밀리며 사라지고 도크는 같은 방향으로 150ms 늦게 들어온다. 요소를 옮기지 않고 방향 착시로 이동을 표현한다. 넓은 화면(md 이상)에서는 도크가 헤더가 아니라 아래 띠 왼쪽에 선다.
- **기록 라벨** `HudLogLine`: `MEMORY LOG 01 · DAY 31 · ● NO SIGNAL`. 번호는 막(01/02/03)이고, `DAY 31`은 달력을 조사한 뒤에만 붙으며, 신호는 방문이 열릴 준비가 되면 `SIGNAL FOUND`(memory)로 바뀐다. 3막에는 번호가 ember로 서고 1px 어긋난 그림자로 깜빡임 없이 "오염"을 표현한다. 넓은 화면에서는 아래 띠 오른쪽에 선다.
- **미니맵은 없다**: HUD 미니맵(`HudMiniMap`)은 제거됐다. 평면도는 수첩의 한 페이지로만 있고, 방문이 열리면 수첩 손잡이에 새 기록 알림이 켜져 그리로 이어진다(16장).
- **수첩 손잡이**: 세로쓰기 라벨. hover하면 translate가 아니라 **폭**을 늘려 서랍처럼 당겨진다(translate는 가장자리에 틈을 만든다). 온보딩 때는 `hotspot-glow`로 숨 쉬고, 안 읽은 페이지가 있으면 모서리 금빛 점에서 고리가 번진다(`notice-ripple`).
- **스치는 한 줄** (`RemarkLine`, `RoomCallout`): 조사도 기록도 아닌 자리의 혼잣말이 화면 아래에 `fade-rise`로 떠올랐다 사라진다. 누를 때마다 `key`가 바뀌어 다시 돈다. 머무는 시간은 글자 수에 비례한다(최소 3.2초, 글자당 90ms).
- **혼잣말** (`Monologue.tsx`, `monologue-exit.ts`)
  - 경계 없는 라디얼 veil 위에 픽셀 글자가 타자기로 찍힌다. 그림자 두 겹(`.monologue-text`)이 밝은 물건 위에서도 글자를 세운다.
  - **글자 단위 퇴장**: 1막(외면)은 뒤 N글자(최대 8)가 마지막 글자부터 **아래로 떨어지고**, 2막부터(직면)는 앞 글자부터 **위로 올라간다**. 방향의 반전이 서사의 태도 반전이다. 효과 예산이 막으면 문단 전체 opacity로 물러난다.
  - 어절은 `nowrap` span, 글자는 `inline-block` span으로 감싸 keep-all 줄바꿈을 지키면서 transform을 건다.
  - 숨길 때 언마운트하지 않고 opacity만 내린다. 돌아와서 처음부터 다시 찍지 않게 하려는 것이다.
- **터치 조작**: 조이스틱(pointer capture, `translate3d`)과 1인칭 둘러보기 버튼(rAF로 시선 ref에 직접 더한다). 잠기면 둘 다 opacity 0으로 통째로 사라진다.

### 관련 코드

**레이어 순서** — `components/ui/MemoryRoom.tsx` · `MemoryRoom` (렌더 순서)

```tsx
      {/* 시점이 바뀌는 순간의 한 겹: 카메라 컷을 덮는다. 타이틀(z-40)보다 앞에 그려 그 아래에 선다 */}
      <ViewpointTransition />

      {/* 배트를 쥔 뒤: 문이 열리는 걸 보여주고 나서 화면을 덮는다 */}
      <EndingScreen />

      {/* 씬(z-0) < 대사(z-10) < HUD·모달(z-30) < 타이틀(z-40): 시작 전에는 전부 덮는다 */}
      <TitleScreen />
      // ...
      <BootCurtain />

      {/* 마우스를 따라오는 점과 링. 맨 위(개발 패널보다도 위)라 커튼·모달·DEV 패널 위에서도 손이 보인다 */}
      <CustomCursor />
```

**방 비네트와 1인칭 비네트** — `components/ui/MemoryRoom.tsx` · `MemoryRoom`

```tsx
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 transition-opacity duration-1000"
        style={{
          opacity: roomLightValue(ROOM_LIGHT_RAMP.vignette, heardLevel),
          background:
            "radial-gradient(115% 90% at 50% 42%, transparent 44%, color-mix(in srgb, var(--color-scene-void) 75%, transparent) 100%)",
        }}
      />
      // ...
        style={{
          opacity: viewpoint === "intro" ? 1 : viewpoint === "doorway" ? 0.55 : 0,
          background:
            "radial-gradient(62% 50% at 50% 52%, transparent 18%, color-mix(in srgb, var(--color-scene-void) 70%, transparent) 62%, var(--color-scene-void) 100%)",
        }}
```

**필름 그레인 타일** — `app/globals.css` · `.film-grain`, `components/ui/MemoryRoom.tsx`

```css
.film-grain {
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/><feColorMatrix type='saturate' values='0'/></filter><rect width='160' height='160' filter='url(%23n)' opacity='0.55'/></svg>");
  mix-blend-mode: overlay;
  opacity: 0.13;
}
```

```tsx
      <div
        aria-hidden
        className="film-grain pointer-events-none absolute inset-0 hidden motion-reduce:block"
      />
```

**`.room-backdrop`** — `app/globals.css` · `.room-backdrop`

```css
.room-backdrop {
  background:
    radial-gradient(
      78% 62% at 64% 28%,
      color-mix(in srgb, var(--color-memory) 22%, transparent) 0%,
      color-mix(in srgb, var(--color-memory) 9%, transparent) 38%,
      transparent 78%
    ),
    radial-gradient(
      130% 110% at 50% 42%,
      var(--color-scene-slate) 0%,
      var(--color-scene-deep) 55%,
      var(--color-night) 100%
    );
}
```

**진행 카운터** — `components/ui/MemoryRoom.tsx` · 헤더 진행 줄

```tsx
                <span
                  key={count}
                  className="inline-block animate-count-tick text-[1.3333em] font-medium text-memory"
                >
                  {count}
                </span>
// ...
              {roundMemories.map((memory, index) => (
                <span
                  key={memory.id}
                  aria-hidden
                  className={`h-0.5 w-[1.5em] rounded-full transition-colors duration-700 ${
                    // 새로 찬 칸은 왼쪽에서 차오른다. 이미 찬 칸은 클래스가 그대로라 다시 안 돈다
                    index < count ? "animate-segment-fill bg-memory" : "bg-ivory/25"
                  }`}
                />
              ))}
```

`app/globals.css` · `@keyframes segment-fill`, `.animate-segment-fill`

```css
  @keyframes segment-fill {
    from {
      transform: scaleX(0);
      box-shadow: 0 0 8px color-mix(in srgb, var(--color-memory) 70%, transparent);
    }
    to {
      transform: scaleX(1);
      box-shadow: 0 0 0 transparent;
    }
  }
/* ... */
.animate-segment-fill {
  transform-origin: left center;
}
```

**HUD 배율** — `app/globals.css` · `--text-hud`, `--hud-zoom`

```css
  --text-hud: clamp(1rem, 0.5rem + 0.85vw, 1.625rem);
  /* ... */
  --hud-zoom: clamp(1, 0.5 + 100vw / 1882px, 1.625);
```

**햄버거 ↔ X** — `app/globals.css` · `.menu-glyph`

```css
.menu-glyph line {
  transform-box: fill-box;
  transform-origin: center;
  transition:
    transform 220ms cubic-bezier(0.2, 0.7, 0.2, 1),
    opacity 160ms ease-out;
}

.menu-glyph[data-open="true"] .menu-glyph-top {
  transform: translateY(6px) rotate(45deg);
}

.menu-glyph[data-open="true"] .menu-glyph-mid {
  transform: scaleX(0);
  opacity: 0;
}

.menu-glyph[data-open="true"] .menu-glyph-bottom {
  transform: translateY(-6px) rotate(-45deg);
}
```

**소리 토글** — `components/ui/SoundToggle.tsx` · `SoundToggle`

```tsx
  const toggle = () => {
    // 켤 때만 소리를 낸다. 끄는 순간 소리가 나면 안 꺼진 것처럼 들린다
    if (soundMuted) {
      playSound("select");
      setPulseKey((key) => key + 1);
    }
    setSoundMuted(!soundMuted);
  };
// ...
      {pulseKey > 0 && (
        <span
          key={pulseKey}
          aria-hidden
          className="pointer-events-none absolute inset-0 animate-sound-pulse rounded-full border border-memory"
        />
      )}
```

**목표 배너 → 도크** — `components/ui/HudGuide.tsx` · `HudGuideBanner`, `HudGuideDock`

```tsx
    <div
      aria-hidden
      className={`monologue-text pointer-events-none flex max-w-full flex-col items-center gap-1 transition-[opacity,transform] duration-300 ease-out ${
        shown ? "opacity-100" : "-translate-x-6 -translate-y-3 opacity-0"
      }`}
    >
// ...
    <p
      role="status"
      className={`pointer-events-none inline-flex max-w-full items-center gap-[0.4em] text-[0.75em] font-medium text-fog transition-[opacity,transform] delay-150 duration-300 ease-out ${
        shown ? "opacity-100" : "translate-x-3 translate-y-2 opacity-0"
      }`}
    >
```

**기록 라벨** — `components/ui/HudLogLine.tsx` · `HudLogLine`, `app/globals.css` · `.hud-log-tainted`

```tsx
  const act = useMemoryRoomStore(selectAct);
  const dayKnown = useMemoryRoomStore((state) => state.collected.includes(DAY_MEMORY));
  const tainted = act === 3;
// ...
      <span className={tainted ? "hud-log-tainted text-ember" : "text-memory"}>
        MEMORY LOG 0{act}
      </span>
```

```css
.hud-log-tainted {
  text-shadow:
    1px 0 0 color-mix(in srgb, var(--color-ember) 55%, transparent),
    -1px 0 0 color-mix(in srgb, var(--color-scene-void) 80%, transparent),
    0 2px 5px rgb(5 10 18 / 0.85);
}
```

**수첩 손잡이** — `components/ui/NotebookTab.tsx` · `NotebookTab`

```tsx
      className={`absolute right-0 top-1/2 z-30 flex min-h-30 w-11 -translate-y-1/2 py-3 cursor-pointer [zoom:var(--hud-zoom)] flex-col items-center justify-center gap-2 rounded-l-md border border-r-0 border-line bg-surface text-fog transition-[color,background-color,width,opacity] duration-150 ease-out hover:w-12 hover:bg-surface-strong hover:text-ivory focus-visible:w-12 active:w-11 active:bg-surface-strong ${FOCUS_RING} ${menuOpen ? "pointer-events-none opacity-0" : ""} ${calling ? "animate-hotspot-glow text-ivory" : ""} ${firstUnread && !calling ? "border-memory/60 text-ivory" : ""}`}
    >
      <span className="text-xs font-medium tracking-[0.06em] [writing-mode:vertical-rl]">
        {t("panel.title")}
      </span>
      // ...
      {firstUnread && !calling && (
        <span aria-hidden className="absolute left-1 top-1 size-3">
          {/* 번지는 고리: 채운 원은 옅어지면 사라지므로 테두리로 번진다. 움직임 줄이기 설정이면 점만 남는다 */}
          <span className="absolute inset-0 rounded-full border-2 border-memory motion-safe:animate-notice-ripple" />
          <span className="absolute inset-0 rounded-full bg-memory ring-2 ring-surface" />
        </span>
      )}
```

`app/globals.css` · `@keyframes notice-ripple`

```css
  @keyframes notice-ripple {
    0% {
      transform: scale(1);
      opacity: 1;
    }
    45% {
      opacity: 0.7;
    }
    80%,
    100% {
      transform: scale(3.4);
      opacity: 0;
    }
  }
```

**스치는 한 줄** — `components/ui/RemarkLine.tsx` · `RemarkLine`

```tsx
const SHOW_MS = 3200;
/** 긴 줄(다 본 기억의 기록)은 글자 수만큼 더 머문다. 한국어를 소리 없이 읽는 속도쯤. */
const SHOW_PER_CHAR_MS = 90;
// ...
  const showMs = Math.max(SHOW_MS, Array.from(text).length * SHOW_PER_CHAR_MS);
// ...
    <p
      // 누를 때마다 새로 떠오른다. key가 바뀌어야 애니메이션이 다시 돈다
      key={remark.at}
      className={`monologue-text pointer-events-none absolute ${position} left-1/2 z-10 w-full max-w-xl -translate-x-1/2 animate-fade-rise break-ko text-pretty px-4 text-center font-pixel text-lg leading-normal text-ivory`}
    >
```

**혼잣말의 글자와 veil** — `app/globals.css` · `.monologue-text`, `.monologue-veil`

```css
.monologue-text {
  text-shadow:
    0 2px 5px rgb(5 10 18 / 0.85),
    0 0 16px rgb(5 10 18 / 0.45);
}
/* ... */
.monologue-veil {
  background: radial-gradient(
    60% 100% at 50% 50%,
    color-mix(in srgb, var(--color-night) 42%, transparent) 0%,
    color-mix(in srgb, var(--color-night) 18%, transparent) 55%,
    transparent 100%
  );
}
```

**글자 단위 퇴장의 지연 계획** — `components/ui/monologue-exit.ts` · `exitPlan`

```ts
export function exitPlan(text: string, act: Act, totalMs: number): ExitChar[] {
  const chars = Array.from(text);
  const length = chars.length;
  const spread = Math.max(0, totalMs);

  if (act === 1) {
    const tail = Math.min(ACT_ONE_TAIL_MAX, Math.ceil(length * ACT_ONE_TAIL_RATIO));
    const step = tail > 1 ? spread / (tail - 1) : 0;
    return chars.map((char, index) => {
      // 끝에서부터 센 자리. 마지막 글자가 0, 그 앞이 1, ...
      const fromEnd = length - 1 - index;
      const delayMs = fromEnd < tail ? fromEnd * step : spread;
      return { char, delayMs };
    });
  }

  const step = length > 1 ? spread / (length - 1) : 0;
  return chars.map((char, index) => ({ char, delayMs: index * step }));
}
```

**어절·글자 span** — `components/ui/Monologue.tsx` · `MonologueExitText`

```tsx
      {words.map((word, wordIndex) =>
        word.kind === "space" ? (
          word.text
        ) : (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: 물러나는 동안 본문은 얼려 있어 자리가 곧 정체다.
            key={wordIndex}
            className="whitespace-nowrap"
          >
            {word.chars.map((entry, charIndex) => (
              <span
                // biome-ignore lint/suspicious/noArrayIndexKey: 같은 이유. 같은 글자가 반복되면 인덱스 말고 구분할 값이 없다.
                key={charIndex}
                className={`inline-block monologue-exit-${direction}`}
                style={{ animationDelay: `${Math.round(entry.delayMs)}ms` }}
              >
                {entry.char}
              </span>
            ))}
          </span>
        ),
      )}
```

`app/globals.css` · `.monologue-exit-down`, `.monologue-exit-up`

```css
.monologue-exit-down {
  animation: monologue-exit-down 260ms ease-in both;
}

.monologue-exit-up {
  animation: monologue-exit-up 260ms ease-out both;
}
```

**숨길 때 opacity만** — `components/ui/Monologue.tsx` · `Monologue`

```tsx
    <div
      aria-hidden={hidden}
      className={`pointer-events-none relative w-full text-center transition-opacity duration-300 ${
        hidden ? "opacity-0" : "opacity-100"
      }`}
    >
```

**터치 조작** — `components/ui/MovementJoystick.tsx` · `onPointerDown`, 노브

```tsx
      onPointerDown={(event) => {
        if (disabled) return;
        event.preventDefault();
        activePointerRef.current = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        updateFromPointer(event);
      }}
// ...
        <span
          className="size-12 rounded-full border border-ivory/40 bg-ivory/85 shadow-chip"
          style={{ transform: `translate3d(${knobOffset.x}px, ${knobOffset.y}px, 0)` }}
        />
```

`components/ui/LookButtons.tsx` · `LookButtons`

```tsx
    const tick = (now: number) => {
      const step = Math.min(0.05, (now - last) / 1000);
      last = now;
      const { direction } = holdRef.current;
      if (direction !== 0) lookRef.current.yaw += direction * TURN_RATE * step;
      frameRef.current = window.requestAnimationFrame(tick);
    };
```

---

## 14. CSS·DOM: 대사 시스템

- **대사창** `.dialogue-panel`: 위는 비치고 아래로 짙어지는 그라데이션. 테두리 없이 위쪽에만 memory 1px 선을 둬 자막처럼 보인다. 글자는 `--text-dialogue`(16→24px)를 따르고 여백은 em이라 같이 자란다.
- **전체 화면이 "다음" 버튼**: 창 자체는 `pointer-events-none`이다. 창 안에서 눌리는 것은 로그 버튼 하나뿐이다(`pointer-events-auto`).
- **타자기** (`lib/use-typewriter.ts`): 70ms/글자, 코드포인트 단위. 클릭하면 먼저 채우고, 다 찼으면 다음 줄로 간다. reduced motion이면 처음부터 다 찬다.
- **화자 전환**: 화자가 바뀔 때만 `speaker-swap`(`key={speakerName}`). 본문 높이는 두 줄(`min-h-[3.5em]`)로 고정해 창이 출렁이지 않는다. 다음 표식은 `bob-arrow`.
- **초상** (`CharacterPortrait.tsx`)
  - 밑단 12%를 `mask-image`로 흐린다(`.portrait-fade`). 그 대부분은 패널 뒤로 들어간다.
  - 표정 전환은 **바닥 프레임을 늘 불투명하게 깔고** 위 레이어만 페이드한다(200ms). 투명 PNG 두 장을 교차 페이드하면 합성 알파가 떨어져 캐릭터가 비쳐 보인다.
- **오토 모드**: `min(5200, 900 + 글자수×60)ms`. 로그가 떠 있으면 멈춘다. 내레이션 컷은 오토 설정과 무관하게 같은 박자로 흐른다.
- **키보드**: window **캡처 단계**에서 Enter/Space를 받는다. 뒤에 살아 있는 미니게임에 입력이 새지 않게 하려는 것이다. 포커스가 잡힌 다른 컨트롤이 있으면 비켜 준다(대사창 자신의 넘기기 버튼은 예외).
- **글자 틱 사운드** (`dialogue-sfx.ts`): 두 글자마다 한 번 울리고 구두점·공백은 침묵한다. **화자마다 음높이가 다르다**(라단조 5음계 비율: 아빠 0.75, 엄마 1.335, 내레이터 0.96). 방송 화자는 잡음 틱. 정확히 한 글자 늘었을 때만 울어서 건너뛰기에는 틱이 없다.
- **대사 로그**: 최근 14줄, 오래된 줄일수록 옅다(0.42 → 1). 방 위에 `scene-void/85` + `backdrop-blur-[2px]` 한 겹을 덮고 글자만 얹는다. 어디를 눌러도 닫히고, 닫는 법이 안 보인다는 피드백에 제목줄 오른쪽에 **X 버튼**을 더했다(click이 겹까지 올라가 닫으므로 핸들러가 따로 없다). click으로 닫히므로 스크롤 제스처로는 닫히지 않는다. Escape도 캡처로 받는다. `scrollIntoView` 대신 scrollTop을 직접 쓴다(HUD가 밀리는 버그가 있었다).

### 관련 코드

**대사창** — `app/globals.css` · `.dialogue-panel`

```css
.dialogue-panel {
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--color-night) 80%, transparent),
    color-mix(in srgb, var(--color-scene-void) 96%, transparent)
  );
  border: 0;
  border-top: 1px solid color-mix(in srgb, var(--color-memory) 16%, transparent);
  border-radius: var(--radius-xs);
  /* 글자(--text-dialogue)가 폭 따라 커지는 만큼 여백도 같이 자란다: 16px 기준 18/24/22px */
  padding: 1.125em 1.5em 1.375em;
  box-shadow: 0 12px 32px rgb(0 0 0 / 0.18);
}
```

**전체 화면이 "다음" 버튼** — `components/ui/DialogueBox.tsx` · `DialogueBox`

```tsx
      <button
        type="button"
        {...{ [ADVANCE_ATTR]: "" }}
        // 타자 연출 중 클릭은 대사를 건너뛰지 않고 먼저 다 채운다 (VN 관례)
        onClick={() => advanceRef.current()}
        // 로그가 떠 있는 동안은 뒤의 전체 화면 버튼이 눌리지 않는다
        disabled={logOpen}
        aria-label={done ? t("dialogue.advance") : t("dialogue.skipTyping")}
        className="absolute inset-0 cursor-pointer"
      />
      // ...
      <div className="pointer-events-none absolute bottom-[calc(3.5rem+env(safe-area-inset-bottom))] left-1/2 w-full max-w-[clamp(840px,66vw,1040px)] -translate-x-1/2 animate-fade-rise px-4 sm:bottom-[max(2rem,env(safe-area-inset-bottom))] lg:bottom-[max(2.5rem,env(safe-area-inset-bottom))]">
```

**타자기** — `lib/use-typewriter.ts` · `useTypewriterState`

```ts
export function useTypewriterState(text: string, charMs = 70): TypewriterState {
  const chars = useMemo(() => Array.from(text), [text]);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setCount(chars.length);
      return;
    }
    setCount(0);
    const id = window.setInterval(() => {
      setCount((current) => {
        if (current >= chars.length) {
          window.clearInterval(id);
          return current;
        }
        return current + 1;
      });
    }, charMs);
    return () => window.clearInterval(id);
  }, [chars, charMs]);
```

`components/ui/DialogueBox.tsx` · `advanceRef`

```tsx
  advanceRef.current = () => {
    if (done) {
      playSound("advance");
      advanceLine();
    } else {
      playSound("typeSkip");
      skip();
    }
  };
```

**화자 전환과 두 줄 높이** — `components/ui/DialogueBox.tsx` · `DialogueBox`

```tsx
            <span
              key={speakerName}
              className="block animate-speaker-swap text-[0.8125em] font-medium leading-none text-memory"
            >
              {speakerName}
            </span>
            // ...
            <p
              key={lineKey}
              className="mt-[0.625em] min-h-[3.5em] break-ko text-pretty text-[1em] leading-dialogue text-ivory"
            >
              {typed}
            </p>
            // ...
              <div
                aria-hidden
                className={`animate-bob-arrow text-memory transition-opacity ${
                  done ? "opacity-100" : "opacity-0"
                }`}
              >
```

**초상** — `app/globals.css` · `.portrait-fade`, `components/ui/CharacterPortrait.tsx` · `CharacterPortrait`

```css
.portrait-fade {
  mask-image: linear-gradient(to bottom, black 88%, transparent 100%);
}
```

```tsx
      <Image
        src={PORTRAIT_SOURCES[PORTRAIT_BASE_EXPRESSION]}
        alt=""
        fill
        sizes={PORTRAIT_SIZES}
        draggable={false}
        className={PORTRAIT_IMAGE_CLASS}
      />
      {PORTRAIT_OVERLAY_EXPRESSIONS.map((candidate) => (
        <Image
          key={candidate}
          src={PORTRAIT_SOURCES[candidate]}
          // ...
          // 겹쳐두고 opacity만 바꾼다. src를 갈아끼우면 프레임마다 깜빡인다
          className={`${PORTRAIT_IMAGE_CLASS} transition-opacity duration-200 ${
            candidate === expression ? "opacity-100" : "opacity-0"
          }`}
        />
      ))}
```

**오토 모드** — `components/ui/DialogueBox.tsx` · 오토 effect

```tsx
const AUTO_BASE_MS = 900;
const AUTO_PER_CHAR_MS = 60;
const AUTO_MAX_MS = 5200;
// ...
  const flowing = autoPlay || narration;
  useEffect(() => {
    if (!flowing || !done || !open || logOpen) return;
    const wait = Math.min(AUTO_MAX_MS, AUTO_BASE_MS + text.length * AUTO_PER_CHAR_MS);
    const timer = window.setTimeout(() => autoAdvanceRef.current(), wait);
    return () => window.clearTimeout(timer);
    // 줄이 바뀌면 타자 연출이 다시 돌아 done이 false로 떨어졌다 올라온다: 그게 곧 타이머의 재시작이다
  }, [flowing, done, open, logOpen, text]);
```

**키보드 캡처** — `components/ui/DialogueBox.tsx` · 키 effect

```tsx
    const onKey = (event: KeyboardEvent) => {
      if ((event.key !== "Enter" && event.code !== "Space") || event.repeat) return;
      // 로그가 떠 있으면 그쪽이 화면의 주인이다. 대사를 넘기지 않는다
      if (useMemoryRoomStore.getState().dialogueLogOpen) return;
      const target = event.target;
      const isOwnButton = target instanceof Element && target.closest(`[${ADVANCE_ATTR}]`) !== null;
      if (!isOwnButton && isInteractiveTarget(target)) return;
      event.preventDefault();
      event.stopPropagation();
      advanceRef.current();
    };
    window.addEventListener("keydown", onKey, true);
```

**글자 틱 사운드** — `components/ui/dialogue-sfx.ts` · `typeTick`

```ts
const SPEAKER_PITCH: Partial<Record<CharacterId, number>> = {
  hero: 1,
  dad: 0.75,
  mom: 1.335,
  narrator: 0.96,
};
// ...
export function typeTick(speaker: CharacterId, char: string, count: number): TypeTick | null {
  // 첫 글자에서 울려야 말이 시작되는 순간과 소리가 붙는다 (count 1, 3, 5, ...)
  if (count % TICK_EVERY !== 1) return null;
  if (!SOUNDING.test(char)) return null;
  if (RADIO_SPEAKERS.includes(speaker)) return { id: "typeRadio", options: { variation: 0.12 } };
  // 흔든다. 완전히 같은 음의 연타는 말이 아니라 알람이다. 반음(6%) 안쪽이라 화자는 안 섞인다
  return { id: "type", options: { pitch: SPEAKER_PITCH[speaker] ?? 1, variation: 0.05 } };
}
```

`components/ui/DialogueBox.tsx` · 틱 effect

```tsx
  useEffect(() => {
    const previous = tickedCount.current;
    tickedCount.current = count;
    if (!speaker || count !== previous + 1) return;
    const char = Array.from(typed).at(-1);
    if (!char) return;
    const tick = typeTick(speaker, char, count);
    if (tick) playSound(tick.id, tick.options);
  }, [count, typed, speaker]);
```

**대사 로그** — `components/ui/DialogueLog.tsx` · `DialogueLog`

```tsx
const VISIBLE_LINES = 14;
/** 가장 오래된 줄의 불투명도. 1까지 올라오며 최신 줄이 가장 진하다. */
const FADE_FLOOR = 0.42;
// ...
    const scroller = scrollerRef.current;
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
// ...
    <section
      aria-label={t("dialogue.log")}
      className="absolute inset-0 z-[60] flex animate-fade-rise cursor-pointer flex-col bg-scene-void/85 backdrop-blur-[2px]"
      // 어디를 눌러도 닫힌다. 굴리기(휠·손가락 쓸기)는 click이 아니라 그대로 살아 있다
      onClick={() => setOpen(false)}
    >
      <div className="flex flex-none items-center justify-between gap-4 px-5 pt-4 sm:px-8 sm:pt-6">
        // ...
        {/* 닫기는 겹을 누른 것과 같다. click이 겹까지 올라가 닫으므로 따로 할 일이 없다 */}
        <button
          type="button"
          aria-label={t("dialogue.logClose")}
          className={`cursor-pointer text-fog transition-colors hover:text-ivory active:text-ivory/80 ${FOCUS_RING}`}
        >
          <X size={18} weight="bold" />
        </button>
      </div>
      // ...
              <li
                // biome-ignore lint/suspicious/noArrayIndexKey: 같은 줄이 여러 번 흐를 수 있다. 자리가 곧 순서다
                key={index}
                style={{
                  opacity: FADE_FLOOR + (1 - FADE_FLOOR) * ((index + 1) / recent.length),
                }}
              >
```

---

## 15. CSS·DOM: 컷씬, 웹툰, 시점 전환

### 컷씬 (`PlaybackScene.tsx`)
- **등장**: 한 박자(0.26s) 숨었다가 떠오른다(`playback-enter`). 그 사이 방은 캔버스 셰이더의 **tear**로 찢긴다(ScreenTransition). 모션을 끄면 기다리지 않는다.
- **라디오 도입 3단계**: 정적(그레인 떨림 + 노이즈 베드, 1.1초) → 블랙아웃(완전 침묵, 0.9초) → 컷. intro를 달고 열린 컷씬만 이 도입을 탄다.
- **SignalVisual**: 그림이 아직 없는 컷의 대체 화면.
  - 56개 막대 파형. 막대마다 해시로 음수 delay와 포락선을 준다.
  - 다이얼 눈금, 불규칙 램프(`steps(6)`), 스캔라인.
  - 방송이 죽는 컷은 ember, 살아나는 컷은 memory로 **색만 바꿔** 같은 파형에 다른 뜻을 준다.
- **흐린 미리보기**: 컷 그림이 받아지기 전에는 빈 판 대신 구워 둔 흐린 판(`blurBackdrop`)이 `<img>` 배경으로 선다. 맞춤(`cover`/`contain`)은 `<img>`의 object-fit과 같게 둬 받아지는 순간 형태가 튀지 않는다. 웹툰 칸·엔딩 그림·수첩 스틸·일부 미니게임 그림도 같은 자료(`pnpm images:blur`)를 쓴다.
- **필름 먼지와 스크래치**: 그라데이션 점 타일이 `steps(1)`로 **순간이동**한다(흐르게 하면 눈 내리는 것처럼 보인다). 스크래치는 7.3초 주기 중 두 지점에서만 선다. 모션을 끄면 먼지는 없앤다.
- **사운드**: 필름 릴 시작음, 테이프 히스 노이즈 베드, 컷마다 셔터음. 웹툰은 필름이 아니라 라디오라 셋 다 없다.

### 컷 전환 노이즈 디졸브 (`CutDissolve.tsx`, `cut-dissolve.ts`)
- 앞 컷 이미지를 붙잡을 수 없어서, void 색 장막을 새 컷 위에 덮고 **노이즈를 문턱값으로 잘라** 걷어낸다(600ms, smoothstep). 첫 컷에는 걸지 않는다.
- 결은 컷 번호마다 순환한다: `paper`(가로 박스 평균 섬유결) → `film`(픽셀 백색잡음, 스무딩 끄고 2배 타일) → `water`(value noise 두 옥타브 얼룩).
- 30fps로 제한하고 **알파 채널만** 다시 쓴다(128×128 판). 장막 색은 캔버스에 `text-scene-void`를 입혀 `getComputedStyle`로 토큰에서 읽는다.

### 사진 모프 (`PhotoMorph.tsx`, `photo-morph.ts`)
- 액자 다시보기에서 1막 사진(부모 얼굴이 잘림)이 2막 사진(셋이 다 보임)으로 밀려 넘어간다(700ms 뒤 시작, 1.3초).
- 두 가지가 동시에 일어난다.
  - **틀이 물러남**: 1막이 담은 영역(`within`)에서 전체로 lerp한다(`cameraRect`). 두 그림을 늘 같은 자리에 겹쳐 이중노출을 막는다.
  - **변위장 밀림**: water 노이즈 두 장을 x·y 변위장으로 쓴다.
- 프리멀티플라이 알파로 섞고 가장자리를 페더링한다. 방이 이미 WebGL을 쓰고 있어 Canvas 2D로 처리한다(긴 변 320px, 30fps). 끝나면 300ms에 걸쳐 원본 `<img>`에 자리를 넘긴다.

### 웹툰 뷰어 (`WebtoonViewer.tsx`)
- 칸이 번호순으로 떠오르고, 아직 차례가 아닌 칸은 `invisible`로 자리만 지킨다.
- 페이지는 좌우로 넘어간다. 옛 장을 500ms 붙들어 둔다. 말풍선은 칸이 다 뜬 뒤(페이지가 넘어가는 중이면 그것까지 끝난 뒤) 찍기 시작한다.
- 넘치는 페이지는 현재 칸이 든 줄을 화면 가운데로 끌어올린다(`translate` 700ms).
- **흰 타원 말풍선**: 칸 아래 테두리에 걸쳐 칸 밖으로 나간다. 앞 칸의 z-index를 위로 둬 다음 칸 그림에 덮이지 않는다.
  - **아직 안 찍힌 글자를 `invisible` span으로 미리 깔아** 타자기가 찍히는 동안 줄바꿈이 흔들리지 않는다. 문장 하나를 `inline-block`으로 묶어 말 가운데서 끊기지 않게 한다.
- **의성어** `.webtoon-sfx`: `-webkit-text-stroke` + `paint-order: stroke fill`.

### 시점 전환 (`ViewpointTransition.tsx`)
- 덮개 톤은 네 가지다: 눈을 뜨는 어둠(enter, 1.4s), 불 켜기(lightsOn, 2.8s: **순백 대신** 어둠에서 누르스름한 중간 밝기로 물들며 걷힌다, 광과민 배려), 문 넘기(memory, 1s), 워프(흐림만, 0.36s).
- 시계가 아니라 **rAF 두 번 + 160ms** 뒤에 걷힌다. 새 카메라가 실제로 한 장 그려진 뒤여야 하기 때문이다.
- **초점 맞춤**: `backdrop-filter: blur()`를 0까지 애니메이션한다(lightsOn 14px, warp 8px). 덮개의 자식이 아니라 **형제**로 둔다. opacity가 움직이는 조상 아래의 backdrop-filter는 캔버스에 닿지 않기 때문이다.

### 관련 코드

**등장** — `app/globals.css` · `@keyframes playback-enter`

```css
  --animate-playback-enter: playback-enter 0.5s ease-out both;
  /* ... */
  @keyframes playback-enter {
    0%,
    52% {
      opacity: 0;
    }
    100% {
      opacity: 1;
    }
  }
```

**라디오 도입 3단계** — `components/ui/PlaybackScene.tsx` · 도입 effect

```tsx
    setStage("static");
    const bed = startNoiseBed({ gain: 0.09, highpass: 900, lowpass: 7000 });
    bed?.setLevel(1);
    const toBlackout = window.setTimeout(() => {
      bed?.stop();
      playSound("radioCut");
      setStage("blackout");
    }, STATIC_MS);
    const toCuts = window.setTimeout(() => {
      setStage("cuts");
      advancePlayback();
    }, STATIC_MS + BLACKOUT_MS);
```

```tsx
      <div
        aria-hidden
        className={`film-grain pointer-events-none absolute inset-0 transition-opacity duration-200 ${
          stage === "static" ? "animate-signal-static opacity-100" : "opacity-0"
        }`}
      />
```

**SignalVisual** — `components/ui/PlaybackScene.tsx` · `WAVE_SHAPE`, `SignalVisual`

```tsx
const WAVE_SHAPE = Array.from({ length: WAVE_BARS }, (_, index) => {
  const phase = Math.sin(index * 12.9898) * 43758.5453;
  const noise = phase - Math.floor(phase);
  // 가운데가 높고 양끝이 낮은 봉우리 위에 잡음을 얹는다
  const envelope = 0.35 + 0.65 * Math.sin((index / (WAVE_BARS - 1)) * Math.PI);
  return { delay: noise * 1.9, height: 0.25 + 0.75 * envelope * (0.55 + 0.45 * noise) };
});
// ...
  const bar = tone === "dying" ? "bg-ember/70" : "bg-memory/80";
  // ...
        {WAVE_SHAPE.map((shape, index) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: 고정 길이 파형이라 자리 자체가 정체성이다.
            key={index}
            className={`animate-signal-wave block h-full flex-1 rounded-full ${bar}`}
            style={{
              animationDelay: `-${shape.delay.toFixed(2)}s`,
              maxHeight: `${(shape.height * 100).toFixed(1)}%`,
            }}
          />
        ))}
```

**흐린 미리보기** — `lib/image-blur.ts` · `blurBackdrop`

```ts
export function blurBackdrop(
  src: string | undefined,
  fit: "cover" | "contain" | "fill" = "cover",
): CSSProperties | undefined {
  const data = blurDataUrlOf(src);
  if (!data) return undefined;
  return {
    backgroundImage: `url(${data})`,
    backgroundSize: fit === "fill" ? "100% 100%" : fit,
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
  };
}
```

`components/ui/PlaybackScene.tsx` · 컷 그림

```tsx
                // 받아지기 전엔 흐린 판이 선다. 맞춤은 아래 object-fit과 같아야 받는 순간 튀지 않는다
                style={blurBackdrop(
                  image,
                  cut?.fit === "contain" || !isCutscene ? "contain" : "cover",
                )}
```

**필름 먼지와 스크래치** — `app/globals.css` · `.film-dust`, `.film-scratch`

```css
.film-dust {
  --dust: color-mix(in srgb, var(--color-ivory) 55%, transparent);
  --lint: color-mix(in srgb, var(--color-scene-void) 70%, transparent);
  background-image:
    radial-gradient(circle at 12% 18%, var(--dust) 0 1px, transparent 1.5px),
    radial-gradient(circle at 71% 34%, var(--dust) 0 0.8px, transparent 1.3px),
    radial-gradient(circle at 43% 77%, var(--lint) 0 1.4px, transparent 2px),
    radial-gradient(circle at 88% 63%, var(--dust) 0 0.7px, transparent 1.2px),
    radial-gradient(ellipse at 27% 52%, var(--lint) 0 0.6px, transparent 2.4px);
  background-size: 37vmax 31vmax;
  animation: film-dust-jump 0.9s steps(1, end) infinite;
}
/* ... */
@keyframes film-scratch-flicker {
  0%,
  100% {
    opacity: 0;
  }
  31% {
    opacity: 1;
    transform: translateX(23vw);
  }
  33% {
    opacity: 0.5;
    transform: translateX(23.3vw);
  }
  35% {
    opacity: 0;
  }
  78% {
    opacity: 0.8;
    transform: translateX(67vw);
  }
  80% {
    opacity: 0;
  }
}
```

**사운드** — `components/ui/PlaybackScene.tsx` · 상영 effect

```tsx
  const webtoon = isCutscene && active?.cuts.some((each) => each.page !== undefined) === true;
  const screening = active !== null && stage === "cuts" && !bare && !webtoon;
  useEffect(() => {
    if (!screening) return;
    playSound("reelStart");
    const bed = startNoiseBed(TAPE_HISS);
    bed?.setLevel(1);
    return () => bed?.stop();
  }, [screening]);

  // 컷이 바뀔 때마다 셔터 한 번. 첫 컷은 reelStart의 몫이라 울리지 않는다
  const cutIndex = active?.cutIndex ?? 0;
  useEffect(() => {
    if (screening && cutIndex > 0) playSound("cutChange");
  }, [screening, cutIndex]);
```

**컷 전환 노이즈 디졸브** — `components/ui/CutDissolve.tsx` · `draw`, `loop`

```tsx
    const draw = (threshold: number) => {
      // 문턱값을 0..256으로 올려 비교한다: 1이면 바이트 255까지 전부 덮이고, 0이면 아무것도 안 덮인다
      const cutoff = threshold * 256;
      for (let i = 0; i < noise.length; i += 1) {
        pixels.data[i * 4 + 3] = noise[i] < cutoff ? 255 : 0;
      }
      plateContext.putImageData(pixels, 0, 0);
      context.clearRect(0, 0, width, height);
      if (grain === "film") {
        // 필름: 노이즈 픽셀이 그대로 알갱이로 서야 한다. 늘리지 않고 작은 배수로 깐다
        context.imageSmoothingEnabled = false;
        const tile = NOISE_SIZE * FILM_TILE_SCALE;
        for (let y = 0; y < height; y += tile) {
          for (let x = 0; x < width; x += tile) {
            context.drawImage(plate, x, y, tile, tile);
          }
        }
      } else {
        // 종이·물: 판 하나를 화면 크기로 늘린다. 보간이 얼룩의 가장자리를 부드럽게 한다
        context.imageSmoothingEnabled = true;
        context.drawImage(plate, 0, 0, width, height);
      }
    };

    const loop = (now: number) => {
      const elapsed = now - started;
      if (elapsed >= durationMs) {
        // 다 걷혔다: 완전히 투명하게 비우고 루프를 놓는다
        context.clearRect(0, 0, width, height);
        frame = 0;
        return;
      }
      if (now - lastDrawn >= MIN_FRAME_MS) {
        lastDrawn = now;
        draw(dissolveThreshold(elapsed, durationMs));
      }
      frame = requestAnimationFrame(loop);
    };
```

**장막 색을 토큰에서** — `components/ui/CutDissolve.tsx` · `CutDissolve`

```tsx
    // 장막 색은 토큰에서. 캔버스에 text-scene-void를 입혀 두고 계산된 color를 읽는다
    const rgb = parseRgb(window.getComputedStyle(canvas).color);
    if (!rgb) return;
```

**결의 순환과 문턱값 곡선** — `components/ui/cut-dissolve.ts` · `grainForCut`, `dissolveThreshold`

```ts
const GRAIN_CYCLE: readonly NoiseGrain[] = ["paper", "film", "water"];

/** 이 컷으로 넘어올 때 쓰는 결. 컷 번호만으로 정해지니 다시 봐도 같다. */
export function grainForCut(cutIndex: number): NoiseGrain {
  const slot = Math.abs(Math.trunc(cutIndex)) % GRAIN_CYCLE.length;
  return GRAIN_CYCLE[slot];
}
// ...
export function dissolveThreshold(elapsedMs: number, durationMs: number): number {
  if (durationMs <= 0) return 0;
  const progress = Math.min(1, Math.max(0, elapsedMs / durationMs));
  const eased = progress * progress * (3 - 2 * progress);
  return 1 - eased;
}
```

**종이결 노이즈** — `components/ui/cut-dissolve.ts` · `bakePaper`

```ts
function bakePaper(out: Uint8Array, width: number, height: number, seed: number): void {
  const half = Math.floor(PAPER_KERNEL / 2);
  const stretch = Math.sqrt(PAPER_KERNEL);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      for (let k = -half; k <= half; k += 1) {
        sum += hash((x + k + width) % width, y, seed);
      }
      const mean = sum / PAPER_KERNEL;
      out[y * width + x] = toByte(0.5 + (mean - 0.5) * stretch);
    }
  }
}
```

**사진 모프: 틀이 물러남** — `components/ui/photo-morph.ts` · `cameraRect`

```ts
export function cameraRect(within: Rect, progress: number): Rect {
  return lerpRect(within, WHOLE_FRAME, clamp01(progress));
}
```

**사진 모프: 변위장** — `components/ui/photo-morph.ts` · `bakeDisplacement`

```ts
export function bakeDisplacement(width: number, height: number, seed: number): Displacement {
  const count = Math.max(0, width * height);
  const x = new Float32Array(count);
  const y = new Float32Array(count);
  if (count === 0) return { x, y };
  const plateX = bakeNoise(width, height, "water", seed);
  const plateY = bakeNoise(width, height, "water", seed + 977);
  for (let i = 0; i < count; i += 1) {
    x[i] = (plateX[i] / 255) * 2 - 1;
    y[i] = (plateY[i] / 255) * 2 - 1;
  }
  return { x, y };
}
```

**사진 모프: 프리멀티플라이 섞기** — `components/ui/PhotoMorph.tsx` · `paintLayer`, `draw`

```tsx
      const fade = feather > 0 ? edgeFalloff(x + 0.5, y + 0.5, dest, feather) : 1;
      const alpha = data[i + 3] * fade;
      out[i] = (data[i] * alpha) / 255;
      out[i + 1] = (data[i + 1] * alpha) / 255;
      out[i + 2] = (data[i + 2] * alpha) / 255;
      out[i + 3] = alpha;
// ...
            // 가장자리에서는 밀지 않는다. 밀면 그림의 끝이 찢어진 것처럼 들쭉날쭉해진다
            const reach = push * edgeFalloff(x + 0.5, y + 0.5, box, feather);
            const pushX = field.x[here] * reach;
            const pushY = field.y[here] * reach;
            const ax = Math.min(lastX, Math.max(0, Math.round(x + pushX * progress)));
            const ay = Math.min(lastY, Math.max(0, Math.round(y + pushY * progress)));
            const bx = Math.min(lastX, Math.max(0, Math.round(x - pushX * back)));
            const by = Math.min(lastY, Math.max(0, Math.round(y - pushY * back)));
            // ...
            const alpha = ahead[ai + 3] * back + behind[bi + 3] * progress;
            out[oi + 3] = alpha;
            // ...
            // 섞고 나서 알파를 도로 나눈다 (paintLayer의 짝)
            const scale = 255 / alpha;
            out[oi] = (ahead[ai] * back + behind[bi] * progress) * scale;
```

**웹툰: 칸 등장과 페이지 넘김** — `components/ui/WebtoonViewer.tsx` · `WebtoonViewer`, `Panel`

```tsx
  useEffect(() => {
    if (livePage === shownPage) return;
    setLeavingPage(shownPage);
    setShownPage(livePage);
    const timer = window.setTimeout(() => setLeavingPage(null), PAGE_TURN_MS);
    return () => window.clearTimeout(timer);
  }, [livePage, shownPage]);
// ...
      {leavingPage !== null && renderPage(leavingPage, "animate-webtoon-page-out")}
      {renderPage(shownPage, leavingPage !== null ? "animate-webtoon-page-in" : "")}
// ...
    <div
      className={`relative ${cut.ratio === "3:4" ? "aspect-[3/4]" : "aspect-video"} ${
        shown ? "animate-webtoon-panel-in" : "invisible"
      }`}
      style={{ zIndex: layer }}
    >
```

`app/globals.css` · `@keyframes webtoon-page-in`

```css
  @keyframes webtoon-page-in {
    from {
      opacity: 0.4;
      transform: translateX(100%);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
```

**웹툰: 현재 줄을 가운데로** — `components/ui/WebtoonViewer.tsx` · `renderPage`

```tsx
        <div
          className="absolute top-0 left-1/2 flex flex-col transition-transform duration-700 ease-out"
          style={{ width, gap, transform: `translate(-50%, ${top}px)` }}
        >
```

**웹툰: 말풍선** — `components/ui/WebtoonViewer.tsx` · `PageRow`, `RadioBubble`

```tsx
            // 앞 칸이 위에 선다: 칸 아래로 걸친 말풍선이 다음 칸 그림에 덮이지 않게
            layer={cuts.length - index}
// ...
      className="absolute animate-fade-rise rounded-[50%] border-2 border-ink bg-ivory px-[16%] py-[1.7em] text-center text-ink"
      style={{ fontSize, bottom: `-${BUBBLE_OVERHANG_EM}em`, ...place }}
    >
      // ...
        {sentenceSpans(fullText).map(({ start, sentence }, index) => {
          const shown = Math.max(0, Math.min(sentence.length, text.length - start));
          return (
            <Fragment key={start}>
              {index > 0 && " "}
              <span className="inline-block text-balance">
                {sentence.slice(0, shown)}
                <span className="invisible">{sentence.slice(shown)}</span>
              </span>
            </Fragment>
          );
        })}
```

**웹툰: 의성어** — `app/globals.css` · `.webtoon-sfx`

```css
.webtoon-sfx {
  color: var(--color-ivory);
  -webkit-text-stroke: 0.06em var(--color-scene-void);
  paint-order: stroke fill;
  text-shadow: 0.05em 0.07em 0 var(--color-scene-void);
  line-height: 1;
  white-space: nowrap;
}
```

**시점 전환: 덮개 톤** — `components/ui/ViewpointTransition.tsx` · `TONES`, `transitionTone`

```tsx
const TONES = {
  enter: {
    className: "bg-scene-void",
    lift: "animate-viewpoint-fade",
    durationMs: 1400,
    blurPx: 0,
  },
  lightsOn: {
    className: "viewpoint-lamp",
    lift: "animate-viewpoint-dawn",
    durationMs: 2800,
    blurPx: 14,
  },
  doorway: { className: "bg-memory", lift: "animate-viewpoint-fade", durationMs: 1000, blurPx: 0 },
  warp: { className: "bg-transparent", lift: "animate-viewpoint-fade", durationMs: 360, blurPx: 8 },
} as const;
// ...
export function transitionTone(previous: Viewpoint, next: Viewpoint): Tone | null {
  if (previous === next) return null;
  if (next !== null) return "enter";
  return previous === "intro" ? "lightsOn" : "doorway";
}
```

**시점 전환: 불 켜기의 누런 새벽** — `app/globals.css` · `@keyframes viewpoint-dawn`

```css
@keyframes viewpoint-dawn {
  0% {
    background-color: var(--color-scene-void);
    opacity: 1;
    animation-timing-function: cubic-bezier(0.5, 0, 0.75, 1);
  }
  40% {
    background-color: color-mix(in srgb, var(--color-scene-sun) 30%, var(--color-night));
    opacity: 0.85;
    animation-timing-function: cubic-bezier(0.45, 0, 0.55, 1);
  }
  100% {
    background-color: color-mix(in srgb, var(--color-scene-sun) 30%, var(--color-night));
    opacity: 0;
  }
}
```

**시점 전환: rAF 두 번 + 160ms** — `components/ui/ViewpointTransition.tsx` · `ViewpointTransition`

```tsx
const HOLD_MS = 160;
// ...
  useEffect(() => {
    if (!flash) return;
    setLifting(false);
    let inner = 0;
    let timer = 0;
    const outer = window.requestAnimationFrame(() => {
      inner = window.requestAnimationFrame(() => {
        timer = window.setTimeout(() => setLifting(true), HOLD_MS);
      });
    });
```

**시점 전환: 초점 맞춤** — `app/globals.css` · `.viewpoint-focus`, `components/ui/ViewpointTransition.tsx`

```css
.viewpoint-focus {
  -webkit-backdrop-filter: blur(var(--viewpoint-blur, 12px));
  backdrop-filter: blur(var(--viewpoint-blur, 12px));
}
.animate-viewpoint-focus {
  animation: viewpoint-focus 1s cubic-bezier(0.2, 0.6, 0.3, 1) both;
}
@keyframes viewpoint-focus {
  from {
    -webkit-backdrop-filter: blur(var(--viewpoint-blur, 12px));
    backdrop-filter: blur(var(--viewpoint-blur, 12px));
  }
  to {
    -webkit-backdrop-filter: blur(0);
    backdrop-filter: blur(0);
  }
}
```

```tsx
    <Fragment key={flash.id}>
      // ...
      {blurPx > 0 && focusEnabled && (
        <span
          aria-hidden
          className={`viewpoint-focus pointer-events-none absolute inset-0 z-40 motion-reduce:hidden ${
            lifting ? "animate-viewpoint-focus" : ""
          }`}
          // ...
        />
      )}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 z-40 ${className} ${
          lifting ? lift : "opacity-100"
        }`}
        style={lifting ? { animationDuration: `${durationMs}ms` } : undefined}
      />
    </Fragment>
```

---

## 16. CSS·DOM: 단서, 수첩, 모달

- **단서 오버레이**: 닫기 버튼을 **종이 밖**(`-top-12`)에 둔다. 종이 위에 버튼이 얹히면 창처럼 보이기 때문이다. 접힌 쪽지는 SVG 종이(`clue-note-paper.svg`) 위에 i18n 글씨를 올린다. 화면에 안 보이는 키보드·스크린리더용 단서 목록(`ClueKeyboardList`)이 늘 깔려 있다.
- **거울 유리** `.mirror-glass` (`CharacterModelViewer`): 사선 하이라이트와 세로 그라데이션.
- **수첩** (`CharacterSheetModal.tsx` 등)
  - **페이지**: 인물 · 기록 · 평면도(방문이 열린 뒤에만) · 소지품. 안 펼쳐 본 기록이 있는 탭에는 금빛 점이 선다.
  - **제본 구멍**: `.notebook-punch` radial-gradient를 repeat-y로 반복한다. 구멍 안이 씬 색(`scene-void`)이라 실제로 뚫린 것처럼 보인다.
  - **모눈**: `repeating-linear-gradient` 24px 격자. 이미지 에셋은 없다.
  - **접힘 그림자**: gutter 그라데이션을 스크롤 영역 밖, 페이지 위에 고정한다.
  - **인덱스 탭**: 탭 줄이 `-mb-px`로 아래 선에 겹치고, 고른 탭은 `border-b-transparent bg-paper`로 그 선을 덮어 페이지와 한 장처럼 이어진다.
  - **잠긴 값** `BlurredValue`: 본문을 DOM에 싣지 않고 막대(최대 3줄, 본문 길이로 어림)와 hint만 둔다. 흐린 텍스트도 결국 텍스트라 노출되기 때문이다. 문제집을 보기 전의 주인공 이름도 같은 막대다.
  - **스크랩북 카드**: 한 장에 6칸씩 넘기고, 장을 넘기면 카드가 계단식으로 다시 놓인다. ±0.6° 번갈아 기울이고(규칙의 의도적 예외), 마스킹 테이프는 `mix-blend-multiply`라 모눈이 비친다. 미조사 칸은 네 귀 사진 홀더만 있다. 다시보기 스틸 파일은 구워 둔 흐린 미리보기(`placeholder="blur"`)로 먼저 선다.
  - **평면도**: SVG 방 rect 위에 `fill-paper` rect를 덮어 문간 구멍을 낸다. 지금 있는 칸은 memory로 물들고, 단서를 본 칸에는 연필 체크가 남는다. 이름표는 viewBox 비율 %로 배치한 DOM 버튼이고, 누르면 그 방으로 워프한 뒤 수첩을 접는다(1인칭 구간에는 막힌다).
- **피드백 모달**: 실패해도 본문을 지우지 않는다. 진행 메타를 자동으로 첨부하고 `/api/feedback`가 구글 폼으로 넘긴다. 503(폼 미연결)·429(너무 자주 보냄)는 실패와 다른 문구를 띄운다. 성공 토스트는 모달과 별개로 띄운다(3.2초).
- **공통**: 모든 모달이 `setUiLock`으로 방 입력을 잠그고 Escape로 닫힌다.

### 관련 코드

**단서 오버레이** — `components/ui/ClueOverlay.tsx` · `ClueOverlay`

```tsx
        {/* 닫기는 종이 밖에 둔다. 종이 위에 UI 버튼이 얹히면 종이가 아니라 창이 된다 */}
        <button
          type="button"
          onClick={closeClue}
          aria-label={t("clue.close")}
          className={`${BUTTON_QUIET} absolute -top-12 right-0 px-3 py-1.5`}
        >
```

**접힌 쪽지** — `components/ui/ClueOverlay.tsx` · `FoldedNote`

```tsx
    <div
      className="relative aspect-[640/400] w-full bg-contain bg-center bg-no-repeat"
      style={{ backgroundImage: `url(${ASSETS.images.clueNotePaper})` }}
    >
      // ...
      <div className="absolute left-[13%] right-[8%] top-[17%] flex flex-col gap-3.5">
        {NOTE_LINES.map((key, index) => (
          <p
            key={key}
            className={`break-ko text-pretty leading-relaxed text-ink ${
              index === 0 ? "text-lg font-medium" : "text-base"
            }`}
          >
            {t(key)}
          </p>
        ))}
      </div>
```

**거울 유리** — `app/globals.css` · `.mirror-glass`

```css
.mirror-glass {
  background:
    linear-gradient(
      160deg,
      color-mix(in srgb, var(--color-ivory) 10%, transparent) 0%,
      transparent 38%
    ),
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--color-fog) 12%, var(--color-night)) 0%,
      var(--color-night) 100%
    );
}
```

**제본 구멍과 모눈과 접힘 그림자** — `app/globals.css` · `.notebook-punch`, `.notebook-grid`, `.notebook-gutter`

```css
.notebook-punch {
  background-image: radial-gradient(
    circle at 50% 16px,
    var(--color-scene-void) 0 5.5px,
    color-mix(in srgb, var(--color-ink) 28%, transparent) 5.5px 7px,
    transparent 7.5px
  );
  background-size: 100% 34px;
  background-repeat: repeat-y;
}
/* ... */
.notebook-grid {
  background-image:
    repeating-linear-gradient(
      to bottom,
      color-mix(in srgb, var(--color-ink) 5%, transparent) 0 1px,
      transparent 1px 24px
    ),
    repeating-linear-gradient(
      to right,
      color-mix(in srgb, var(--color-ink) 5%, transparent) 0 1px,
      transparent 1px 24px
    );
}
/* ... */
.notebook-gutter {
  background: linear-gradient(
    to right,
    color-mix(in srgb, var(--color-ink) 14%, transparent) 0%,
    transparent 100%
  );
}
```

`components/ui/CharacterSheetModal.tsx` · `CharacterSheetModal`

```tsx
        <div
          aria-hidden
          className="notebook-punch w-9 flex-none border-r border-ink/10 bg-bone/40 sm:w-10"
        />
        {/* 접힘 그림자는 페이지 위에 얹는다. 스크롤을 따라 움직이면 접힌 자국이 아니다 */}
        <div
          aria-hidden
          className="notebook-gutter pointer-events-none absolute left-9 top-0 z-20 h-full w-5 sm:left-10"
        />
```

**인덱스 탭** — `components/ui/CharacterSheetModal.tsx` · 탭 줄

```tsx
              <div
                role="tablist"
                aria-label={t("characterSheet.title")}
                className="relative z-10 -mb-px flex flex-none gap-1"
              >
                {tabs.map((id) => (
                  <button
                    // ...
                    className={`cursor-pointer rounded-t-md border px-3 py-1.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-memory ${
                      tab === id
                        ? "border-ink/15 border-b-transparent bg-paper text-ink"
                        : "border-transparent bg-bone/50 text-graphite hover:text-ink active:bg-bone/70"
                    }`}
                  >
                    {t(TAB_LABEL[id])}
                    {/* 아직 안 펼쳐 본 것이 적힌 페이지: 탭 글자 옆 금빛 점 하나 */}
                    {id !== tab && unread.includes(id) && (
```

**잠긴 값** — `components/ui/BlurredValue.tsx` · `BlurredValue`

```tsx
  const lines = Math.min(BAR_WIDTHS.length, Math.max(1, Math.round(text.length / 28)));

  return (
    <span className="relative block">
      <span className="sr-only">{label}</span>
      <span aria-hidden className="flex flex-col gap-2 py-1.5">
        {BAR_WIDTHS.slice(0, lines).map((width) => (
          <span key={width} className="block h-2.5 rounded-sm bg-bone/70" style={{ width }} />
        ))}
      </span>
```

**스크랩북 카드** — `components/ui/LoreEntries.tsx` · `LoreEntries`, `LoreStill`

```tsx
            <li key={id} className={STAGGER_CLASS} style={staggerStyle(index)}>
              // ...
              <article
                className={`relative flex h-full flex-col rounded-sm border border-ink/10 bg-card p-2.5 ${
                  index % 2 === 0 ? "rotate-[-0.6deg]" : "rotate-[0.6deg]"
                }`}
              >
                {/* 종이에 붙인 마스킹 테이프. mix-blend-multiply라 밑의 모눈이 비쳐 보인다 */}
                <span
                  aria-hidden
                  className="-top-2 -translate-x-1/2 -rotate-2 absolute left-1/2 h-4 w-14 rounded-[1px] bg-bone/55 mix-blend-multiply"
                />
// ...
  // 다시보기 스틸 파일만 흐린 판이 있다. 찍어 둔 스틸(data URL)은 이미 손에 있다
  const blur = blurDataUrlOf(still);
  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[2px] bg-bone/40">
      <Image
        src={still}
        alt={t("characterSheet.loreStill", { name })}
        placeholder={blur ? "blur" : "empty"}
        blurDataURL={blur}
```

**평면도** — `components/ui/NotebookMap.tsx` · `NotebookMap`

```tsx
          {plan.doors.map((door) => (
            <rect
              key={door.id}
              x={door.x}
              y={door.y}
              width={door.width}
              height={door.height}
              className="fill-paper"
            />
          ))}
        </svg>
        // ...
              onClick={() => {
                playSound("open");
                const { x, z } = SPACES[room.id].landing;
                warpPlayer(x, z);
                // 옮겨 놓고 수첩을 접는다. 종이가 덮인 채로는 옮겨 간 방이 안 보인다
                setCharacterSheetOpen(false);
              }}
              // ...
              style={{
                left: `${((room.x - viewX) / viewWidth) * 100}%`,
                top: `${((room.y - viewY) / viewHeight) * 100}%`,
                width: `${(room.width / viewWidth) * 100}%`,
                height: `${(room.height / viewHeight) * 100}%`,
              }}
```

**피드백 모달** — `components/ui/FeedbackModal.tsx` · `buildMeta`, `submit`

```tsx
  const parts = [
    `phase${gamePhaseOf(state)}`,
    `collected:${selectCollectedCount(state)}`,
    `revisited:${selectRevisitedCount(state)}`,
    `door:${state.doorOpened ? "open" : "closed"}`,
    `lang:${language}`,
    typeof window === "undefined" ? "" : `viewport:${window.innerWidth}x${window.innerHeight}`,
  ];
// ...
      if (response.ok) {
        // 성공은 모달 안 문구가 아니라 토스트다. 닫힌 뒤에도 "갔다"가 보여야 한다
        setSend("idle");
        setBody("");
        setEmail("");
        setOpen(false);
        setToastVisible(true);
        return;
      }
      // ...
      setSend(
        response.status === 503
          ? "unconfigured"
          : response.status === 429
            ? "rateLimited"
            : "failed",
      );
```

**공통: 입력 잠금과 Escape** — `components/ui/CharacterSheetModal.tsx` · `CharacterSheetModal`

```tsx
  useEffect(() => {
    setUiLock("character-sheet", open);
    return () => setUiLock("character-sheet", false);
  }, [open, setUiLock]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, setOpen]);
```

---

## 17. CSS·DOM: 미니게임 호스트, 결과 연출, 엔딩

- **MinigameHost**
  - 백드롭이 카드보다 먼저 깔린다(`backdrop-in`).
  - 조작법을 읽기 전에 타이머가 돌지 않도록, 시작 버튼을 눌러야 판을 마운트한다. 탐색형(`bare`)과 틀만 있는 판(`framed`)은 시작 카드를 거치지 않는다. 시작 카드의 규칙 목록은 키캡 안내(`KeyHint`)로 선다.
  - 결과 대사 단계와 결과 카드가 떠 있는 동안에는 판을 `inert`로 둔다. 시작 뒤에는 백드롭 클릭으로 닫히지 않는다(닦기 제스처 오작동 방지). 승부가 난 뒤에는 닫기·Esc도 막는다.
  - canvas 모드 판(씬 안에서 도는 판)에는 백드롭 없이 조작 안내 한 줄과 "돌아가기"만 얹는다.
- **결과 카드**: 성공은 memory 테두리, 실패는 ember 테두리. 버튼은 **600ms 뒤에** 나타나고 포커스가 따라간다(판을 두드리던 손가락의 오클릭 방지). 성공은 2.6초 뒤 자동으로 넘어가고, 실패는 "나중에 하기 · 다시 해보기"를 고를 때까지 기다린다.
- **퍼즐 결과 카드** (`PuzzleHost.tsx`): 미궁 문제(피아노·하부장 다이얼)가 풀리면 같은 옷의 카드가 선다. **저절로 넘어가지 않는다**. 대사도 수첩 기록도 안 딸려서 스르르 사라지면 풀린 건지 닫힌 건지 헷갈리기 때문이다. "계속"을 눌러야 보상이 나간다.
- **ExitFade**: React 언마운트 순간 `useLayoutEffect` cleanup에서 **DOM을 `cloneNode`해 유령으로 세우고** 200ms 페이드한다. 진짜 상태는 즉시 떼므로 끝난 판이 결과를 다시 보고할 위험이 없다. 유령은 `inert`·`aria-hidden`이고, 모션을 끄면 만들지 않는다.
- **SuccessBurst**: 폭죽이 아니라 **떠오르는 금빛 입자** 84개(Canvas 2D, 2.3초). 판이 스스로 축하를 그린 경우(`result.celebrated`)에는 띄우지 않는다.
  - 글로우 스프라이트를 색마다 미리 굽고 `drawImage`한다(shadowBlur보다 싸다).
  - 그라데이션 끝을 `transparent`가 아니라 **같은 색 알파 0**으로 둔다(검정을 거쳐 거뭇한 테가 생기는 것 방지).
  - `lighter` 가산 혼합.
- **엔딩** (`EndingScreen.tsx`)
  - door(1.8s): 투명하게 두어 3D 문 열림, GodRays, burn 셰이더를 보여 준다.
  - film: 엔딩 영상. 자동재생이 막히면(`NotAllowedError`) 재생 버튼을 띄운다. 영상·카드가 덮는 동안은 `setSceneCovered`로 3D를 그리지 않아 디코딩과 GPU를 다투지 않는다.
  - card: 감사 그림(흐린 미리보기 placeholder), 다시보기, 이미지 저장, 처음으로. 카드가 서는 순간 축하음이 울린다.
- **EndingConfetti**: 여기서만 **진짜 색종이**를 쓴다. 160조각, 중력과 종단속도, `scale(1, cos(flip))`로 뒤집히며 납작해지는 종이를 표현한다. 모두 화면을 벗어나면 rAF를 멈춘다. 모션을 끄면 그리지 않는다.

### 관련 코드

**백드롭 먼저** — `app/globals.css` · `--animate-backdrop-in`

```css
  /* 미니게임 층의 백드롭. 카드(fade-rise)보다 먼저 깔린다 */
  --animate-backdrop-in: backdrop-in 0.2s ease-out both;
```

**시작 버튼으로 마운트** — `components/ui/MinigameHost.tsx` · `MinigameHost`

```tsx
  const direct = bare || framed;
  // ...
  // bare·framed는 "시작"을 거치지 않는다. 물건을 집었으면 이미 들여다보는 중이다.
  const started = direct || (startedKey !== null && startedKey === activeKey);
// ...
              <button
                ref={startButtonRef}
                type="button"
                onClick={() => {
                  playSound("select");
                  setStartedKey(activeKey);
                }}
                className={`${BUTTON_PRIMARY} mt-7 px-8 py-3 text-base`}
              >
                {t("minigame.start")}
              </button>
```

**inert와 백드롭 잠금** — `components/ui/MinigameHost.tsx` · 판 층

```tsx
        <ExitFade
          // ...
          inert={resultStage || shownOutcome !== null}
          className={`absolute inset-0 z-40 grid animate-backdrop-in place-items-center ${
            // 탐색형은 방을 덜 가린다. 물건을 든 채로도 방이 보여야 "그 방 안"이다.
            // 뒤쪽 방이 완전히 사라질 만큼 뭉개지 않는다 (3px)
            direct ? "bg-scene-void/55 backdrop-blur-[2px]" : "backdrop-blur-[3px]"
          } ${resultStage ? "bg-scene-void/75 pb-56" : direct ? "" : "bg-scene-void/40"}`}
          onPointerDown={(event) => {
            if (event.target !== event.currentTarget || sealed || started) return;
            cancelMinigame();
          }}
        >
```

**결과 카드** — `components/ui/MinigameHost.tsx` · `MinigameResultCard`

```tsx
const RESULT_HOLD_MS = 600;
/** 성공 카드가 저절로 넘어가는 시각(ms). 읽을 시간은 주되 붙잡아 두지는 않는다. */
const RESULT_AUTO_MS = 2600;
// ...
  useEffect(() => {
    if (!cleared) return;
    const auto = window.setTimeout(() => onContinueRef.current(), RESULT_AUTO_MS);
    return () => window.clearTimeout(auto);
  }, [cleared]);
// ...
      <div
        className={`w-[22rem] max-w-[92vw] animate-fade-rise p-6 text-center ${PANEL_FRAME} ${
          cleared ? "border-memory/50" : "border-ember/50"
        }`}
      >
        // ...
        <div
          className={`mt-5 flex justify-center gap-2 transition-opacity duration-300 ${
            settled ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
```

**퍼즐 결과 카드** — `components/ui/PuzzleHost.tsx` · `PuzzleResultCard`, `onComplete`

```tsx
function PuzzleResultCard({ line, onContinue }: { line: string; onContinue: () => void }) {
  const { t } = useTranslation();
  const [settled, setSettled] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const hold = window.setTimeout(() => setSettled(true), RESULT_HOLD_MS);
    return () => window.clearTimeout(hold);
  }, []);
// ...
                onComplete={(result) => {
                  playSound(result.cleared ? "success" : "fail");
                  // 풀렸으면 곧장 닫지 않고 결과 카드를 세운다 (입자는 위의 effect가)
                  if (result.cleared) settlePuzzle();
                  else finishPuzzle(result);
                }}
```

**ExitFade** — `components/ui/ExitFade.tsx` · `ExitFade`

```tsx
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    return () => {
      const parent = node.parentNode;
      if (!parent || prefersReducedMotion()) return;
      const ghost = node.cloneNode(true) as HTMLElement;
      ghost.inert = true;
      ghost.setAttribute("aria-hidden", "true");
      ghost.classList.add("exit-ghost");
      parent.insertBefore(ghost, node.nextSibling);
      const done = () => ghost.remove();
      ghost.addEventListener("animationend", done, { once: true });
      // 애니메이션이 못 돌아도(탭이 숨어 있음) 유령이 남지 않게 한다
      window.setTimeout(done, EXIT_MS + 100);
    };
  }, []);
```

`app/globals.css` · `.exit-ghost`

```css
.exit-ghost,
.exit-ghost * {
  pointer-events: none;
}

.exit-ghost {
  animation: overlay-exit 200ms ease-in both;
}
```

**SuccessBurst: 글로우 스프라이트** — `components/ui/SuccessBurst.tsx` · `withAlpha`, `createGlowSprite`

```tsx
function withAlpha(color: string, alpha: number): string {
  const hex = color.trim().replace("#", "");
  if (!/^(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) return color;
  const full = hex.length === 3 ? hex.replace(/./g, (digit) => digit + digit) : hex;
  const value = Number.parseInt(full, 16);
  return `rgb(${(value >> 16) & 255} ${(value >> 8) & 255} ${value & 255} / ${alpha})`;
}
// ...
    const gradient = context.createRadialGradient(half, half, 0, half, half, half);
    gradient.addColorStop(0, withAlpha(color, 1));
    gradient.addColorStop(0.16, withAlpha(color, 0.6));
    gradient.addColorStop(0.42, withAlpha(color, 0.18));
    gradient.addColorStop(1, withAlpha(color, 0));
```

**SuccessBurst: 떠오름과 가산 혼합** — `components/ui/SuccessBurst.tsx` · `loop`

```tsx
      context.globalCompositeOperation = "lighter";

      for (const p of particles) {
        const age = t - p.birth;
        if (age <= 0) continue;

        // 위로 오르면서 sin으로 좌우로 흔들린다. 시간의 함수라 매 프레임 적분하지
        // 않으므로, 탭이 멈췄다 돌아와도 위치가 튀지 않는다.
        const x = originX + p.offsetX + Math.sin(age * p.swayFrequency + p.phase) * p.swayAmplitude;
        const y = originY + p.offsetY - p.rise * age;
        // ...
        const alpha = clamp01(age / 0.42) * clamp01((1 - progress) / p.fadeSpan) * p.glow;
        if (alpha <= 0.004) continue;

        // 떠오르며 아주 조금 부푼다. 초점에서 멀어지는 인상
        const drawn = p.size * (1 + age * 0.12);
        context.globalAlpha = alpha;
        const sprite = glowSprites.get(p.color);
        if (sprite) context.drawImage(sprite, x - drawn / 2, y - drawn / 2, drawn, drawn);
      }
```

**SuccessBurst를 띄우는 자리** — `components/ui/MinigameHost.tsx` · `onComplete`

```tsx
                    if (result.cleared && !result.celebrated) setBurstId((id) => id + 1);
```

**엔딩 단계** — `components/ui/EndingScreen.tsx` · `EndingScreen`

```tsx
const DOOR_BEAT_MS = 1800;
// ...
  useEffect(() => {
    setSceneCovered(endingStarted && stage !== "door");
    return () => setSceneCovered(false);
  }, [endingStarted, stage, setSceneCovered]);
// ...
  const play = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setBlocked(false);
    video.play().catch((error: unknown) => {
      // 자동재생 정책에 막혔다: 눌러서 틀게 한다. 그 밖의 실패는 onError가 카드로 보낸다
      if (error instanceof DOMException && error.name === "NotAllowedError") setBlocked(true);
    });
  }, []);
// ...
    <div
      className={`absolute inset-0 z-50 transition-colors duration-1000 ${
        stage === "door" ? "pointer-events-none bg-transparent" : "bg-scene-void"
      }`}
    >
```

**EndingConfetti** — `components/ui/EndingConfetti.tsx` · `tick`

```tsx
        piece.vy += GRAVITY * delta;
        piece.vy += (TERMINAL_VY - piece.vy) * Math.min(1, delta * 1.5);
        piece.vx *= 1 - Math.min(1, delta * 0.8);
        piece.x += (piece.vx + Math.sin(piece.flip) * piece.sway) * delta;
        piece.y += piece.vy * delta;
        piece.angle += piece.spin * delta;
        piece.flip += piece.flipSpeed * delta;

        context.save();
        context.translate(piece.x, piece.y);
        context.rotate(piece.angle);
        context.scale(1, Math.cos(piece.flip));
        context.fillStyle = piece.color;
        context.fillRect(-piece.width / 2, -piece.height / 2, piece.width, piece.height);
        context.restore();
      }
      if (alive > 0) frame = requestAnimationFrame(tick);
```

---

## 18. CSS·DOM: 커스텀 커서

`CustomCursor.tsx`, `cursor-ring.ts`

- 마우스 기기의 첫 `pointermove`에서 켜진다. 터치이거나 reduced motion이면 네이티브 커서를 쓴다. 손가락이 끼어들면 점을 치운다.
- **점**: 6px ivory 원. `mix-blend-mode: difference`는 점이 아니라 **점과 링을 감싼 층**(`fixed inset-0 z-[100000]`)에 건다. z-index를 가진 층은 쌓임 맥락이라 안쪽 요소의 블렌드는 층 밖에 닿지 않고, 그래서 상아색 점이 수첩 종이 위에서 사라졌다. 이제 밝은 종이 위에서는 어둡게, 방에서는 밝게 보인다.
- **링**: damp(λ32)로 늦게 따라와 손의 속도를 그린다.
  - DOM 버튼 위에서는 0.7로 조이고 memory 색이 된다. 화면 전체를 덮는 대사 넘기기 버튼은 제외한다.
  - **3D 물체 위에서는 물체의 화면 좌표로 빨려들며(λ26) 사라지고**, 그 순간 3D 윤곽이 밝아진다(MemoryOutlineGlow).
- **누르기와 클릭**: 누르면 `::after`가 0.85로 한 번 더 조인다. 클릭 파문은 클래스를 떼고 `offsetWidth`로 리플로우를 강제한 뒤 다시 붙여 연타에도 매번 돈다. 파문은 금빛 그대로 보여야 해서 블렌드 층 밖, 따로 된 층에 둔다.
- 첫 프레임의 delta는 0으로, 긴 공백은 0.1초로 자른다. 음수 delta가 감쇠식을 발산시켜 점이 화면 밖으로 날아간 적이 있다.
- `html.custom-cursor { cursor:none }`을 레이어 밖 규칙으로 둬 Tailwind `cursor-pointer`를 이긴다.

### 관련 코드

**켜는 조건** — `components/ui/CustomCursor.tsx` · `CustomCursor`

```tsx
  useEffect(() => {
    if (pointerKind !== "keys") {
      setActive(false);
      return;
    }
    if (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const onMove = (event: PointerEvent) => {
      if (event.pointerType === "mouse") setActive(true);
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [pointerKind]);
```

**점과 링의 층** — `components/ui/CustomCursor.tsx` · 반환 JSX

```tsx
  return (
    <>
      <div aria-hidden className="pointer-events-none fixed inset-0 z-[100000]">
        <span ref={rippleRef} className="cursor-ripple" />
      </div>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[100000] mix-blend-difference"
      >
        <span ref={dotRef} className="cursor-dot" />
        <span ref={ringRef} className="cursor-ring" />
      </div>
    </>
  );
```

`app/globals.css` · `.cursor-dot`, `.cursor-ring`

```css
.cursor-dot {
  width: 6px;
  height: 6px;
  margin: -3px;
  background: var(--color-ivory);
}

.cursor-ring {
  width: 28px;
  height: 28px;
  transform-origin: center;
  border: 1px solid color-mix(in srgb, var(--color-ivory) 45%, transparent);
  transition:
    opacity 150ms ease-out,
    border-color 150ms ease-out;
}

.cursor-ring[data-hot="true"] {
  border-color: var(--color-memory);
}
```

**링의 목표와 감쇠** — `components/ui/cursor-ring.ts` · `ringGoal`, `damp`

```ts
export const RING_SIZE = 28;
/** 만질 수 있는 DOM 위에서 링이 조여드는 비율 */
export const RING_HOT_SCALE = 0.7;
// ...
export function ringGoal(pointer: Point, hot: boolean, absorb: Point | null): RingGoal {
  if (absorb) return { x: absorb.x, y: absorb.y, scale: 0 };
  return { x: pointer.x, y: pointer.y, scale: hot ? RING_HOT_SCALE : 1 };
}

/** 지수 감쇠. three의 MathUtils.damp와 같은 식이되 UI 쪽에서 three를 물어 오지 않는다. */
export function damp(from: number, to: number, lambda: number, deltaSeconds: number): number {
  return from + (to - from) * (1 - Math.exp(-lambda * deltaSeconds));
}
```

**프레임 루프** — `components/ui/CustomCursor.tsx` · `tick`

```tsx
      const delta = last === null ? 0 : Math.min(0.1, Math.max(0, (now - last) / 1000));
      last = now;
      // ...
      if (touchable && !touchable.isConnected) touchable = null;
      const hot = touchable !== null;
      const absorb = cursorTarget.object ? cursorTarget.screen : null;
      const goal = ringGoal(pointer, hot, absorb);
      // 자리는 손을 늦게 따라오고, 조여들거나 빨려드는 건 그보다 조금 빠르다
      const lambda = absorb ? MORPH_LAMBDA : RING_LAMBDA;
      ring.x = damp(ring.x, goal.x, lambda, delta);
      ring.y = damp(ring.y, goal.y, lambda, delta);
      ring.scale = damp(ring.scale, goal.scale, MORPH_LAMBDA, delta);

      dotEl.style.transform = `translate3d(${pointer.x}px, ${pointer.y}px, 0)`;
      ringEl.style.transform = `translate3d(${ring.x - RING_SIZE / 2}px, ${ring.y - RING_SIZE / 2}px, 0) scale(${ring.scale})`;
      dotEl.dataset.shown = ringEl.dataset.shown = String(pointer.shown);
      ringEl.dataset.hot = String(hot || absorb !== null);
      ringEl.dataset.down = String(pointer.down);
```

**누르기와 클릭 파문** — `components/ui/CustomCursor.tsx` · `onDown`, `app/globals.css` · `.cursor-ring::after`

```tsx
    const onDown = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      pointer.down = true;
      // 누른 자리에서 파문 하나. 클래스를 뗐다 붙여야 연타에도 매번 다시 돈다
      const ripple = rippleRef.current;
      if (!ripple) return;
      ripple.style.setProperty("--ripple-x", `${event.clientX}px`);
      ripple.style.setProperty("--ripple-y", `${event.clientY}px`);
      ripple.classList.remove("is-live");
      void ripple.offsetWidth;
      ripple.classList.add("is-live");
    };
```

```css
.cursor-ring::after {
  content: "";
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  border: 1px solid transparent;
  transform: scale(1);
  transition: transform 180ms cubic-bezier(0.2, 0.7, 0.2, 1);
}

.cursor-ring[data-down="true"]::after {
  transform: scale(0.85);
  border-color: inherit;
}
/* ... */
.cursor-ripple.is-live {
  animation: cursor-ripple 0.42s cubic-bezier(0.2, 0.7, 0.2, 1) both;
}
```

**네이티브 커서 숨기기** — `app/globals.css` · `.custom-cursor`

```css
.custom-cursor,
.custom-cursor * {
  cursor: none;
}
```

---

## 19. 미니게임 19종

공통 구조
- 계약은 `types/minigame.ts`, 레지스트리는 `minigames/index.ts`(전부 `React.lazy`). 등록된 id는 19개다.
- 모드는 canvas 2개(piano-melody, ampoule-pickup)와 overlay 17개다. frequency-tune은 radio-quiz가 첫 단계로 품어 쓰고, sink-dial은 overlay 판 안에 작은 r3f 드럼을 띄운다.
- 기억 조사에 붙은 판은 `MinigameHost`가, 미궁 문제(piano-melody, sink-dial)는 `PuzzleHost`가 세운다. 둘 다 판이 풀리면 결과 카드를 띄운다.
- `useSkipEligible`이 스킵이 열리는 시각을 한 곳에서 맡는다. **스킵은 두 난이도 모두에서 열린다.** 기본 난이도 "보통"(`normal`)이 예전의 이지이고, 새 "이지"(`guided`)는 거기에 HUD 목표 줄의 다음 할 일 안내만 더한다. 호스트는 판에 `difficulty`를 내려주지 않으므로 판 수치(대역 폭, 바늘 속도, 목표 안타 수)는 늘 예전 이지 값으로 돈다.
- 도움말의 키 이름은 `<kbd>` 키캡으로 분리해 보여 준다.

| id | 연결 위치 | 플레이 | 핵심 기법과 연출 |
|---|---|---|---|
| **fighter-duel** | 게임기 1차 | 1:1 실시간 격투. 잡기 > 가드 > 공격 > 잡기의 삼각 상성이 버튼이 아니라 **상황**으로 걸린다. 방향키/WASD로 걷고(뒤로 걷기가 곧 가드), ↑/W/Space로 점프, **Z X C**로 약공격·강공격·잡기(J K L, 1 2 3도 받는다) | rAF 시간을 16ms로 잘라 도는 **고정 스텝 시뮬레이션**(따라잡기 최대 250ms). `advance()`와 `stepRival()`은 순수 함수. 기술마다 발동·유효·경직 **프레임 데이터**, 히트스톱, 카운터, 콤보, 밀림, 점프. **상대 AI**는 예고(telegraph)·가드 유지(360ms)·기상 가드·대공·헛친 틈 응징을 하고, 같은 버릇이 3번 쌓이면 **읽고 대응**한다(가드만 하면 잡고, 잡으러만 오면 약공격으로 끊는다). 체력 35% 이하에서 분노. 난수는 주입식이라 테스트할 수 있다. 판이 도는 동안만 8비트 전용 곡이 방 곡을 비운다. 7프레임 스프라이트 시트, 피격 플래시(`brightness(3.4)`), COUNTER/BROKEN 외침, FIGHT!/K.O. 배너, 스캔라인. 터치용 조작판은 이동 줄과 공격 줄 두 줄 |
| **ball-catch** | 공 1차 | 날아와 커지는 공이 링에 겹치는 순간 Space로 스윙. 3번 맞히면 클리어 | rAF에서 ref로 DOM style을 직접 바꾼다. 크기는 `0.25+1.05·t^1.6` ease-in 원근. 첫 공은 튜토리얼 투구("지금!" 표식). 출발 위치는 직전과 반대쪽, 구종은 직전과 다르게 뽑는다. 안타마다 빨라진다. 필드 흔들림, 임팩트, 배트 샘플 소리(파일이 없으면 합성). 3회 헛치거나 30초가 지나면 스킵 |
| **photo-wipe** | 액자 1차 | 먼지 낀 가족사진을 25초 안에 문질러 **50%** 이상 닦는다 | Canvas 2D에 **blur 사진 + 토큰 색**으로 먼지 층을 만들고, `destination-out` 원으로 지운다. 진행도는 픽셀을 읽지 않고 **16px 셀 격자**로 센다. 행주 SVG 커서. 5% 구간마다 닦는 소리. 성공하면 사진을 크게 띄우고 금빛 입자. 10초 뒤 스킵. 결과 대사 동안 타이틀 곡이 든다 |
| **photo-puzzle** | 액자 2차 | 3×3 **두 조각 맞바꾸기** 퍼즐. 조각을 눌러 들고 다른 조각을 눌러 자리를 바꾼다 | 통째로 섞되 정답이나 제자리 조각이 3개 이상인 배치는 다시 뽑는다(맞바꾸기는 어떤 배치든 풀린다). 제자리에 들어간 조각은 틈이 사라지며 사진에 붙고 더 집히지 않아 많아야 8수면 끝난다. 조각은 `background-size:300%`로 자르고, 틈은 gap 대신 inset shadow로 낸다. 방향키로 칸을 옮기고 Enter/Space로 집고 놓는다 |
| **calendar-flip** | 달력 | 7~11월을 ← →로 넘겨 읽는다. 전국대회 날(비밀번호 출처)에 금빛 링, 메모가 있는 날에 연필 점, 사건 뒤 장은 날짜 대신 正자 탈리 | 장이 바뀔 때 **떠나는 장이 새 장 위에서 옅어지는 크로스페이드**(320ms). 예전의 3D 넘김은 걷어 냈다. 떠나는 장은 올라가는 번호를 key로 매번 새로 마운트한다. 장 그림이 있으면 그림이, 없으면 코드가 그린 격자가 선다. 다섯 장을 열 때 미리 받는다 |
| **phone-chat** | 폰 1차 | 스마트폰 목업의 채팅 탭(친구 단톡방, 가족방)과 통화 기록 탭을 모두 본다. 단톡은 Space/↓/Enter로 한 줄씩 내려간다 | 한 줄씩 `fade-rise`로 연다. 줄마다 알림음. 스크롤이 바닥을 따라간다. `role="log"`. 다음 볼 것이 다른 방에 있으면 뒤로가기가 부른다 |
| **mom-chat** | 폰 2차 | 엄마 방을 열면 그날 아침 07:12의 마지막 문자가 나온다. 실패 없음 | PhoneShell 재사용. Enter/Space로 열고 닫는다. 결과 대사 동안 타이틀 곡이 든다 |
| **computer-browse** | 컴퓨터 2차 | 부팅 로그 → 4자리 비밀번호 → 메일과 뉴스 | 숫자 슬롯 위에 **투명한 진짜 `<input>`**을 겹쳐 키보드·스크린리더·포커스를 모두 지원한다(`AnswerSlots`). 화면 숫자 키패드가 나란히 있고, 네 자리가 차면 바로 검사한다. 오답은 `page-nudge`로 흔들린 뒤 지워진다 |
| **computer-logo** | 컴퓨터 3차 | 반쯤 지워진 앰플 라벨 로고와 같은 로고를 후보 넷 중에서 **둘 다** 고른다(메일 첨부의 출입증 사진, 캐시 뉴스의 연구시설 정문). 다 맞추면 아빠 메일이 열린다 | SVG `clipPath`로 반만 보여 준다. 로고는 `currentColor` 선화. 맞춘 칸은 금빛으로 남는다. 3회 틀리거나 45초가 지나면 스킵 |
| **window-view** | 창 | 돋보기로 창밖에서 세 자리를 찾는다 | 렌즈는 같은 이미지를 `background-size:240%`로 깐 원형 요소다. 바깥은 `.window-night` 그라디언트로 밤 톤을 입히고 렌즈 안은 원화 그대로. 방향키로 렌즈를 옮기고 Enter/Space로 들여다본다. 20초가 지나면 다 못 찾아도 닫을 수 있다 |
| **radio-quiz** (+frequency-tune) | 라디오 1차 | 흔들리는 바늘을 금색 대역에서 멈춘 뒤, 글자 풀로 답을 채운다 | 바늘은 **위상을 누적**해 주기가 바뀌어도 순간이동하지 않는다. **목표와의 거리에 비례한 잡음 게인**(노이즈 베드)으로 귀로도 조준할 수 있고, 같은 값이 TUNING 램프 밝기로도 간다. 라디오 PNG의 알파로 뚫린 창 아래에 눈금을 겹치고 `cqw`로 크기를 잡는다. 3회 틀릴 때마다 앞에서부터 힌트 글자를 한 자씩 공개한다 |
| **card-flip / id-card-flip / ampoule-case** | 쪽지, 출입증, 앰플 | 3D 물건을 돌려 숨은 면을 찾는다 | 인스펙트 턴테이블(11장). `cos(yaw-found)>0.8`이 0.35초 유지되면 발견. 출입증은 면 대신 각도를 찾는 홀로그램이다. 끝나는 순간을 JPEG 정지 그림으로 찍어 결과 대사와 수첩에 쓴다 |
| **papers-order** | 안방 서류 | 날짜 조각 4장을 순서대로 놓는다 | 집기·교환 방식이고 키보드로 들고(Space/Enter) ↑↓로 옮길 수 있다. 종이 조각은 ±0.5~0.6° 기울인다 |
| **sink-dial** | 세면대 하부장 (미궁) | 3자리 드럼을 **407**에 맞춘다. 번호는 선반의 거꾸로 꽂힌 책 속 쪽지에 있다 | 컴퓨터 3차에서 아빠 메일 힌트를 본 뒤에만 열린다. r3f 드럼. 드래그 도중 덜 넘어간 비율을 넘겨 드럼이 손을 따라 기운다. ←→로 칸, ↑↓로 숫자, Enter로 연다. 4회 틀리거나 60초가 지나면 스킵. 풀면 결과 카드 뒤 안방 열쇠가 손에 들어온다 |
| **piano-melody** | 거실 피아노 (미궁) | 씬 안 피아노로 6음(솔미미 파레레)을 친다. 번진 둘째 마디는 안방 책상의 악보 조각(`piano-sheet`)을 들고 와야 보이고, **조각 없이는 건반이 울리지 않는다** | 카메라 교체, 뚜껑과 건반 damp, 계이름 CanvasTexture, `playTone` 평균율(사인파 배음 합성). 조각이 없으면 호스트가 "악보가 필요하다"를 띄운다(`needsItem`). 틀리면 처음으로 되감길 뿐 실패는 없다 |
| **ampoule-pickup** | (현재 미연결) | 서랍에서 앰플을 집어 든다 | easeOutCubic 서랍, 1.8배 들기(직교 카메라라 배율로 "눈앞"을 연출), 굴절 유리는 heavy 효과 예산에서만 |

### 관련 코드

**스킵 게이트** — `minigames/shell.tsx` · `useSkipEligible`
```tsx
/**
 * ms 경과 후 true: 스킵 UI 노출 타이밍 (시간 경과 또는 N회 실패).
 *
 * 이지·보통 모두 스킵이 열린다 (2026-09-28: 스킵을 숨기던 예전 "보통"을 없앴다.
 * 스토어의 Difficulty). 스킵 타이밍을 한곳에 두는 이유는 그대로다: 아홉 게임이
 * 이 훅을 쓰므로, 흩어지면 하나쯤은 반드시 빠뜨린다.
 */
export function useSkipEligible(ms: number): boolean {
  const [eligible, setEligible] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setEligible(true), ms);
    return () => clearTimeout(timer);
  }, [ms]);
  return eligible;
}
```

**레지스트리와 필요한 물건** — `minigames/index.ts` · `MINIGAMES["piano-melody"]`
```ts
  "piano-melody": {
    id: "piano-melody",
    // 씬의 피아노 그 자리에서 돈다: 뚜껑이 젖혀지고 카메라가 건반 앞에 붙박이로 선다.
    // 판을 세우는 것은 씬 쪽 호스트(src/scenes/memory-room/CanvasMinigameHost.tsx)다
    mode: "canvas",
    presentation: "bare",
    component: lazy(() =>
      import("./piano-melody").then((m) => ({ default: m.PianoMelodyMinigame })),
    ),
    titleKey: "minigame.pianoMelody.title",
    helpKey: "minigame.pianoMelody.help",
    solvedKey: "minigame.pianoMelody.solved",
    // 지워진 마디는 안방 책상의 악보 조각을 들고 와야 보이고, 그 전에는 칠 수 없다
    needsItem: { id: "piano-sheet", hintKey: "minigame.pianoMelody.missing" },
```

**fighter-duel 고정 스텝 루프** — `minigames/fighter-duel/index.tsx` · `useEffect(rAF)`
```tsx
    let spare = 0;
    let frame = requestAnimationFrame(function tick(now) {
      // ...
      spare = Math.min(spare + (now - lastFrameRef.current), MAX_CATCHUP_MS);
      lastFrameRef.current = now;

      let ended: "won" | "lost" | null = null;
      let first = true;
      while (spare >= FIXED_STEP_MS && ended === null) {
        spare -= FIXED_STEP_MS;
        // 기술은 눌린 순간 한 번뿐이라 첫 걸음에서만 읽는다. 나머지 걸음은 걷기만 잇는다
        const intent = first ? readIntent() : { ...readIntent(), attack: null, jump: false };
        first = false;
        const rival = stepRival(
          stateRef.current,
          mindRef.current,
          FIXED_STEP_MS,
          Math.random(),
          tuning,
        );
        mindRef.current = rival.mind;
        const step = advance(stateRef.current, intent, rival.intent, FIXED_STEP_MS, tuning);
        stateRef.current = step.state;
        showEvents(step.events, now);
        const status = duelStatus(step.state);
        if (status !== "playing") ended = status;
      }

      setView(stateRef.current);
      setTelegraph(mindRef.current.telegraph);
```

**fighter-duel 키 배치** — `minigames/fighter-duel/index.tsx` · `ATTACK_KEYS`
```tsx
/**
 * 기술은 눌린 순간 한 번만 먹는다. 붙잡고 있어도 연타가 되지 않는다.
 * 안내는 Z X C다: 방향키가 오른손이니 공격은 왼손에 둔다. J K L은 방향키와 같은 손이라
 * 두 손이 겹쳤다. WASD로 걷는 사람을 위해 J K L도 그대로 받는다.
 */
const ATTACK_KEYS: Record<string, Attack> = {
  KeyJ: "jab",
  KeyZ: "jab",
  Digit1: "jab",
  KeyK: "heavy",
  KeyX: "heavy",
  Digit2: "heavy",
  KeyL: "throw",
  KeyC: "throw",
  Digit3: "throw",
};
```

**fighter-duel 상대 AI의 버릇 읽기** — `minigames/fighter-duel/duel.ts` · `chooseRivalAttack` / `stepRival`
```ts
export function chooseRivalAttack(mind: RivalMind, distance: number, roll: number): Attack {
  if (mind.guardSeen >= HABIT_THRESHOLD && distance <= ATTACKS.throw.reach) return "throw";
  if (mind.throwSeen >= HABIT_THRESHOLD) return "jab";
  if (distance <= ATTACKS.throw.reach && roll < 0.28) return "throw";
  if (roll < 0.62) return "jab";
  return "heavy";
}
// ...
  // 플레이어가 무엇을 하는지 세어 둔다. 같은 짓을 세 번 하면 그때부터 읽힌다
  if (state.hero.attack === "throw" && state.hero.phase === "startup") {
    next.throwSeen = Math.min(HABIT_THRESHOLD, next.throwSeen + 1);
  }
  if (state.hero.guarding) next.guardSeen = Math.min(HABIT_THRESHOLD * 60, next.guardSeen + 1);
// ...
  next.telegraph = chooseRivalAttack(next, distance, roll);
  next.telegraphMs = rivalTellMs(tuning, state.rival.hp);
  if (next.telegraph === "throw") next.throwSeen = 0;
  return { mind: next, intent: NO_INTENT };
```

**ball-catch 원근 비행** — `minigames/ball-catch/index.tsx` · `useEffect(rAF)`의 `loop`
```tsx
        } else {
          const x = round.startX + (50 - round.startX) * clamped;
          const y = 35 + 33 * clamped;
          // 크기는 ease-in: 멀리서 날아오다 가까워질수록 훅 커지는 원근감
          const scale = 0.25 + 1.05 * clamped ** 1.6;
          if (reduceMotion) {
            ball.style.opacity = `${0.55 + 0.45 * clamped}`;
            ball.style.left = `${x}%`;
            ball.style.top = `${56 + 12 * clamped}%`;
            ball.style.transform = `translate(-50%, -50%) scale(${0.85 + 0.45 * clamped}) rotate(0deg)`;
          } else {
            ball.style.opacity = "1";
            ball.style.left = `${x}%`;
            ball.style.top = `${y}%`;
            ball.style.transform = `translate(-50%, -50%) scale(${scale}) rotate(${clamped * SPIN_DEG}deg)`;
          }
        }
```

**photo-wipe destination-out 지우기와 격자 진행도** — `minigames/photo-wipe/index.tsx` · `wipeAtRef`, `photo-wipe/wipe-grid.ts` · `wipeCircle`
```tsx
/** 2026-09-26에 70%·40초·15초에서 줄였다: 절반만 닦아도 얼굴 자리가 드러난다. */
const CLEAR_RATIO = 0.5;
const TIME_LIMIT_S = 25;
const SKIP_AFTER_MS = 10_000;
// ...
  wipeAtRef.current = (x: number, y: number) => {
    const context = canvasRef.current?.getContext("2d");
    if (!context || !ready || revealed) return;
    context.globalCompositeOperation = "destination-out";
    context.beginPath();
    context.arc(x, y, WIPE_RADIUS, 0, Math.PI * 2);
    context.fill();
    context.globalCompositeOperation = "source-over";

    const wiped = wipeCircle(gridRef.current, photo, x, y, WIPE_RADIUS);
```
```ts
export function wipeCircle(
  grid: WipeGrid,
  area: WipeArea,
  x: number,
  y: number,
  radius: number,
): number {
  const cellW = area.width / grid.cols;
  const cellH = area.height / grid.rows;
  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      const index = row * grid.cols + col;
      if (grid.cells[index]) continue;
      const cx = (col + 0.5) * cellW;
      const cy = (row + 0.5) * cellH;
      if ((cx - x) ** 2 + (cy - y) ** 2 <= radius ** 2) grid.cells[index] = true;
    }
  }
  return grid.cells.filter(Boolean).length / grid.cells.length;
}
```

**photo-puzzle 맞바꾸기 판 섞기** — `minigames/photo-puzzle/puzzle.ts` · `shuffledBoard`
```ts
export function shuffledBoard(random: () => number): Board {
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const board = [...solvedBoard()];
    for (let index = board.length - 1; index > 0; index -= 1) {
      const pick = Math.min(index, Math.floor(random() * (index + 1)));
      [board[index], board[pick]] = [board[pick], board[index]];
    }
    const placed = board.filter((tile, index) => tile === index).length;
    if (placed <= MAX_PLACED_AT_START) return board;
  }
  // 여기까지 오면 무작위원이 상수를 뱉고 있다는 뜻: 한 칸씩 돌려 모두 어긋나게 한다
  return solvedBoard().map((_, index) => (index + 1) % TILE_COUNT);
}
```

**photo-puzzle 집고 맞바꾸기** — `minigames/photo-puzzle/index.tsx` · `pickRef`
```tsx
  pickRef.current = (index: number) => {
    if (solved || isPlaced(board, index)) return;
    if (held === null) {
      setHeld(index);
      playSound("select", { variation: 0.05 });
      return;
    }
    if (held === index) {
      setHeld(null);
      return;
    }
    const next = swap(board, held, index);
    setBoard(next);
    setHeld(null);
    setMoves((count) => count + 1);
```

**calendar-flip 떠나는 장 크로스페이드** — `minigames/calendar-flip/index.tsx` · `turn` + 판 JSX
```tsx
  const turn = useCallback(
    (direction: FlipDirection) => {
      const next = flipMonth(month, direction);
      if (next === month) return;

      playSound("flip", { variation: 0.05 });
      leaveSeq.current += 1;
      setLeaving({ month, key: leaveSeq.current });
      setMonth(next);
    },
    [month],
  );
// ...
        <div className="relative" style={{ width: SHEET_WIDTH }}>
          <CalendarSheet month={month} />
          {leaving && (
            <div
              key={`leaving-${leaving.key}`}
              aria-hidden
              className="animate-calendar-fade pointer-events-none absolute inset-0"
            >
              <CalendarSheet month={leaving.month} />
            </div>
          )}
        </div>
```

**phone-chat 한 줄씩 읽기와 바닥 따라가기** — `minigames/phone-chat/index.tsx` · `readNext`
```tsx
  /** 아래로 한 줄 더 읽어 내려간다. */
  const readNext = useCallback(() => {
    setRevealed((current) => {
      const next = revealNext(current);
      // 한 줄 내려갈 때마다 그때 울렸을 알림음이 한 번씩 다시 울린다.
      if (next !== current) playSound("phoneBeep", { variation: 0.04 });
      return next;
    });
  }, []);
// ...
  useEffect(() => {
    const node = scrollRef.current;
    if (!node || !readingFriends) return;
    node.scrollTop = node.scrollHeight;
  }, [readingFriends, revealed]);
```

**mom-chat 방 열기** — `minigames/mom-chat/index.tsx` · `useEffect(keydown)`
```tsx
  useEffect(() => {
    if (frozen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== "Enter" && event.code !== "Space") return;
      event.preventDefault();
      if (!opened) openRoom();
      else complete({ cleared: true });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [opened, frozen, openRoom, complete]);
```

**computer-browse 투명 input 슬롯** — `minigames/answer-input.tsx` · `AnswerSlots`
```tsx
      <input
        ref={(node) => {
          ownRef.current = node;
          if (typeof inputRef === "function") inputRef(node);
          else if (inputRef) inputRef.current = node;
        }}
        // 시각은 슬롯이 전담한다. input은 투명하게 전체를 덮고 입력만 받는다
        className="absolute inset-0 cursor-text opacity-0"
        inputMode="numeric"
        autoComplete="off"
        disabled={disabled}
        value={value}
        aria-label={label}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, length))}
      />
```

**computer-browse 네 자리가 차면 바로 검사** — `minigames/computer-browse/index.tsx` · `typeEntry`
```tsx
  /** 숫자만 받는다. 네 자리가 차면 실제 로그인 화면처럼 바로 검사한다. */
  const typeEntry = useCallback(
    (raw: string) => {
      if (wrong || frozen) return;
      const digits = raw.replace(/\D/g, "").slice(0, COMPUTER_PASSCODE_LENGTH);
      if (digits.length > entry.length) playSound("phoneBeep", { variation: 0.04 });
      setEntry(digits);
      if (digits.length < COMPUTER_PASSCODE_LENGTH) return;
      if (digits === COMPUTER_PASSCODE) {
        unlock();
        return;
      }
      playSound("deny");
      setWrong(true);
      setFails((count) => count + 1);
    },
    [wrong, frozen, entry.length, unlock],
  );
```

**computer-logo 같은 로고 둘 다 고르기** — `minigames/computer-logo/index.tsx` · `MATCH_COUNT`, `pick`
```tsx
/** 넘어가려면 맞춰야 하는 칸 수: 같은 로고가 있는 곳 전부. */
export const MATCH_COUNT = LOGO_CANDIDATES.filter(matchesLabel).length;
// ...
  const pick = useCallback(
    (candidate: LogoCandidate) => {
      if (verdict || frozen || screen !== "match" || found.includes(candidate.id)) return;
      setPicked(candidate.id);
      if (matchesLabel(candidate)) {
        playSound("radioLock");
        const next = [...found, candidate.id];
        setFound(next);
        if (next.length === MATCH_COUNT) setVerdict("right");
      } else {
        playSound("deny");
        setVerdict("wrong");
      }
    },
    [verdict, frozen, screen, found],
  );
```

**window-view 돋보기 렌즈** — `minigames/window-view/index.tsx` · 렌즈 `<span>`
```tsx
          <span
            aria-hidden
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-paper/80 shadow-panel"
            style={{
              left: `${lens.x}%`,
              top: `${lens.y}%`,
              width: `${LENS_SIZE}%`,
              aspectRatio: "1",
              backgroundImage: `url(${ASSETS.images.mgWindowViewOutside})`,
              backgroundSize: `${LENS_ZOOM * 100}% auto`,
              backgroundPosition: `${lens.x}% ${lens.y}%`,
            }}
          >
```

**frequency-tune 위상 누적 바늘과 잡음 조준** — `minigames/frequency-tune/index.tsx` · `useEffect(rAF)`
```tsx
    // 경과 시간이 아니라 위상을 누적한다. 주기가 바뀌는 순간 바늘이 순간이동하지 않게.
    let phase = 0;
    const loop = (now: number) => {
      phase = (phase + (now - last) / periodRef.current) % 1;
      last = now;
      const position = (Math.sin(phase * Math.PI * 2) + 1) * 50;
      positionRef.current = position;
      if (needleRef.current) needleRef.current.style.left = `${position}%`;
      if (pointerRef.current) pointerRef.current.style.left = `${position}%`;
      if (readoutRef.current) readoutRef.current.textContent = freqAt(position);
      // setState 없이 게인만 민다. 매 프레임 리렌더가 나면 60fps가 안 나온다.
      const level = staticLevel(position, bandLeftRef.current, bandWidthRef.current);
      bedRef.current?.setLevel(level);
      // 잡음이 걷히는 만큼 TUNING 램프가 밝아진다. 소리와 같은 값을 눈으로도 준다.
      if (lampRef.current) lampRef.current.style.opacity = (1 - level).toFixed(3);
      frame = requestAnimationFrame(loop);
    };
```
```ts
export function staticLevel(position: number, bandLeft: number, bandWidth: number): number {
  const inner = bandWidth / 2;
  const distance = Math.abs(position - (bandLeft + inner));
  if (distance <= inner) return STATIC_FLOOR;
  return Math.min(1, STATIC_FLOOR + ((distance - inner) / STATIC_FALLOFF) * (1 - STATIC_FLOOR));
}
```

**radio-quiz 힌트 글자 수** — `minigames/radio-quiz/letters.ts` · `hintCount`
```ts
export function hintCount(misses: number, answerLength: number): number {
  return Math.max(0, Math.min(answerLength - 1, Math.floor(misses / MISSES_PER_HINT)));
}
```

**인스펙트 발견 판정** — `components/canvas/InspectTurntable.tsx` · `useFrame`, `components/canvas/inspect-math.ts` · `ReadTimer`
```tsx
    const facing = Math.cos(yawRef.current - object.foundYaw) > FACING_COS;
    if (readRef.current.tick(facing, delta)) onFoundRef.current();
```
```ts
export class ReadTimer {
  private held = 0;
  private done = false;

  tick(condition: boolean, delta: number): boolean {
    if (this.done) return false;
    if (!condition) {
      this.held = 0;
      return false;
    }
    this.held += delta;
    if (this.held < READ_SECONDS) return false;
    this.done = true;
    return true;
  }
}
```

**papers-order 들고 옮기기** — `minigames/papers-order/index.tsx` · `keyRef`
```tsx
    const step = event.code === "ArrowUp" ? -1 : event.code === "ArrowDown" ? 1 : 0;
    if (step !== 0) {
      event.preventDefault();
      const to = Math.max(0, Math.min(order.length - 1, cursor + step));
      if (to === cursor) return;
      if (held !== null) {
        // 집은 조각을 한 칸 옮긴다: 이웃과 맞바꾸고 계속 들고 있다
        playSound("flip", { variation: 0.05 });
        setOrder((current) => swapPapers(current, cursor, to));
        setHeld(to);
      }
      setCursor(to);
      return;
    }
```

**sink-dial 드래그 눈금과 덜 넘어간 비율** — `minigames/sink-dial/index.tsx` · `onPointerMove`
```tsx
  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragging.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      drag.carry += event.clientY - drag.lastY;
      drag.lastY = event.clientY;
      while (Math.abs(drag.carry) >= DRAG_PX_PER_STEP) {
        const step = drag.carry > 0 ? 1 : -1;
        drag.carry -= step * DRAG_PX_PER_STEP;
        turn(drag.index, step);
      }
      dragRef.current[drag.index] = drag.carry / DRAG_PX_PER_STEP;
    },
    [turn],
  );
```
```ts
export const SINK_DIAL_CODE = "407";
```

**piano-melody 악보 조각 없이는 울리지 않는 건반** — `minigames/piano-melody/index.tsx` · `pressKey`
```tsx
  const pressKey = (index: number) => {
    const key = PIANO_KEYS[index];
    if (doneRef.current || lockedRef.current) return;
    pressRef.current[index] = 1;
    // 악보 조각이 없으면 건반은 눌리기만 하고 소리가 안 난다. 무엇을 칠지 모르는 채로
    // 두드리게 두지 않고 "악보가 필요하다"를 호스트가 띄운다 (needsItem)
    if (!hasScrap) {
      playSound("deny");
      onBlocked?.();
      return;
    }
    playTone(NOTE_HZ[key.note]);
```

**piano-melody 뚜껑과 건반 damp** — `minigames/piano-melody/index.tsx` · `useFrame`
```tsx
  useFrame((_, delta) => {
    const lid = lidRef.current;
    if (lid) {
      const step = Math.min(1, delta * LID_LAMBDA);
      lid.rotation.x += (LID_OPEN_ANGLE - lid.rotation.x) * step;
    }
    const step = Math.min(1, delta * KEY_LAMBDA);
    for (const [index, key] of PIANO_KEYS.entries()) {
      const pressed = keyRefs.current[index];
      if (!pressed) continue;
      pressRef.current[index] += (0 - pressRef.current[index]) * step;
      pressed.position.y = key.position[1] - pressRef.current[index] * KEY_PRESS_DEPTH;
    }
  });
```

**ampoule-pickup 서랍과 들기** — `minigames/ampoule-pickup/index.tsx` · `useFrame`
```tsx
  useFrame((state, delta) => {
    elapsedRef.current += delta;
    const offset = drawerOffset(elapsedRef.current);
    drawerRef.current?.position.setZ(offset);

    const ampoule = ampouleRef.current;
    if (ampoule) {
      if (liftRef.current === null) {
        const [x, y, z] = AMPOULE_REST.position;
        ampoule.position.set(x, y, z + offset);
        ampoule.rotation.set(...AMPOULE_REST.rotation);
      } else {
        liftRef.current += delta;
        const pose = liftPose(liftRef.current, state.clock.elapsedTime);
        ampoule.position.set(...pose.position);
        ampoule.rotation.set(...pose.rotation);
        ampoule.scale.setScalar(pose.scale);
      }
    }
```

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
- turning에는 정적 구간(`signalSilence`)이 있다. 신호가 잡히기 전에는 라디오 2차가 열리지 않는다.

### 클릭에서 수첩까지
1. **3D 오브젝트 클릭** (`MemoryObjects.tsx`의 `InteractiveMemory`): available이면 펀치 모션과 함께 진입한다. 잠겼거나 이미 본 물건이면 혼잣말이나 수첩의 한 줄을 띄우고, 조사를 마친 뒤 배경 단서가 된 물건은 단서 화면을 연다. 키보드는 가까이에서 E/Enter.
2. **`beginInteraction`**: 대사 → 미니게임 → 완료 순으로 분기한다.
3. **대사**: 타자기와 오토 모드.
4. **미니게임**: overlay는 시작 카드 → 판 → 결과 카드(성공은 2.6초 뒤 저절로 넘어가고, 실패는 다시 해보기/나중에 하기), `bare`·`framed` 판은 시작 카드 없이 바로 열린다. canvas는 곧바로 결과. 실패하면 핫스팟이 남아 재도전할 수 있다.
5. **결과 대사**: 판을 정지 화면으로 뒤에 남긴 채 진행한다(`keepMinigame`). 그 층은 `inert`라 입력을 먹지 않는다.
6. **`complete()`**: 차수별로 기록하고 걸린 컷씬을 **대기열**에 줄 세운다. 순서는 radio-blackout(1차를 다 모은 순간) → 조사에 붙은 컷씬(console-flashback, ball-flashback, still-beat, survivor-broadcast) → trip-doubt → p2-close → p4-close.
7. **수첩**: 기록 항목은 진행에서 파생된다. 안 읽은 점이 붙고, 다시보기는 미니게임을 빼고 대사와 그림만 이어 재생한다.

### 그 밖의 시스템
- **재생 기계** `ActivePlayback`: 컷씬과 다시보기가 공유한다. intro → 줄 → holdMs 정적 → 다음 컷. 스킵은 지금 컷씬만 닫고 대기열은 계속 흐른다. bat-grip 컷씬은 끝나거나 건너뛰는 순간 배트를 손에 쥐여 준다.
- **문·아이템·퍼즐·단서**
  - 방문은 radio 2차 뒤에 열린다.
  - 미궁 문제는 `PuzzleHost`가 세운다. sink-dial은 컴퓨터 3차의 아빠 메일 힌트를 본 뒤에만 열리고, piano-melody는 안방 책상의 악보 조각(`piano-sheet`)을 들고 와야 칠 수 있다.
  - 풀린 문제는 결과 카드를 띄우고, "계속"을 눌러야 보상이 나간다. sink-dial은 안방 열쇠(`parents-key`)와 혼잣말, 하부장으로 밀고 들어가는 크레인 샷을 준다.
  - 단서 뒤집기로 `hero-name`과 `sink-code`를 발견한다.
- **1인칭 구간**: 인트로(어둠 속에서 스위치 찾기)와 문 넘기. 1인칭 동안에는 조사를 시작하지 않는다.
- **입력 잠금**: 인터랙션, 재생, 미궁 문제, 크레인 샷(`cameraHold`), `uiLocks` 중 하나라도 있으면 씬 입력을 막는다.
- **난이도**: 보통(`normal`, 기본)과 이지(`guided`) 둘이다. 스킵은 둘 다 열리고, 이지만 HUD 목표 줄이 "어디에 가서 무엇을"까지 짚는다.
- **엔딩 시퀀스**: 배트가 빛남 → 쥐기 컷씬 → 현관문 → 문 열림과 GodRays → 영상 → 색종이 카드 → 처음으로.
- **저장** (zustand persist, `rom-progress` v3)
  - 진행, 수첩, 설정만 저장한다. 위치와 진행 중인 판은 저장하지 않는다.
  - `sanitizeProgress`가 모르는 id를 버리고, 차수·문·엔딩의 선후 관계를 불러올 때 다시 검증한다. 옛 난이도 값(easy·normal)은 전부 새 보통으로 읽는다.

### 관련 코드

**페이즈 파생** — `data/story-phase.ts` · `storyPhaseOf`
```ts
/** 지금 이야기의 어느 페이즈인가. */
export function storyPhaseOf(state: StoryProgress): StoryPhase {
  if (state.endingStarted) return "ending";
  // 불을 켜기 전. introDone을 모르는 옛 스냅샷, 그리고 이미 뭔가를 본 진행은 인트로를
  // 지난 것으로 본다 (불을 켜지 않고는 아무것도 볼 수 없다)
  if (state.introDone === false && state.collected.length === 0) return "intro";
  if (!allDone(state, P1_REQUIRED)) return "p1";
  if (!state.doorOpened) return "turning";
  if (!allDone(state, P2_REQUIRED)) return "p2";
  if (!(state.openedDoorways ?? []).includes(PARENTS_DOORWAY)) return "p3";
  if (!allDone(state, P4_REQUIRED)) return "p4";
  return "resolve";
}
```

**필수 조사 자동 계산** — `data/story-phase.ts` · `requiredVisits`
```ts
export function requiredVisits(phase: FromPhase | "p1"): VisitRef[] {
  return ALL_VISITS.filter((ref) => {
    const config = visitConfig(ref.id, ref.visit);
    if (!config || config.side) return false;
    return phase === "p1" ? ref.visit === 1 : config.from === phase;
  });
}
```

**3D 오브젝트 클릭** — `scenes/memory-room/MemoryObjects.tsx` · `InteractiveMemory`의 `onClick`
```tsx
      onClick={(event) => {
        event.stopPropagation();
        if (status !== "available") {
          if (backgroundClue) {
            punchRef.current = 0;
            playSound("open");
            openClue(backgroundClue);
          } else if (lockedRemark) {
            sayRemark(lockedRemark);
          } else if (!unseen) {
            // 이미 본 기억: 다시 조사시키지 않고, 수첩에 남은 마지막 기록을 한 줄 흘린다
            sayRemark("seen", id);
          }
          return;
        }
        punchRef.current = 0;
        onInteract(id);
      }}
```

**인터랙션 분기** — `store/memory-room.ts` · `beginInteraction`
```ts
      beginInteraction: (id) =>
        set((state) => {
          if (state.activePlayback) return state;
          // 1인칭에 있는 동안은 조사하지 않는다. 어둠 속의 할 일은 스위치 하나, 문 앞의 할 일은 나가기 하나다
          if (viewpointOf(state) !== null) return state;
          if (state.activeInteraction || hotspotStatus(state, id) !== "available") return state;
          const gamePhase = nextVisit(state, id);
          if (gamePhase === undefined) return state;
          const interaction = phaseConfigOf(id, gamePhase)?.interaction;
          if (interaction?.scriptId) {
            return {
              activeInteraction: {
                memoryId: id,
                gamePhase,
                phase: "dialogue" as const,
                scriptId: interaction.scriptId,
                lineIndex: 0,
              },
            };
          }
          // ...
          return complete(state, id, gamePhase);
        }),
```

**결과 카드** — `components/ui/MinigameHost.tsx` · `MinigameResultCard`
```tsx
const RESULT_HOLD_MS = 600;
/** 성공 카드가 저절로 넘어가는 시각(ms). 읽을 시간은 주되 붙잡아 두지는 않는다. */
const RESULT_AUTO_MS = 2600;
// ...
  useEffect(() => {
    const hold = window.setTimeout(() => setSettled(true), RESULT_HOLD_MS);
    return () => window.clearTimeout(hold);
  }, []);

  useEffect(() => {
    if (!cleared) return;
    const auto = window.setTimeout(() => onContinueRef.current(), RESULT_AUTO_MS);
    return () => window.clearTimeout(auto);
  }, [cleared]);
```

**결과 대사로 넘기기** — `store/memory-room.ts` · `finishMinigame`
```ts
          // 클리어했으면 결과 대사로: 미니게임 화면을 뒤에 남긴 채 대사창이 뜬다
          if (result.cleared && interaction?.resultScriptId) {
            return {
              activeInteraction: {
                ...active,
                phase: "dialogue" as const,
                scriptId: interaction.resultScriptId,
                keepMinigame: true,
                lineIndex: 0,
              },
            };
          }
          // ...
          if (!result.cleared) return { activeInteraction: null };
          return complete(state, active.memoryId, active.gamePhase);
```

**컷씬 대기열** — `store/memory-room.ts` · `cutscenesAfter`, `complete`
```ts
function cutscenesAfter(
  before: MemoryRoomState,
  after: MemoryRoomState,
  id: MemoryId,
  visit: Visit,
): ActivePlayback[] {
  const queue: (ActivePlayback | null)[] = [];
  if (visit === 1 && before.collected.length < MEMORY_GOAL && after.collected.length >= MEMORY_GOAL)
    queue.push(openCutscene(CUTSCENE_RADIO_BLACKOUT, { intro: true }));
  const own = phaseConfigOf(id, visit)?.cutscene;
  if (own) queue.push(openCutscene(own));
  if (tripDoubted(after) && !tripDoubted(before)) queue.push(openCutscene(CUTSCENE_TRIP_DOUBT));
  const was = storyPhaseOf(before);
  const now = storyPhaseOf(after);
  if (was === "p2" && now === "p3") queue.push(openCutscene(CUTSCENE_P2_CLOSE));
  if (
    now === "p4" &&
    hotspotStatus(after, P4_FINAL_MEMORY) === "available" &&
    hotspotStatus(before, P4_FINAL_MEMORY) !== "available"
  )
    queue.push(openCutscene(CUTSCENE_P4_CLOSE));
  return queue.filter((playback): playback is ActivePlayback => playback !== null);
}

function complete(state: MemoryRoomState, id: MemoryId, visit: Visit) {
  const marked = markVisit(state, id, visit);
  const after = { ...state, ...marked };
  const [first, ...rest] = cutscenesAfter(state, after, id, visit);
  return {
    ...marked,
    activeInteraction: null,
    activePlayback: first ?? state.activePlayback,
    queuedPlaybacks: first ? [...state.queuedPlaybacks, ...rest] : state.queuedPlaybacks,
  };
}
```

**재생 기계의 스킵** — `store/memory-room.ts` · `endPlayback`
```ts
      endPlayback: () =>
        set((state) =>
          state.activePlayback
            ? {
                // 건너뛰면 지금 컷씬만 닫힌다. 줄 서 있던 다음 컷씬은 그대로 흐른다
                activePlayback: state.queuedPlaybacks[0] ?? null,
                queuedPlaybacks: state.queuedPlaybacks.slice(1),
                // 건너뛰어도 배트는 손에 들어온다. 스킵은 유효한 결말이다
                ...(batGripEnding(state) ? { batTaken: true } : {}),
              }
            : state,
        ),
```

**미궁 문제 열기와 보상** — `store/memory-room.ts` · `openPuzzle`, `finishPuzzle`
```ts
      openPuzzle: (id) =>
        set((state) => {
          // 다른 화면(대사·미니게임·재생·단서)이 떠 있으면 위에 얹지 않는다
          if (state.activeInteraction || state.activePlayback || state.activeClue) return state;
          if (state.activePuzzle || state.solvedPuzzles.includes(id)) return state;
          // 하부장 다이얼은 아빠 메일 힌트(컴퓨터 3차)를 본 뒤에만 연다 (v4 3-5)
          if (id === "sink-dial" && !selectSinkHintRead(state)) return state;
          return { activePuzzle: id, puzzleBlocked: false };
        }),
// ...
          const reward: Partial<MemoryRoomState> =
            solved === "sink-dial"
              ? {
                  inventory: state.inventory.includes("parents-key")
                    ? state.inventory
                    : [...state.inventory, "parents-key"],
                  remark: { id: "sink-open", at: Date.now() },
                  // 열쇠가 있던 칸으로 카메라가 밀고 들어간다 (crane-shot.ts)
                  cameraHold: "sink-cabinet" as const,
                }
              : solved === "piano-melody"
                ? { remark: { id: "piano-done", at: Date.now() } }
                : {};
```

**미궁 문제의 결과 카드** — `components/ui/PuzzleHost.tsx` · `PuzzleHost`
```tsx
      {active && cleared && (
        <PuzzleResultCard
          line={t(definition?.solvedKey ?? "minigame.puzzleResult.default")}
          onContinue={() => {
            playSound("select");
            finishPuzzle({ cleared: true });
          }}
        />
      )}
```

**입력 잠금** — `store/memory-room.ts` · `selectSceneInputLocked`
```ts
export const selectSceneInputLocked = (state: MemoryRoomState) =>
  state.activeInteraction !== null ||
  state.activePlayback !== null ||
  state.activePuzzle !== null ||
  // 크레인 샷이 도는 동안 걸어 나가면 카메라가 빈자리를 본다
  state.cameraHold !== null ||
  state.uiLocks.length > 0;
```

**이지 모드의 다음 할 일** — `components/ui/HudGuide.tsx` · `nextStepId`
```tsx
function nextStepId(state: Parameters<typeof nextStep>[0] & { difficulty: string }): string | null {
  if (state.difficulty !== "guided") return null;
  const step = nextStep(state);
  if (!step) return null;
  if (step.kind === "memory") return `memory:${step.memory}:${step.space}`;
  if (step.kind === "doorway") return `doorway:${step.to}`;
  return step.kind;
}
```

**저장** — `store/memory-room.ts` · `persist` 옵션, `sanitizeProgress`
```ts
    {
      name: PERSIST_KEY,
      version: PERSIST_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        collected: state.collected,
        revisited: state.revisited,
        rechecked: state.rechecked,
        // ...
        difficulty: state.difficulty,
        // ...
      }),
      merge: (persisted, current) => ({ ...current, ...sanitizeProgress(persisted) }),
    },
```
```ts
  // 3차는 2차를 마친 기억에만 붙는다
  const rechecked = ids(saved.rechecked).filter(
    (id) => MEMORY_BY_ID[id].phase3 && revisited.includes(id),
  );

  // 방문은 라디오 목소리를 들은 뒤에만 열린다. 조건이 안 맞는 저장본은 닫고 시작
  const doorOpened = saved.doorOpened === true && revisited.includes("radio" as MemoryId);
// ...
    // 이지(guided)를 고른 저장본만 이지다. 옛 값(easy·normal)과 모르는 값은 보통으로
    difficulty: saved.difficulty === "guided" ? "guided" : "normal",
```

---

## 21. 오디오 연출

- **효과음 합성** (`lib/audio/engine.ts`, `voices.ts`)
  - 파일 없이 Web Audio로 만든다: 오실레이터(주파수 지수 램프) + 필터드 노이즈.
  - 딸깍 소리를 막는 지수 엔벨로프, 같은 소리 40ms 중복 차단, `variation`으로 무작위 피치, `pitch`로 전체 이조.
  - 효과음은 전용 버스(0.7)를 한 번 더 거쳐 곡 아래에 선다.
  - 샘플 파일이 등록된 소리만 파일로 덮어쓴다(batHit, select, open, mittTap, doorOpen, lightSwitch, computerBoot). 파일이 없으면 합성으로 남는다.
- **피아노 음**: `playTone`은 주파수를 직접 받는다. 사인파 배음 넷(1·2·3·4배)을 겹치고, 높은 배음일수록 작고 빨리 죽는다.
- **노이즈 베드**: 루프 노이즈에 HP/LP를 걸고 `setTargetAtTime`으로 레벨을 조절한다. 라디오 잡음과 테이프 히스에 쓴다.
- **BGM** (`music.ts`)
  - 그래프: `source → lowpass → dry/convolver → gain`.
  - **방 밝기 하나가 컷오프(460Hz~16kHz), 음량, 리버브 wet을 함께 움직인다.** 어두운 방에서는 곡이 먹먹하고 멀게 들린다.
  - **루프 이음새**: 꼬리 2.4초를 머리에 equal-power 크로스페이드로 접어 넣어 루프를 굽는다.
  - 트랙 교체는 2.2초 크로스페이드. 새 트랙을 다 받은 뒤에 겹치고, 후보 목록을 앞에서부터 받아 본다.
  - 정지할 때는 컷오프를 먼저 닫아 곡이 **물 밑으로 가라앉듯** 사라진다.
  - 리버브 임펄스는 코드로 굽는다. 대사(0.72)와 미니게임(0.42) 중에는 덕킹한다.
  - **곡 비키기**: 방 곡을 끊지 않고 음량만 0으로 내린 채 다른 곡을 튼다. fighter-duel은 판이 도는 동안 8비트 곡이, 액자 1차와 폰 2차의 결과 대사 동안에는 **타이틀 곡**이 든다(`resultMusic: title`). 끝나면 방 곡이 흐르던 자리에서 다시 올라온다.
  - 타이틀 화면의 곡은 방 바깥 곡(`startCueMusic`)으로 따로 돈다.
- **탭을 떠나면 멈춘다**: 탭이 숨으면 `AudioContext`를 suspend하고, 돌아오면 그 자리에서 잇는다. 뒤로 간 탭에서 조인 타이머 탓에 곡이 끊기던 문제를 막는다.
- **UI 연동**: DOM hover 소리(터치 제외), 화자별 대사 틱(두 글자에 한 번, 화자마다 음높이), 컷 셔터음, 수집음·라디오 각성음(스토어 subscribe 한 곳에서 재생).

### 관련 코드

**합성 보이스의 엔벨로프** — `lib/audio/engine.ts` · `scheduleVoice`
```ts
    oscillator.type = tone.waveform;
    oscillator.frequency.setValueAtTime(tone.from, begin);
    if (tone.to !== undefined && tone.to !== tone.from) {
      // 지수 램프는 0을 못 지나므로 주파수에만 쓴다 (양수 보장).
      oscillator.frequency.exponentialRampToValueAtTime(tone.to, end);
    }

    // 딸깍 소리를 막으려면 0에서 올렸다가 0으로 내려야 한다.
    gain.gain.setValueAtTime(0.0001, begin);
    gain.gain.exponentialRampToValueAtTime(tone.gain, begin + Math.min(0.012, tone.duration / 3));
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
```

**중복 차단, 피치 흔들기, 샘플 우선** — `lib/audio/engine.ts` · `playSound`
```ts
  const now = ctx.currentTime;
  const previous = lastPlayedAt.get(id) ?? -Infinity;
  if (now - previous < MIN_REPEAT_S) return;
  lastPlayedAt.set(id, now);

  const { variation = 0, pitch = 1 } = options;
  // 1을 중심으로 ±variation. 샘플에는 재생속도로, 합성에는 주파수 배율로 같은 값이 걸린다.
  const ratio = pitch * (variation > 0 ? 1 + (Math.random() * 2 - 1) * variation : 1);

  const sample = samples.get(id);
  if (sample) {
    playSample(ctx, sfxBus, sample, ratio, SAMPLE_GAIN[id]);
    return;
  }
  scheduleVoice(ctx, sfxBus, transposeVoice(VOICES[id], ratio), now + 0.001);
```

**피아노 음의 배음 합성** — `lib/audio/engine.ts` · `PIANO_PARTIALS`, `playTone`
```ts
const PIANO_PARTIALS: readonly { ratio: number; gain: number; decay: number }[] = [
  { ratio: 1, gain: 1, decay: 1 },
  { ratio: 2, gain: 0.45, decay: 0.6 },
  { ratio: 3, gain: 0.18, decay: 0.4 },
  { ratio: 4, gain: 0.08, decay: 0.28 },
];

export function playTone(frequency: number, { duration = 1.1, gain = 0.26 } = {}) {
  // ...
  scheduleVoice(
    ctx,
    sfxBus,
    {
      tones: PIANO_PARTIALS.map((partial) => ({
        from: frequency * partial.ratio,
        waveform: "sine" as const,
        delay: 0,
        duration: duration * partial.decay,
        gain: gain * partial.gain,
      })),
    },
    ctx.currentTime + 0.001,
  );
}
```

**노이즈 베드 레벨** — `lib/audio/engine.ts` · `startNoiseBed`
```ts
  const bed: NoiseBed = {
    setLevel(level) {
      if (stopped) return;
      const clamped = Number.isNaN(level) ? 0 : Math.min(1, Math.max(0, level));
      gain.gain.setTargetAtTime(clamped * peak, ctx.currentTime, 0.08);
    },
```

**탭을 떠나면 오디오를 세운다** — `lib/audio/engine.ts` · `onVisibilityChange`
```ts
function onVisibilityChange() {
  if (!context || context.state === "closed") return;
  if (isBackgrounded()) void context.suspend();
  else void context.resume();
}
/** 멈춘 컨텍스트를 깨운다. 뒤로 가 있는 동안에는 깨우지 않는다 (onVisibilityChange). */
function wake(ctx: AudioContext) {
  if (ctx.state !== "running" && !isBackgrounded()) void ctx.resume();
}
```

**밝기 → 컷오프·음량·리버브** — `lib/audio/music.ts` · `applyLevel`, `lib/audio/music-curve.ts` · `musicCutoff`
```ts
  target.lowpass.frequency.setTargetAtTime(musicCutoff(level), now, CUTOFF_GLIDE_S);
  target.dry.gain.setTargetAtTime(1 - wet, now, REVERB_GLIDE_S);
  target.wet.gain.setTargetAtTime(wet, now, REVERB_GLIDE_S);
  target.gain.gain.setTargetAtTime(targetVolume(), now, VOLUME_GLIDE_S);
```
```ts
export function musicCutoff(level: number): number {
  const clamped = clamp01(level);
  return CUTOFF_FLOOR * (CUTOFF_CEILING / CUTOFF_FLOOR) ** clamped;
}
```

**루프 꼬리 접기** — `lib/audio/music-curve.ts` · `foldLoopTail`
```ts
export function foldLoopTail(source: Float32Array, fade: number): Float32Array<ArrayBuffer> {
  const width = Math.min(Math.max(Math.floor(fade), 0), Math.floor(source.length / 3));
  if (width <= 0) return Float32Array.from(source);

  const length = source.length - width;
  const folded = Float32Array.from(source.subarray(0, length));
  for (let index = 0; index < width; index += 1) {
    // 등출력(equal-power) 곡선: 선형으로 섞으면 겹치는 구간의 음량이 파인다.
    const angle = ((index / width) * Math.PI) / 2;
    folded[index] = folded[index] * Math.sin(angle) + source[length + index] * Math.cos(angle);
  }
  return folded;
}
```

**트랙 교체 크로스페이드** — `lib/audio/music.ts` · `startMusic`
```ts
  void loadFirst(graph.context, candidates)
    .then((buffer) => {
      // 로딩 중에 다른 트랙으로 갈아탔거나 정지했으면 버린다
      if (currentRequest !== request) return;
      const { context, master } = graph;
      const outgoing = voice;
      const next = buildVoice(context, master, request, buffer);
      // 새 곡을 올리면서 옛 곡을 내린다. 사이에 빈 구간을 만들지 않는다
      next.gain.gain.setTargetAtTime(targetVolume(), context.currentTime, SWAP_S / 3);
      voice = next;
      if (outgoing) retire(outgoing, SWAP_S);
    })
```

**물 밑으로 가라앉는 정지** — `lib/audio/music.ts` · `retire`
```ts
  if (sink) {
    // 음량보다 컷오프가 먼저 닫혀야 "삼켜짐"이 들린다. 같은 속도면 그냥 페이드다
    playing.lowpass.frequency.cancelScheduledValues(now);
    playing.lowpass.frequency.setTargetAtTime(SINK_CUTOFF_HZ, now, fadeSeconds / 6);
  }
  playing.gain.gain.cancelScheduledValues(now);
  playing.gain.gain.setTargetAtTime(0.0001, now, Math.max(0.01, fadeSeconds / 3));
  playing.source.stop(now + fadeSeconds);
```

**리버브 임펄스 굽기** — `lib/audio/music.ts` · `reverbImpulse`
```ts
  const length = Math.floor(context.sampleRate * IMPULSE_S);
  const baked = context.createBuffer(2, length, context.sampleRate);
  for (let channel = 0; channel < baked.numberOfChannels; channel += 1) {
    const data = baked.getChannelData(channel);
    for (let index = 0; index < length; index += 1) {
      const remaining = 1 - index / length;
      data[index] = (Math.random() * 2 - 1) * remaining ** IMPULSE_DECAY;
    }
  }
```

**곡 비키기** — `lib/audio/music.ts` · `targetVolume`
```ts
function targetVolume(): number {
  // 다른 곡이 드는 동안 방 곡은 멈추지 않고 소리만 비운다. 돌아왔을 때 흐르던 자리에서 이어진다
  return overlayRequest ? 0 : musicVolume(level) * duck * trim;
}
```

**판 전용 곡** — `components/ui/MinigameHost.tsx` · `overlayMusic`
```tsx
  const overlayMusic = active?.phase === "minigame" && started ? hosted?.music : undefined;
  useEffect(() => {
    if (!overlayMusic) return;
    startOverlayMusic(overlayMusic);
    return () => stopOverlayMusic();
  }, [overlayMusic]);
```

**덕킹과 결과 대사의 타이틀 곡** — `lib/audio/index.ts` · `useRoomMusic`
```ts
const DIALOGUE_DUCK = 0.72;
const MINIGAME_DUCK = 0.42;
// ...
  useEffect(() => {
    if (foreground === "minigame") setMusicDuck(MINIGAME_DUCK);
    else if (foreground === "dialogue") setMusicDuck(DIALOGUE_DUCK);
    else setMusicDuck(1);
  }, [foreground]);

  useEffect(() => {
    if (!resultMusic) return;
    // 타이틀 곡은 루프를 접어 구웠다 (TitleScreen의 startCueMusic과 같은 버퍼를 쓴다)
    startOverlayMusic(RESULT_MUSIC_TRACK[resultMusic], {
      fold: true,
      volume: RESULT_MUSIC_VOLUME,
    });
    return () => stopOverlayMusic();
  }, [resultMusic]);
```

**화자별 대사 틱** — `components/ui/dialogue-sfx.ts` · `typeTick`
```ts
export function typeTick(speaker: CharacterId, char: string, count: number): TypeTick | null {
  // 첫 글자에서 울려야 말이 시작되는 순간과 소리가 붙는다 (count 1, 3, 5, ...)
  if (count % TICK_EVERY !== 1) return null;
  if (!SOUNDING.test(char)) return null;
  if (RADIO_SPEAKERS.includes(speaker)) return { id: "typeRadio", options: { variation: 0.12 } };
  // 흔든다. 완전히 같은 음의 연타는 말이 아니라 알람이다. 반음(6%) 안쪽이라 화자는 안 섞인다
  return { id: "type", options: { pitch: SPEAKER_PITCH[speaker] ?? 1, variation: 0.05 } };
}
```

**수집음과 라디오 각성음** — `lib/audio/index.ts` · `useAudioRuntime`
```ts
      useMemoryRoomStore.subscribe((state, previous) => {
        if (state.collected.length > previous.collected.length) playSound("collect");
        // ...
        if (selectRadioSignaling(state) && !selectRadioSignaling(previous)) {
          playSound("radioWake");
        }
      }),
```

---

## 22. 접근성과 reduced motion

- **reduced motion**
  - CSS: 등장은 짧은 fade로 대체한다. 장식 루프, 파문, 먼지는 끈다. 달력 장 바꾸기는 **0.12초로 줄이기만 하고 끄지 않는다**(넘기는 동작 자체가 내용이다). 격투는 대미지 숫자·콤보·배너처럼 정보를 나르는 글자는 남기고 움직임만 걷는다.
  - JS: 타자기 즉시 완성, 파티클·색종이·커스텀 커서·ExitFade 생략, 카메라 λ 상향, 흔들림·tear 없음, 그레인은 정지 타일로 대체. ball-catch의 공은 원근 비행 대신 제자리에서 커진다.
- **광과민 규정**: 전면 순백 금지, 초당 3회를 넘는 밝기 변화 금지. 불 켜기 덮개도 어둠에서 누런빛으로 천천히 걷힌다.
- **키보드**
  - 모든 미니게임을 키보드로 할 수 있다(예외: photo-wipe는 스킵으로 우회).
  - 3D 물건은 sr-only 버튼 목록으로 조작하고, 쓸 수 없는 물건은 `aria-disabled`로 이유를 남긴다.
  - 턴테이블은 드래그를 대신하는 버튼이 있다.
- **상태를 색만으로 말하지 않는다**: ▶ 표시, `aria-pressed`, 라벨을 함께 쓴다. `inert`, `role=status/alertdialog/log/progressbar`를 사용한다.

### 관련 코드

**CSS reduced motion** — `app/globals.css` · `@media (prefers-reduced-motion: reduce)`
```css
@media (prefers-reduced-motion: reduce) {
  /* 패널 등장은 자리 이동 없이 밝기만, 반복되는 숨쉬기·까딱임은 멈춘다 */
  .animate-fade-rise {
    animation: fade-only 0.16s ease-out both;
  }
  /* ... */
  /* 툭툭 옮겨 다니는 먼지는 낮은 세기라도 깜빡임이다. 정지 그레인만 남긴다 */
  .film-dust {
    display: none;
  }
  /* ... */
  .animate-calendar-fade {
    animation-duration: 0.12s;
  }
  /* ... */
  .animate-duel-damage {
    animation: batting-feedback 0.9s ease-out both;
  }

  /* 배너는 뜬 채로 있어야 하는 글자다. 등장 연출만 없애고 그대로 세운다 */
  .animate-duel-banner {
    animation: none;
  }
```

**타자기 즉시 완성** — `lib/use-typewriter.ts` · `useTypewriterState`
```ts
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setCount(chars.length);
      return;
    }
    setCount(0);
    const id = window.setInterval(() => {
      setCount((current) => {
        if (current >= chars.length) {
          window.clearInterval(id);
          return current;
        }
        return current + 1;
      });
    }, charMs);
    return () => window.clearInterval(id);
  }, [chars, charMs]);
```

**불 켜기 덮개** — `app/globals.css` · `.viewpoint-lamp`, `@keyframes viewpoint-dawn`
```css
.viewpoint-lamp {
  background: var(--color-scene-void);
}
.animate-viewpoint-dawn {
  animation: viewpoint-dawn 1s linear both;
}
@keyframes viewpoint-dawn {
  0% {
    background-color: var(--color-scene-void);
    opacity: 1;
    animation-timing-function: cubic-bezier(0.5, 0, 0.75, 1);
  }
  40% {
    background-color: color-mix(in srgb, var(--color-scene-sun) 30%, var(--color-night));
    opacity: 0.85;
```

**3D 물건의 sr-only 버튼 목록** — `components/ui/RoomInteractionPrompt.tsx`
```tsx
      <div className="sr-only">
        <fieldset>
          <legend>{legend}</legend>
          {MEMORY_IDS.map((id) => {
            const available = statuses[id] === "available";
            return (
              <button
                key={id}
                type="button"
                aria-disabled={!available}
                onClick={() => {
                  if (available) onInteract(id);
                }}
              >
                {labels[id]}
              </button>
            );
          })}
        </fieldset>
      </div>
```

**턴테이블 대체 버튼** — `components/ui/InspectView.tsx`
```tsx
              <button
                type="button"
                onClick={() => turn(-TURN_STEP)}
                aria-label={t("characterSheet.turnLeft")}
                className={STAGE_ICON_BUTTON}
              >
                <ArrowCounterClockwise size={15} weight="bold" />
              </button>
              <button
                type="button"
                onClick={() => turn(TURN_STEP)}
                aria-label={t("characterSheet.turnRight")}
                className={STAGE_ICON_BUTTON}
              >
                <ArrowClockwise size={15} weight="bold" />
              </button>
```

**결과 대사 뒤의 판을 입력에서 빼기** — `components/ui/MinigameHost.tsx` · `ExitFade inert`
```tsx
          inert={resultStage || shownOutcome !== null}
```

---

## 23. 성능·안정성 트릭 모음

- 반사 3종(MirrorReflection, SlitScanMirror, DotReflection)에 `onBeforeRender` 가드를 두고, 그리는 간격을 2~3프레임으로 둔다. 그 공간에 있을 때만 그린다.
- 무거운 RT 효과는 꺼져 있으면 **컴포넌트 자체를 마운트하지 않는다**. 켤지 끌지는 효과 예산 등급(`off`/`low`/`full`) 한 곳이 정한다: 모션을 끄면 off, 프레임이 떨어졌거나 터치 기기면 low(cheap만), 나머지는 full.
- 세기가 0인 광원과 판은 `visible=false`로 셰이더와 그림자 비용을 뺀다.
- 벽 opacity는 변화가 있을 때만 traverse하고, `transparent`를 미리 켜 재컴파일 스파이크를 막는다.
- emissive 틴트에 `needsUpdate`를 걸지 않는다.
- 파티클은 GPU 시간 함수라 CPU 비용이 uniform 갱신뿐이다.
- StrictMode 대응: useMemo 안에서 ref를 세팅하지 않고 반환값에 담는다. 리그 액션은 다시 얻는다.
- 직접 만든 텍스처, 재질, RT, Pass는 cleanup에서 dispose한다. useGLTF 캐시 소유 자원은 건드리지 않는다.
- Canvas 2D 효과(디졸브, 모프)는 30fps로 제한하고 작은 버퍼(128~320px)를 늘려 쓴다.
- SSR과 hydration 일치: 결정적 해시 난수를 쓰고, 값은 자릿수를 끊은 문자열로 넘긴다.
- jsdom 방어: 2D 컨텍스트 스텁 검사, 팔레트 토큰 FALLBACK.

### 관련 코드

**반사 한 프레임 한 번, 간격 두기** — `scenes/memory-room/MirrorReflection.tsx` · `useMemo(Reflector)`
```tsx
    const render = mirror.onBeforeRender;
    let renderedFrame = Number.NEGATIVE_INFINITY;
    mirror.onBeforeRender = (renderer: WebGLRenderer, scene: Scene, camera: Camera, ...rest) => {
      if (scene.overrideMaterial !== null || camera !== get().camera) return;
      const frame = renderer.info.render.frame;
      const interval = firstPersonRef.current ? 1 : THIRD_PERSON_INTERVAL;
      if (frame - renderedFrame < interval) return;
      renderedFrame = frame;
      mirror.getReflectionCamera(camera).layers.enable(MIRROR_ONLY_LAYER);
      render.call(mirror, renderer, scene, camera, ...rest);
    };
```

**꺼지면 마운트하지 않는 RT 효과** — `scenes/memory-room/SlitScanMirror.tsx` · `SlitScanMirror`
```tsx
  if (!enabled) {
    return (
      <InteriorBox
        size={[width, height, GLASS_DEPTH]}
        position={[0, 0, offset]}
        color={palette.storm}
        roughness={0.14}
        metalness={0.8}
      />
    );
  }
  return (
    <SlitScanGlass width={width} height={height} offset={offset} palette={palette} warm={warm} />
  );
```

**효과 예산 등급** — `lib/effects/effect-budget.ts` · `effectTier`, `effectEnabled`
```ts
export function effectTier({ reducedMotion, degraded, touch }: EffectBudgetInput): EffectTier {
  if (reducedMotion) return "off";
  if (degraded || touch) return "low";
  return "full";
}

/** 이 등급에서 이 값의 효과를 켤 수 있는가. */
export function effectEnabled(tier: EffectTier, cost: EffectCost): boolean {
  if (tier === "off") return false;
  if (tier === "low") return cost === "cheap";
  return true;
}
```

**세기가 0이면 끄기** — `scenes/memory-room/WindowLight.tsx` · `useFrame`
```tsx
    const goal = open > 0.02 ? MAX_SHAFT_OPACITY * intensity * (0.35 + 0.65 * open) : 0;
    uniforms.uOpacity.value = MathUtils.damp(uniforms.uOpacity.value, goal, 3, delta);
    material.visible = uniforms.uOpacity.value > 0.002;
```

**벽 재질 미리 투명화** — `scenes/memory-room/wall-materials.ts` · `markTransparent`, `prepareWallMaterials`
```ts
function markTransparent(material: Material): void {
  if (material.transparent) return;
  material.transparent = true;
  material.needsUpdate = true;
}

/**
 * transparent만 미리 켜 둔다. 이 플래그를 바꾸면 셰이더가 다시 컴파일되므로,
 * 벽이 스러지기 시작하는 첫 프레임에 한꺼번에 몰리면 눈에 띄게 끊긴다.
 */
export function prepareWallMaterials(root: Object3D): void {
  forEachMaterial(root, markTransparent);
}
```

**emissive 틴트는 uniform으로만** — `scenes/memory-room/MemoryObjects.tsx` · `setMaterialCollected`
```tsx
  if (collected) {
    target.emissive.set(memoryColor);
    target.emissiveIntensity = COLLECTED_EMISSIVE_INTENSITY;
  } else {
    target.emissive.setHex(baseline.color);
    target.emissiveIntensity = baseline.intensity;
  }
  /*
   * needsUpdate는 걸지 않는다. emissive 색·세기는 유니폼이라 다음 프레임에
   * 그대로 반영된다. needsUpdate를 걸면 셰이더가 통째로 재컴파일되면서 수집
   * 확정 프레임(미니게임을 닫는 순간)에 그 메쉬가 한 번 비어 보인다. 액자
   * 사진이 닫을 때마다 깜빡이던 원인이다.
   */
```

**GPU 시간 함수 파티클** — `scenes/memory-room/DustMotes.tsx` · `VERTEX_SHADER`, `useFrame`
```ts
    float travel = mod(pos.y - aBand.x + uTime * aRise, aBand.y);
    pos.y = aBand.x + travel;

    // 주파수가 다른 두 흔들림을 겹친다. 하나만 쓰면 전부 같은 박자로 흔들려 기계적이다.
    pos.x += sin(uTime * aDrift + aPhase) * uSway;
    pos.z += cos(uTime * aDrift * 0.61 + aPhase * 1.7) * uSway * 0.55;
```
```tsx
  useFrame((state, delta) => {
    const material = materialRef.current;
    if (!material) return;
    material.uniforms.uTime.value = state.clock.elapsedTime;
```

**StrictMode 안전한 useMemo 반환과 dispose** — `scenes/memory-room/BedModel.tsx`
```tsx
    let blanketMesh: Mesh | null = null;
    copy.traverse((object) => {
      const mesh = object as Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.material = materialFor(isBedPart(mesh.name) ? mesh.name : FALLBACK_PART);
      if (mesh.name === "blanket") blanketMesh = mesh;
    });
    return { cloned: copy, materials: [...made.values()], blanket: blanketMesh as Mesh | null };
  }, [scene, palette, breath]);

  useEffect(
    () => () => {
      for (const material of materials) material.dispose();
    },
    [materials],
  );
```

**Canvas 2D 30fps 제한** — `components/ui/CutDissolve.tsx` · `loop`
```tsx
/** 노이즈 판 한 변. 캔버스에 늘리거나 깔아 쓰므로 이 이상은 낭비다. */
const NOISE_SIZE = 128;
// ...
const MIN_FRAME_MS = 30;
// ...
      if (now - lastDrawn >= MIN_FRAME_MS) {
        lastDrawn = now;
        draw(dissolveThreshold(elapsed, durationMs));
      }
      frame = requestAnimationFrame(loop);
```

**결정적 해시 난수와 자릿수 끊기** — `components/ui/RisingDust.tsx` · `hashUnit`, `css`
```tsx
function hashUnit(seed: number): number {
  const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
}

/**
 * CSS 값으로 쓸 수 있게 자릿수를 끊는다. 뒤에 남는 0은 지운다.
 * 브라우저는 `55.600%`를 다시 적을 때 `55.6%`로 줄이므로, 0을 달고 있으면
 * 왕복한 값이 서버가 쓴 것과 달라져 hydration이 어긋난다.
 */
function css(value: number, digits: number): string {
  return String(Number(value.toFixed(digits)));
}
```

**jsdom 방어** — `minigames/piano-melody/index.tsx` · `canDrawText`, `scenes/memory-room/palette.ts` · `resolveRoomPalette`
```tsx
function canDrawText(ctx: CanvasRenderingContext2D | null): ctx is CanvasRenderingContext2D {
  return typeof ctx?.fillText === "function" && typeof ctx.clearRect === "function";
}
```
```ts
  const read = (key: keyof RoomPalette) => {
    const value = styles.getPropertyValue(TOKEN_BY_KEY[key]).trim();
    if (value !== "") return value;
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `씬 팔레트 토큰 ${TOKEN_BY_KEY[key]}이 비어 있어 폴백을 쓴다. CSS가 아직 안 붙었는가?`,
      );
    }
    return FALLBACK[key];
  };
```

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
