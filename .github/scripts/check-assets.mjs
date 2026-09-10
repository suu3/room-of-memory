#!/usr/bin/env node
// public/assets 안의 파일이 .claude/rules/assets.md의 용량·포맷 규칙을 지키는지 검사한다.
// 용량 초과는 실패(exit 1), 권장 포맷을 벗어난 건 경고만 한다. 기존 에셋을 한 번에
// 다 바꾸긴 어려우니 CI를 막지 않고 눈에만 띄게 둔다.
//
// 로컬 실행: node .github/scripts/check-assets.mjs

import { readdir, stat } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const ASSETS = path.join(ROOT, "public/assets");

const KB = 1024;
const MB = 1024 * KB;

/** 단일 파일 절대 한도: 초과하면 커밋 자체가 금지. */
const HARD_LIMIT = 25 * MB;

/** 디렉터리별 규칙. 먼저 매치되는 prefix가 이긴다. */
const RULES = [
  {
    prefix: "models/",
    limit: 10 * MB,
    warnOver: 5 * MB,
    formats: [".glb"],
    label: "3D 모델",
  },
  {
    prefix: "textures/",
    limit: 2 * MB,
    formats: [".webp", ".ktx2"],
    label: "텍스처",
  },
  {
    prefix: "audio/bgm/",
    limit: 3 * MB,
    formats: [".mp3", ".ogg"],
    label: "BGM",
  },
  {
    prefix: "audio/sfx/",
    limit: 500 * KB,
    formats: [".mp3", ".ogg"],
    label: "SFX",
  },
  {
    prefix: "images/",
    limit: 1 * MB,
    formats: [".webp", ".svg"],
    label: "이미지",
  },
  {
    prefix: "fonts/",
    limit: 2 * MB,
    formats: [".woff2"],
    label: "폰트",
    // 폰트는 배포처 파일명(PretendardVariable 등)을 그대로 두는 게 추적에 낫다.
    skipNameCheck: true,
  },
];

/** 규칙 표의 예외: assets.md에 명시된 것만. */
const FORMAT_EXCEPTIONS = new Set(["CREDITS.md"]);

const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*\.[a-z0-9.]+$/;

const human = (bytes) =>
  bytes >= MB ? `${(bytes / MB).toFixed(2)}MB` : `${Math.round(bytes / KB)}KB`;

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(full)));
    } else if (entry.isFile() && entry.name !== ".gitkeep") {
      files.push(full);
    }
  }
  return files;
}

const errors = [];
const warnings = [];

let files = [];
try {
  files = await walk(ASSETS);
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  console.log("public/assets 없음: 검사 건너뜀");
  process.exit(0);
}

for (const file of files) {
  const rel = path.relative(ASSETS, file).split(path.sep).join("/");
  const name = path.basename(rel);
  const ext = path.extname(rel).toLowerCase();
  const { size } = await stat(file);

  if (size > HARD_LIMIT) {
    errors.push(`${rel}: ${human(size)} (절대 한도 25MB 초과, 커밋 금지)`);
    continue;
  }

  if (FORMAT_EXCEPTIONS.has(name)) continue;

  const rule = RULES.find((r) => rel.startsWith(r.prefix));
  if (!rule) {
    warnings.push(`${rel}: 규칙이 정의된 폴더(models/textures/audio/images/fonts) 밖에 있음`);
    continue;
  }

  if (size > rule.limit) {
    errors.push(`${rel}: ${human(size)} (${rule.label} 한도 ${human(rule.limit)} 초과)`);
  } else if (rule.warnOver && size > rule.warnOver) {
    warnings.push(
      `${rel}: ${human(size)} (${rule.label} 권장 ${human(rule.warnOver)} 초과, 예외 범위)`,
    );
  }

  if (!rule.formats.includes(ext)) {
    warnings.push(`${rel}: ${rule.label} 권장 포맷 ${rule.formats.join("/")} 아님 (${ext})`);
  }

  if (!rule.skipNameCheck && !KEBAB_CASE.test(name)) {
    warnings.push(`${rel}: 파일명이 kebab-case가 아님`);
  }
}

const annotate = (kind, message) =>
  console.log(process.env.GITHUB_ACTIONS ? `::${kind}::${message}` : `[${kind}] ${message}`);

for (const warning of warnings) annotate("warning", warning);
for (const error of errors) annotate("error", error);

console.log(`\n에셋 ${files.length}개 검사: 위반 ${errors.length}건, 경고 ${warnings.length}건`);

if (errors.length > 0) {
  console.log("압축 방법은 /optimize-asset 스킬과 .claude/rules/assets.md 참고.");
  process.exit(1);
}
