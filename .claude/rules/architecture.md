# 아키텍처: 의존은 한 방향으로

폴더 이름을 FSD로 바꾸지는 않는다. 가져오는 것은 그 핵심 하나, **아래 계층은 위 계층을 모른다**는 규칙이다. `src/architecture.test.ts`가 지킨다 (`pnpm test`).

## 계층 (아래 → 위)

```
types → i18n → data → store → lib → scenes · minigames · components → app
```

| 계층 | 무엇 | 모르는 것 |
|---|---|---|
| `types` | 계약 (미니게임·시나리오·좌석 타입) | 전부 |
| `i18n` | 번역 설정과 자원 | 스토어 · 화면 |
| `data` | 콘텐츠와 집의 얼개 (생성물, 공간·문간 id, 페이즈 계산) | 스토어 · 화면 |
| `store` | 바뀌는 게임 상태 (zustand) | 화면 |
| `lib` | 상태를 듣는 서비스와 공용 유틸 (오디오, 효과 예산, 에셋 경로) | 화면 |
| `scenes` · `minigames` · `components` | 화면 (3D 씬, 미니게임, DOM 오버레이) | `app` |
| `app` | 라우트 | - |

- 같은 계층끼리는 가져올 수 있다.
- 테스트 파일은 검사하지 않는다.
- 방향을 거슬러야 하면 가져오려는 것을 **아래로 내린다**. 대개 타입이나 상수 표다. 예: 공간·문간 id와 "기억이 어느 공간에 있는가"는 씬(`scenes/memory-room/spaces.ts`)에 있었는데, 스토어와 데이터가 그걸 보느라 씬을 가져왔다. 좌표 없는 얼개만 `data/spaces.ts`로 내리고 씬은 그 위에 좌표를 얹는다.
- 정말 내릴 수 없으면 테스트의 `ALLOWED`에 이유와 함께 적는다. 지금은 타입 파일 둘뿐이다.

## 폴더 안의 규칙

- `components/ui/`는 기능별 폴더다 (`shell` · `boot` · `dialogue` · `playback` · `notebook` · `hud` · `inspect` · `minigame` · `ending` · `shared`). 바로 아래에 파일을 두지 않는다. 컴포넌트(PascalCase)와 그 컴포넌트만 쓰는 순수 로직(kebab-case)은 같은 폴더에 둔다. 두 폴더 넘게 쓰이면 `shared`로 간다.
- 미니게임은 폴더 하나가 기능 하나다 (`minigames.md`).
- 스토어를 읽는 React 프로바이더는 화면이다: `components/ui/shell`에 둔다 (`I18nProvider`).

## 남은 것 (아직 풀지 않은 얽힘)

화면 계층 안에서는 방향이 없다. 지금 서로 가져오는 자리들이다. 새 코드는 여기에 더 보태지 않는다.

- `scenes` ↔ `components/canvas`: 씬과 캔버스 껍데기가 서로를 안다.
- `minigames` → `scenes` · `components/ui` · `store`: 미니게임이 씬의 팔레트·좌표와 공용 UI를 쓴다. `minigames.md`의 "전역 스토어를 직접 변이하지 않는다"와 닿는 부분이라, 손댄다면 여기부터다.
- `components/ui` → `scenes` · `minigames` · `components/canvas`.
