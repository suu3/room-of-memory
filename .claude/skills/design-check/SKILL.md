---
name: design-check
description: DESIGN.md 토큰을 검증하고, UI 코드가 디자인 토큰을 벗어난 하드코딩 값을 쓰는지 점검한다. UI 작업 후 또는 DESIGN.md 수정 후 사용.
---

# 디자인 시스템 점검

## 1. DESIGN.md 자체 검증

```bash
pnpm dlx @google/design.md lint DESIGN.md
```

JSON 결과의 findings를 해석해 보고한다 (끊긴 토큰 참조, WCAG 대비 미달 등).

## 2. 코드 ↔ 토큰 정합성

- DESIGN.md의 YAML frontmatter에서 색상 토큰 목록을 읽는다.
- `src/`에서 hex 색상 리터럴을 grep: `grep -rEn "#[0-9a-fA-F]{3,8}\b" src/ --include="*.tsx" --include="*.ts" --include="*.css"`
- `src/app/admin/`은 위반이 아니다 — 게임이 아닌 로컬 편집 도구라 자체 팔레트(`admin-theme.css`)를 쓴다 (AGENTS.md > Design system). 다만 어드민 컴포넌트가 `--admin-*` 변수 대신 hex를 직접 박고 있으면 그건 지적한다.
- 토큰에 없는 hex 값이 코드에 있으면 위반으로 보고한다 (토큰으로 치환 제안 또는 토큰 추가 제안).
- `src/app/globals.css`의 CSS 변수(`@theme`)가 DESIGN.md 토큰과 일치하는지 대조한다.

## 3. 토큰 변경 시

DESIGN.md 토큰을 바꿨다면 `globals.css`의 `@theme` 값도 함께 갱신하고, 필요하면 export를 활용한다:

```bash
pnpm dlx @google/design.md export --format json-tailwind DESIGN.md
```

보고: 위반 목록(파일:라인, 현재 값, 제안 토큰)과 lint 결과 요약.
