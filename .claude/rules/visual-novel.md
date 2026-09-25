# 시나리오 데이터 규칙

대본은 코드가 아니라 데이터다. 단일 소스는 리포 루트의 **`content/*.yaml`**이고, 게임이 읽는 TypeScript와 i18n 리소스는 거기서 **생성된다**.

```
content/memories.yaml    기억 목록 · 순서 · 해금 조건 · 인터랙션 흐름 + 수첩 기록
content/scripts.yaml     대사 스크립트 (ko/en/ja 본문 포함)
content/cutscenes.yaml   컷씬 (그림 · 정적 · 대사)
content/stages.yaml      방 단계별 독백
        │
        │  pnpm content:build   (또는 dev 서버 /admin에서 저장)
        ▼
src/data/generated/content.ts            MEMORIES / SCRIPTS / CUTSCENES: textKey만, 본문 없음
src/i18n/locales/<lng>/memory-room.json  본문. base.json(손으로 쓰는 부분) 위에 얹힌다
```

`src/types/scenario.ts`의 `Chapter`는 아직 쓰이지 않는 다중 챕터용 스키마다. 지금 게임이 실제로 도는 데이터는 위 파이프라인이다.

## 페이즈와 조사 차수 (v4)

- 이야기의 페이즈(intro · p1 · turning · p2 · p3 · p4 · resolve · ending)는 **저장하지 않는다**. 진행에서 파생된다 (`src/data/story-phase.ts`의 `storyPhaseOf`). 전이 조건과 표는 `docs/v4.md`.
- 기억 하나는 조사 차수를 셋까지 가진다: `phase1`(1차, p1), `phase2`(2차), `phase3`(3차: 2차 뒤의 되짚기). 2차 이후에는 `from`(열리는 페이즈)이 필수다.
- `unlockAfter: [radio]`는 같은 차수, `[computer@3]`은 그 기억의 3차다. 그 차수가 없으면 아래로 가장 가까운 차수를 본다.
- `side: true`는 곁가지다. 페이즈를 넘기는 데 필요 없고 밝기 곡선에도 안 낀다. 그 밖의 `from: pN` 조사는 전부 그 페이즈의 필수 조사다.
- `cutscene: <id>`는 그 조사를 마치는 순간 트는 컷씬이다. 페이즈를 닫는 한 줄(p2-close · p4-close)은 스토어가 전이를 보고 튼다.

## 고치는 법

- **YAML만 고친다.** `src/data/generated/`와 `src/i18n/locales/<lng>/memory-room.json`은 생성물이라 손으로 고치면 다음 생성 때 덮인다. 손으로 쓰는 번역(`characters`, `memories` 이름)은 같은 폴더의 `memory-room.base.json`에 있다.
- 고친 뒤 `pnpm content:build`. 잊으면 `pnpm test`가 "생성물이 content/*.yaml과 어긋난다"로 잡는다.
- 폼으로 고치고 싶으면 `pnpm dev` 후 <http://localhost:3000/admin>. 저장이 같은 파이프라인을 돌린다. 검증에 걸리면 아무것도 쓰지 않고 문제 목록만 띄운다. 저장은 YAML 문서를 제자리에서 고치므로 기획 주석이 살아남는다 (지운 항목의 주석만 같이 사라진다).
- 어드민은 로컬 전용이다. `*.dev.tsx`/`*.dev.ts`라 프로덕션 빌드에는 라우트 자체가 만들어지지 않는다 (`pnpm build`의 라우트 목록에 `/admin`이 없는 것으로 확인).

## 작성 규칙

- id는 kebab-case. 기억 id는 3D 씬의 오브젝트, 에셋 파일명, `memories.<id>.name`까지 걸쳐 있어 **어드민에서 못 바꾼다**. 새 기억을 만들거나 id를 바꾸려면 씬·에셋·base.json을 같이 손봐야 한다.
- 한 스크립트의 줄은 8줄 이내로 유지: 길면 스크립트를 쪼갠다.
- 대사 본문은 생성된 데이터에 들어가지 않는다. 데이터에는 `textKey`만 남고 본문은 i18n 리소스로 갈라진다. 저작 파일에서만 둘이 붙어 있다.
- 대사는 ko가 필수다. en/ja는 비어 있어도 막지 않는다: "번역 TODO"로 세어지고(`pnpm content:build`가 개수를 알린다) 생성물에는 ko 문장이 대신 들어간다. 대본을 한국어로 먼저 세우고 번역을 뒤따라 채우는 순서다 (v4 설계서 7-1). 텍스트에 마크업/이스케이프 금지: 표현이 필요하면 스키마를 먼저 확장한다.
- 화자·표정·아이콘은 `scripts/content/schema.mjs`의 허용 목록에 있는 것만 쓴다. 새로 쓰려면 거기 먼저 추가한다 (화자는 `memory-room.base.json`의 `characters.<id>.name`도 같이).
- 미니게임 id는 `src/minigames/index.ts` 레지스트리에 있는 것만.

## 생성 전에 막히는 것들

`pnpm content:build`와 어드민 저장이 공유하는 검증이다. 걸리면 파일을 쓰지 않는다.

- 없는 스크립트/미니게임/기억을 가리키는 참조
- 아무 데서도 안 쓰이는 스크립트 (죽은 대사)
- 빈 ko 문장 (en/ja 빈칸은 막지 않고 TODO로 센다)
- 2차 이후 조사에 `from`이 없는 경우, 없는 차수를 가리키는 `unlockAfter`(`x@3`)
- 대사도 정적(`holdMs`)도 없는 컷
- 자기 자신을 기다리거나 순환하는 `unlockAfter` (차수를 넘나드는 순환 포함)
- `minigame` 없이 붙은 `resultScript`
- 리포에 없는 `replayStill` 파일 (컷씬 일러스트는 예외: 없으면 회색 판이 대신 선다)
- phase2가 있는데 `lore.phase2`가 없는 경우, 또는 그 반대

## 텍스트 톤

- 기준 언어는 한국어(ko). en/ja는 확정된 ko를 번역해 채운다. 어드민이 세 언어를 나란히 세우는 이유다. 확정 전 스토리 텍스트는 언어별 더미 문구("여기에 대사가 들어갑니다" 등)로 채운다.
- 화자는 새로 등장시키기 전에 기존 화자와 이름이 겹치지 않는지 확인.
