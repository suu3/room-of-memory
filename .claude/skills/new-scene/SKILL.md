---
name: new-scene
description: 새 챕터(3D 씬 + 시나리오 데이터 + 씬 레지스트리 등록)를 스캐폴드한다. "새 씬 추가", "챕터 만들어줘" 같은 요청에 사용.
---

# 새 챕터 스캐폴드

인자: 챕터 id (예: `ch2`)와 한 줄 컨셉. 없으면 사용자에게 묻는다.

## 절차

1. 기존 구조 확인: `src/scenes/`와 `src/data/scenario/`의 기존 챕터 하나를 읽고 현재 패턴을 파악한다. 씬 레지스트리(씬 키 → 컴포넌트 맵)가 이미 있으면 그 방식을 따르고, 없으면 `src/scenes/index.ts`로 만든다.
2. `src/scenes/<ChapterId>Scene.tsx` 생성:
   - `"use client"` 클라이언트 컴포넌트
   - named camera position 맵 (최소 `default` 하나)과 `StageDirection` 해석 로직 자리
   - 임시 지오메트리(모델 없이도 렌더되도록 primitive 사용)
3. `src/data/scenario/<chapterId>.ts` 생성:
   - `Chapter` 타입 만족, `scene` 키는 2번에서 등록한 이름
   - `start` 노드 + 종착 노드 포함한 최소 그래프 (본문은 플레이스홀더 한국어)
4. 씬 레지스트리에 등록.
5. `npm run typecheck && npm run lint` 통과 확인.

## 규칙

- `.claude/rules/r3f.md`와 `.claude/rules/visual-novel.md`를 준수.
- 시나리오 본문을 길게 채우지 않는다 — 구조만 만들고, 본문은 사용자와 별도로 작업한다.
