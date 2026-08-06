/**
 * 어드민 API — 로컬 dev 서버에만 존재한다.
 *
 * 파일명이 `route.dev.ts`인 것이 방어선이다: next.config.ts가 dev에서만
 * `dev.ts`를 라우트 확장자로 치기 때문에, 프로덕션 빌드에는 이 라우트가 아예
 * 만들어지지 않는다 (Vercel 파일시스템이 읽기 전용이라 저장이 물리적으로
 * 불가능한 것과는 별개의, 그보다 앞선 방어선).
 */
import { NextResponse } from "next/server";
import type { ContentOptions, GameContent } from "@/types/content";
import { loadContent, saveContent } from "../../../../scripts/content/index.mjs";
import { loadMinigameIds } from "../../../../scripts/content/load.mjs";
import { EXPRESSIONS, ICONS, SPEAKERS, STAGE_IDS } from "../../../../scripts/content/schema.mjs";

/** 저장이 파일시스템을 건드리므로 캐시되면 안 된다. */
export const dynamic = "force-dynamic";

export async function GET() {
  const [content, minigameIds] = await Promise.all([loadContent(), loadMinigameIds()]);

  const options: ContentOptions = {
    icons: [...ICONS],
    speakers: [...SPEAKERS],
    expressions: [...EXPRESSIONS],
    minigameIds,
    stageIds: [...STAGE_IDS],
  };

  return NextResponse.json({ content, options });
}

export async function POST(request: Request) {
  let content: GameContent;
  try {
    content = (await request.json()) as GameContent;
  } catch {
    return NextResponse.json(
      { ok: false, issues: ["요청 본문을 JSON으로 읽지 못했다."], written: [] },
      { status: 400 },
    );
  }

  const result = await saveContent(content);

  // 검증에 걸린 저장은 실패지만 서버 잘못은 아니다 — 어드민이 문제 목록을 그대로 띄운다
  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}
