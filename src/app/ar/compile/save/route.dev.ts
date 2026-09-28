/**
 * 구운 AR 타깃을 리포에 바로 쓴다. 어드민 API처럼 `route.dev.ts`라 dev 서버에만 있다.
 * 쓴 뒤에는 ASSETS.ar.target의 `?v=`를 올려야 폰의 서비스 워커 캐시를 넘는다.
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const TARGET = path.join(process.cwd(), "public/assets/ar/ar-target-hero.mind");

export async function POST(request: Request) {
  const data = Buffer.from(await request.arrayBuffer());
  if (data.length === 0) return NextResponse.json({ error: "빈 파일" }, { status: 400 });
  await writeFile(TARGET, data);
  return NextResponse.json({ path: path.relative(process.cwd(), TARGET), bytes: data.length });
}
