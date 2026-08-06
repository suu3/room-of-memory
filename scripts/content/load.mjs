import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { parse } from "yaml";
import { SOURCES } from "./schema.mjs";

/**
 * 리포 루트.
 *
 * `node scripts/build-content.mjs`로 돌 때는 이 파일의 위치에서 두 칸 올라가면
 * 되지만, dev 어드민에서는 Next가 이 모듈을 번들로 말아버려 import.meta.dirname이
 * 사라진다. 그때는 cwd에서 content/를 찾아 올라간다.
 */
function findRepoRoot() {
  const here = import.meta.dirname;
  if (here) return path.resolve(here, "..", "..");

  let directory = process.cwd();
  while (!existsSync(path.join(directory, "content", SOURCES.memories.file))) {
    const parent = path.dirname(directory);
    if (parent === directory) return process.cwd();
    directory = parent;
  }
  return directory;
}

export const REPO_ROOT = findRepoRoot();
export const CONTENT_DIR = path.join(REPO_ROOT, "content");

/** 저작 파일 하나의 절대 경로. */
export function sourcePath(key) {
  return path.join(CONTENT_DIR, SOURCES[key].file);
}

/**
 * content/*.yaml 네 개를 읽어 하나의 콘텐츠 객체로 만든다.
 *
 * 파싱 단계에서는 형태만 본다 — 참조가 맞는지(스크립트가 실재하는지 등)는
 * validate.mjs가 따로 본다. 파일 하나가 깨져도 어느 파일인지 말해준다.
 */
export async function loadContent() {
  const content = {};

  for (const [key, { file, root }] of Object.entries(SOURCES)) {
    const raw = await readFile(sourcePath(key), "utf8");

    let parsed;
    try {
      parsed = parse(raw);
    } catch (error) {
      throw new Error(`content/${file} 파싱 실패: ${error.message}`);
    }

    const value = parsed?.[root];
    if (value === undefined || value === null) {
      throw new Error(`content/${file}에 최상위 키 "${root}"가 없다.`);
    }
    content[key] = value;
  }

  return content;
}

/** 미니게임 레지스트리(src/minigames/index.ts)에 등록된 id들. */
export async function loadMinigameIds() {
  const source = await readFile(path.join(REPO_ROOT, "src", "minigames", "index.ts"), "utf8");
  const body = source.slice(source.indexOf("MINIGAMES: Record<string, MinigameDefinition> = {"));
  return [...body.matchAll(/^ {2}"([^"]+)":\s*\{$/gm)].map((match) => match[1]);
}
