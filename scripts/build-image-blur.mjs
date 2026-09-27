#!/usr/bin/env node
/**
 * 큰 그림의 흐린 미리보기 → src/data/generated/image-blur.ts
 *
 *   pnpm images:blur    생성물을 쓴다 (그림을 넣거나 바꿨으면 돌린다)
 *
 * 그림이 받아지기 전에 빈 칸 대신 흐린 판이 서게 한다. 경로는 문자열 상수(ASSETS)라
 * next/image의 정적 import 블러를 못 쓰므로 여기서 직접 굽는다. 장당 수백 바이트.
 *
 * 대상은 처음 뜰 때 빈 칸이 눈에 띄는 큰 그림뿐이다 (컷씬·다시보기 스틸·창밖·달력·엔딩).
 * 알파가 있는 그림은 굽지 않는다: 받아진 뒤에도 뚫린 자리로 흐린 판이 비친다.
 *
 * 생성물에 원본의 해시를 같이 적어 둔다. 그림을 바꾸고 이걸 잊으면
 * src/lib/image-blur.test.ts가 잡는다.
 */
import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const IMAGES = path.join(ROOT, "public/assets/images");
const OUT = path.join(ROOT, "src/data/generated/image-blur.ts");

/** 흐린 판을 굽는 그림. src/lib/image-blur.test.ts가 같은 목록으로 검사한다. */
export const BLUR_TARGETS = [
  /^cutscene-.*\.webp$/,
  /^mg-cutscene-.*\.webp$/,
  /^mg-calendar-flip-\d+\.webp$/,
  /^mg-photo-wipe-phase-\d+\.webp$/,
  /^mg-window-view-outside\.webp$/,
  /^mg-ball-catch-sunset-field\.webp$/,
  /^ui-ending-thanks\.webp$/,
];

/** 긴 변 픽셀. 16이면 장당 200~400바이트이고, 늘려 그려도 형태는 읽힌다. */
const BLUR_SIZE = 16;

export function hashOf(buffer) {
  return createHash("sha256").update(buffer).digest("hex").slice(0, 16);
}

async function build() {
  const files = (await readdir(IMAGES))
    .filter((name) => BLUR_TARGETS.some((pattern) => pattern.test(name)))
    .sort();

  const entries = [];
  const skipped = [];
  for (const name of files) {
    const buffer = await readFile(path.join(IMAGES, name));
    const key = `/assets/images/${name}`;
    const hash = hashOf(buffer);
    const { isOpaque } = await sharp(buffer).stats();
    if (!isOpaque) {
      entries.push({ key, hash, data: null });
      skipped.push(name);
      continue;
    }
    const tiny = await sharp(buffer)
      .resize(BLUR_SIZE, BLUR_SIZE, { fit: "inside" })
      .webp({ quality: 50 })
      .toBuffer();
    entries.push({ key, hash, data: `data:image/webp;base64,${tiny.toString("base64")}` });
  }

  const body = [
    "// 생성물: 직접 고치지 말 것. `pnpm images:blur` (scripts/build-image-blur.mjs)",
    "",
    "/** 그림 경로(`?v=` 없이) → 흐린 미리보기 data URL. */",
    "export const IMAGE_BLUR: Readonly<Record<string, string>> = {",
    // Biome 모양 그대로 쓴다 (data URL은 늘 줄 폭을 넘어 값이 다음 줄로 내려간다)
    ...entries
      .filter((entry) => entry.data)
      .map((entry) => `  "${entry.key}":\n    "${entry.data}",`),
    "};",
    "",
    "/** 구울 때 본 원본의 해시 (알파라 건너뛴 것까지). 그림이 바뀌었는데 다시 굽지 않았으면 테스트가 잡는다. */",
    "export const IMAGE_BLUR_SOURCES: Readonly<Record<string, string>> = {",
    ...entries.map((entry) => `  "${entry.key}": "${entry.hash}",`),
    "};",
    "",
  ].join("\n");
  await writeFile(OUT, body);

  const baked = entries.filter((entry) => entry.data);
  const bytes = baked.reduce((sum, entry) => sum + entry.data.length, 0);
  console.log(
    `흐린 미리보기 ${baked.length}장 (${(bytes / 1024).toFixed(1)}KB) → ${path.relative(ROOT, OUT)}`,
  );
  if (skipped.length > 0) console.log(`알파가 있어 굽지 않았다: ${skipped.join(", ")}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await build();
