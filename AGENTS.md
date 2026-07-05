<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# room-of-memory

3D 기반 짧은 비주얼 노벨 게임 + 인터랙션 사이트. 정적인 페이지가 아니라 "플레이되는" 웹사이트가 목표.

## Stack

- **Next.js (App Router) + TypeScript** — Vercel 배포 전제
- **three.js + @react-three/fiber + @react-three/drei + @react-three/postprocessing** — 3D 렌더링
- **zustand** — 게임 상태 (현재 챕터/노드, 플래그, 설정)
- **howler** — BGM/SFX
- **Tailwind CSS v4** — DOM 오버레이 UI (대사창, 선택지, 메뉴)
- **Biome** — lint + format (ESLint/Prettier 사용 금지)

## Commands

- `pnpm dev` — dev 서버
- `pnpm build` — 프로덕션 빌드 (머지 전 필수 통과)
- `pnpm lint` / `pnpm lint:fix` — Biome 검사/자동수정
- `pnpm typecheck` — tsc --noEmit
- `pnpm design:lint` — DESIGN.md 토큰 검증

Git 훅(husky): pre-commit = staged 파일 Biome 검사 + 25MB 초과 파일 차단, pre-push = typecheck + build. 훅을 우회(`--no-verify`)하지 않는다.

## Architecture

- `src/app/` — 라우트. 3D Canvas는 클라이언트 컴포넌트로 dynamic import
- `src/components/canvas/` — Canvas 내부에서만 쓰는 3D 컴포넌트
- `src/components/ui/` — Canvas 밖 DOM 오버레이 (대사창, 선택지, HUD)
- `src/scenes/` — 챕터별 3D 씬. 시나리오의 `scene` 키로 등록
- `src/minigames/` — 미니게임. `src/types/minigame.ts` 계약을 만족, `index.ts` 레지스트리에 등록
- `src/data/scenario/` — 시나리오 데이터. `src/types/scenario.ts`의 `Chapter` 타입을 반드시 만족
- `src/store/` — zustand 스토어
- `public/assets/` — 모든 에셋 (models/textures/audio/images/fonts). S3 등 외부 스토리지 없음, 전부 리포에 커밋

## Design system

시각 디자인의 단일 소스는 루트의 **`DESIGN.md`** (google-labs-code/design.md 포맷). UI 색상·타이포·간격은 반드시 DESIGN.md 토큰에서 가져오고, 하드코딩된 hex 값을 새로 만들지 말 것. 토큰 변경 후 `pnpm design:lint`로 검증.

## Rules

세부 규칙은 `.claude/rules/`에 분리되어 있음:
- `r3f.md` — react-three-fiber 성능/구조 규칙
- `assets.md` — 에셋 포맷, 용량 한도, 커밋 규칙
- `visual-novel.md` — 시나리오 데이터 작성 규칙
- `minigames.md` — 미니게임 구조/디자인/성능 규칙
- `code-style.md` — TypeScript/Biome 컨벤션
