<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# room-of-memory

3D 기반 짧은 비주얼 노벨 게임 + 인터랙션 사이트. 정적인 페이지가 아니라 "플레이되는" 웹사이트가 목표.

## Stack

- **Next.js (App Router) + TypeScript**: Vercel 배포 전제
- **three.js + @react-three/fiber + @react-three/drei + @react-three/postprocessing**: 3D 렌더링
- **zustand**: 게임 상태 (현재 챕터/노드, 플래그, 설정)
- **Web Audio**: BGM/SFX (`src/lib/audio/`. 효과음은 오실레이터로 합성하고, 파일이 있는 보이스만 파일을 쓴다)
- **Tailwind CSS v4**: DOM 오버레이 UI (대사창, 선택지, 메뉴)
- **Biome**: lint + format (ESLint/Prettier 사용 금지)

## Commands

- `pnpm dev`: dev 서버
- `pnpm build`: 프로덕션 빌드 (머지 전 필수 통과)
- `pnpm lint` / `pnpm lint:fix`: Biome 검사/자동수정
- `pnpm lint:wasm`: Biome WASM 판으로 같은 검사. `biome.exe`가 실행되지 않는 환경용 (Windows Smart App Control은 서명 없는 실행 파일을 막는다). pre-commit 훅도 이 경로를 쓴다
- `pnpm typecheck`: tsc --noEmit
- `pnpm content:build`: `content/*.yaml` → 생성물 (대본/흐름을 고쳤으면 반드시 실행)
- `pnpm content:check`: 생성물이 YAML과 맞는지 검사만 (쓰지 않음). `pnpm test`가 같은 검사를 포함한다
- `pnpm design:lint`: DESIGN.md 토큰 검증
- `pnpm images:blur`: 큰 그림(컷씬·스틸·창밖·달력·엔딩)의 흐린 미리보기를 `src/data/generated/image-blur.ts`로 굽는다. 그림을 넣거나 바꿨으면 실행 (`pnpm test`가 어긋남을 잡는다)
- `pnpm model:prep <내보낸.glb> <이름>`: 블렌더 glb를 압축·검사해 `public/assets/models/`에 넣는다 (내보내기 설정은 `docs/model-export.md`)

대본·흐름은 dev 서버의 `/admin`(로컬 전용 편집기)에서 폼으로 고칠 수도 있다. 저장하면 YAML과 생성물이 함께 갱신된다.

Git 훅(husky): pre-commit = staged 파일 Biome 검사 + 25MB 초과 파일 차단, pre-push = typecheck + build. 훅을 우회(`--no-verify`)하지 않는다.

## Architecture

- `content/`: **대본과 게임 흐름의 단일 소스** (YAML). 사람이 고치는 곳은 여기다
- `scripts/content/`: 콘텐츠 파이프라인 (읽기·검증·생성). 어드민과 `pnpm content:build`가 공유
- `scripts/`: 빌드·검사가 부르는 스크립트 (`package.json`의 명령이 여기를 가리킨다)
- `scripts/assets/`: 에셋을 한 번 만들고 끝나는 생성·가공 스크립트 (`create-*` · `recolor-*` · `retarget-*`, node와 블렌더용 python). 다시 만들 때만 손으로 돌린다
- `src/app/`: 라우트. 3D Canvas는 클라이언트 컴포넌트로 dynamic import
- `src/app/admin/`: 로컬 전용 대본 편집기. `*.dev.tsx`라 프로덕션 빌드에는 라우트가 안 생긴다
- `src/components/canvas/`: Canvas 내부에서만 쓰는 3D 컴포넌트
- `src/components/ui/`: Canvas 밖 DOM 오버레이. 기능별 폴더로 나뉜다 (`shell` 앱 뼈대 · `boot` 로딩·타이틀 · `dialogue` 대사 · `playback` 컷씬 · `notebook` 수첩 · `hud` HUD·메뉴 · `inspect` 단서 보기 · `minigame` 호스트 · `ending` · `shared` 공용). 컴포넌트(PascalCase)와 그 컴포넌트만 쓰는 순수 로직(kebab-case)은 같은 폴더에 둔다. 폴더 바로 아래에 파일을 두지 않는다
- `src/scenes/`: 챕터별 3D 씬. 시나리오의 `scene` 키로 등록. `memory-room/`은 기능별 폴더로 나뉜다 (`world` 좌표·얼개 · `player` · `camera` · `rooms/<공간>` 껍데기·가구 · `memory` 기억 물건 · `effects` 후처리·분위기 · `shared` 공용 부품)
- `src/minigames/`: 미니게임. `src/types/minigame.ts` 계약을 만족, `index.ts` 레지스트리에 등록
- `src/data/generated/`: **생성물. 직접 고치지 말 것** (`content/`에서 나온다)
- `src/data/spaces.ts`: 집의 얼개 (공간·문간 id, 기억이 놓인 공간). 좌표는 씬에 있다
- `src/data/memory-room.ts`: 대본이 아닌 데이터 (조사 목록 등) + 생성물 재수출
- `src/store/`: zustand 스토어
- `public/assets/`: 모든 에셋 (models/textures/audio/images/fonts). S3 등 외부 스토리지 없음, 전부 리포에 커밋

## Design system

시각 디자인의 단일 소스는 루트의 **`DESIGN.md`** (google-labs-code/design.md 포맷). UI 색상·타이포·간격은 반드시 DESIGN.md 토큰에서 가져오고, 하드코딩된 hex 값을 새로 만들지 말 것. 토큰 변경 후 `pnpm design:lint`로 검증.

예외는 `src/app/admin/` 하나다. 어드민은 프로덕션에 안 들어가는 로컬 편집 도구라 게임 팔레트를 따르지 않고, 눈이 덜 피로한 중립 회색 팔레트를 `src/app/admin/admin-theme.css`에 따로 둔다 (`.admin-theme` 스코프). 어드민 컴포넌트의 색은 전부 그 파일의 `--admin-*` 변수에서 가져온다.

## Rules

세부 규칙은 `.claude/rules/`에 분리되어 있음:
- `r3f.md`: react-three-fiber 성능/구조 규칙
- `assets.md`: 에셋 포맷, 용량 한도, 커밋 규칙
- `visual-novel.md`: 시나리오 데이터 작성 규칙
- `minigames.md`: 미니게임 구조/디자인/성능 규칙
- `code-style.md`: TypeScript/Biome 컨벤션
- `architecture.md`: 계층 방향 (아래 계층은 위를 모른다)과 폴더 규칙. `src/architecture.test.ts`가 지킨다
- `paradigm.md`: 함수형이 기본, 객체지향은 경계에서만 (순수 함수 · 파생 상태 · 클래스를 쓰는 자리)
