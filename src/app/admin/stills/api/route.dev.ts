/**
 * 스틸 저장 API: 로컬 dev 서버에만 존재한다 (../../api/route.dev.ts 머리말 참고).
 * 찍은 PNG data URL을 받아 webp로 `public/assets/images/`에 쓴다.
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import sharp from "sharp";

export const dynamic = "force-dynamic";

/** 스틸 이름만 받는다: 다른 에셋을 덮어쓰는 통로가 되면 안 된다. */
const STILL_NAME = /^still-[a-z0-9-]+\.webp$/;
const PNG_PREFIX = "data:image/png;base64,";

export async function POST(request: Request) {
  const { name, dataUrl } = (await request.json()) as { name?: unknown; dataUrl?: unknown };
  if (typeof name !== "string" || !STILL_NAME.test(name)) {
    return NextResponse.json({ error: "still-<이름>.webp 형태여야 한다." }, { status: 400 });
  }
  if (typeof dataUrl !== "string" || !dataUrl.startsWith(PNG_PREFIX)) {
    return NextResponse.json({ error: "PNG data URL이 아니다." }, { status: 400 });
  }
  const png = Buffer.from(dataUrl.slice(PNG_PREFIX.length), "base64");
  const webp = await sharp(png).webp({ quality: 88 }).toBuffer();
  await writeFile(path.join(process.cwd(), "public", "assets", "images", name), webp);
  return NextResponse.json({ name, bytes: webp.length });
}
