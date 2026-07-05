# 시나리오 데이터 규칙

시나리오는 코드가 아니라 데이터다. `src/data/scenario/<chapterId>.ts`에서 `Chapter`(`src/types/scenario.ts`)를 export한다.

## 작성 규칙

- 노드 id는 `<chapterId>-<순번 또는 의미>` 형식: `ch1-intro`, `ch1-choice-door`.
- 한 노드의 `lines`는 8줄 이내로 유지 — 길면 노드를 쪼갠다 (세이브/스킵 단위가 노드).
- 대사 텍스트에 마크업/이스케이프 넣지 않는다. 강조 등 표현이 필요하면 스키마를 확장하고 타입에 먼저 반영.
- 모든 `next`/`choices[].next`는 같은 챕터 내 존재하는 노드 id여야 한다. 챕터 데이터를 수정하면 도달 불가능한 노드(고아 노드)와 끊긴 참조가 없는지 확인.
- `StageDirection.camera`/`trigger` 값은 해당 챕터 씬(`src/scenes/`)이 실제로 정의한 이름만 사용. 새 이름을 쓰려면 씬에 먼저 추가.
- 플래그 이름은 `flag:<chapterId>:<name>` 형식으로 통일.

## 텍스트 톤

- 게임 본문은 한국어. UI 라벨도 한국어 우선.
- 화자(`CharacterId`)는 새로 등장시키기 전에 기존 챕터들과 이름 충돌이 없는지 확인.
