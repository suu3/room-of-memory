# 코드 스타일

- Lint/format은 **Biome 단독** (`pnpm lint:fix`). ESLint/Prettier 설정 파일을 추가하지 않는다.
- TypeScript strict 유지. `any` 대신 제네릭/`unknown`. three.js 타입은 `@types/three`에서.
- named export 우선. 페이지/레이아웃 등 Next.js가 default export를 요구하는 경우만 예외.
- 상태는 zustand 스토어(`src/store/`)에 집중. 컴포넌트 로컬 UI 상태만 `useState`.
- 스타일은 Tailwind 유틸리티 클래스. 색상·간격·타이포는 DESIGN.md 토큰과 일치하는 값만 사용 — 임의의 hex/px 값을 새로 만들지 말 것.
- 커밋 전 체크: `pnpm lint && pnpm typecheck && pnpm build`.
