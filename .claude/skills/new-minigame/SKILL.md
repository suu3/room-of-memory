---
name: new-minigame
description: 새 미니게임(컴포넌트 + 레지스트리 등록 + 시나리오 게이트 연결)을 스캐폴드한다. "미니게임 추가", "OO하는 게임 넣어줘" 같은 요청에 사용.
---

# 새 미니게임 스캐폴드

인자: 미니게임 id (kebab-case, 예: `lock-pick`)와 한 줄 컨셉, 모드(canvas/overlay). 모드가 불분명하면 컨셉으로 판단한다. 3D 오브젝트 조작이면 canvas, 카드·퍼즐·타이핑류면 overlay.

## 절차

1. `.claude/rules/minigames.md`와 `src/types/minigame.ts`를 읽는다. 기존 미니게임(`src/minigames/*/`)이 있으면 하나를 읽고 패턴을 따른다.
2. `src/minigames/<id>/index.tsx` 생성:
   - `MinigameProps`를 받는 컴포넌트. `onComplete`는 정확히 한 번만 호출되도록 가드.
   - 스킵 처리(N회 실패 또는 30초 경과 시 스킵 버튼 → `cleared: true`) 포함.
   - 조작법 안내 UI와 키보드 조작 포함.
   - 게임 로직은 플레이스홀더 수준이라도 clear/fail 두 경로가 실제로 동작해야 한다.
3. `src/minigames/index.ts` 레지스트리에 `MinigameDefinition` 등록 (lazy import).
4. 요청에 연결할 시나리오가 명시됐으면 해당 노드에 `MinigameGate`를 추가하고 `onClear`/`onFail` 노드가 존재하는지 확인.
5. `pnpm typecheck && pnpm lint` 통과 확인 후, dev 서버로 clear/fail/skip 세 경로를 확인한다.
