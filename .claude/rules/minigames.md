# 미니게임 규칙

미니게임은 VN 흐름 중간에 삽입되는 짧은 인터랙션이다. 계약은 `src/types/minigame.ts`, 시나리오 연결은 `ScenarioNode.minigame`(`MinigameGate`).

## 구조

- 위치: `src/minigames/<id>/` 폴더 하나가 미니게임 하나. 진입점은 `index.tsx`, 레지스트리는 `src/minigames/index.ts`에 `MinigameDefinition`으로 등록.
- 모드는 하나만 선택: `"canvas"`(현재 씬의 r3f Canvas 안에 마운트) 또는 `"overlay"`(Canvas 위 DOM 레이어). 하나의 미니게임이 둘을 섞지 않는다.
- 미니게임은 자기 완결적이어야 한다: 게임 전역 스토어를 직접 변이하지 않고, 결과는 반드시 `onComplete(result)` 한 번으로만 보고한다. 플래그 부여·노드 분기는 VN 엔진이 `MinigameGate`를 보고 처리한다.
- 미니게임이 떠 있는 동안 VN 입력(대사 진행, 선택지)은 엔진이 잠근다. 미니게임 쪽에서 VN UI를 건드리지 않는다.

## 디자인 제약

- 플레이 시간 30초~2분. 그 이상 길어지면 별도 챕터로 승격을 검토.
- **스킵은 늘 열린다**: 이지·보통 모두 일정 시간 경과 또는 N회 실패 시 스킵 UI를 노출한다 (이지는 거기에 HUD 목표 줄이 다음 할 일을 짚어 주는 것만 다르다: 스토어의 `Difficulty`). 타이밍은 `useSkipEligible`(src/minigames/shell.tsx) 한 곳이 담당: 미니게임 쪽에서 난이도를 따로 읽지 않는다. 스킵은 `cleared: true`로 처리.
- 실패는 유효한 결말이다. 실패 시에도 이야기가 계속되도록 `onFail` 분기를 시나리오에 마련하는 것을 기본으로.
- 조작법은 게임 시작 시 화면 안에서 설명한다 (별도 도움말 페이지 금지). 키보드만으로 플레이 가능해야 한다.
- 시각 요소는 DESIGN.md 토큰을 따른다. canvas 모드면 씬 라이팅 톤(night/memory/ember 파생)을 해치지 않을 것.

## 성능

- canvas 모드 미니게임에도 `.claude/rules/r3f.md`의 규칙(useFrame에서 setState 금지 등)이 그대로 적용된다.
- 미니게임 전용 에셋은 `public/assets/`의 종류별 폴더에 두되 파일명에 미니게임 id를 접두사로: `mg-lock-pick-dial.glb`.
- 미니게임 컴포넌트는 lazy import: 챕터 진입 시가 아니라 게이트 도달 직전에 preload.
