#!/usr/bin/env node
/**
 * content/*.yaml → 생성물 (src/data/generated/content.ts, i18n 리소스).
 *
 *   pnpm content:build    생성물을 쓴다
 *   pnpm content:check    생성물이 YAML과 맞는지만 본다 (안 쓴다). CI/테스트용.
 *
 * 어드민(dev 서버의 /admin)에서 저장하면 같은 파이프라인이 돈다.
 */
import process from "node:process";
import { buildContent, readGenerated, writeGenerated } from "./content/index.mjs";

const check = process.argv.includes("--check");

const built = await buildContent();

if (built.issues.length > 0) {
  console.error("콘텐츠 검증 실패:\n");
  for (const issue of built.issues) console.error(`  · ${issue}`);
  console.error("");
  process.exit(1);
}

if (!check) {
  const written = await writeGenerated(built.output);
  console.log(`콘텐츠 생성 완료 — ${written.length}개 파일`);
  for (const file of written) console.log(`  · ${file}`);
  process.exit(0);
}

const current = await readGenerated();
const stale = Object.keys(built.output).filter((file) => current[file] !== built.output[file]);

if (stale.length > 0) {
  console.error("생성물이 content/*.yaml과 어긋난다. `pnpm content:build`를 돌릴 것:\n");
  for (const file of stale) console.error(`  · ${file}`);
  console.error("");
  process.exit(1);
}

console.log("콘텐츠 검증 통과 — 생성물이 content/*.yaml과 일치한다.");
