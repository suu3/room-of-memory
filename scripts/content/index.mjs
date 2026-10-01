import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { emitAll } from "./emit.mjs";
import { loadContent, loadMinigameIds, REPO_ROOT } from "./load.mjs";
import { LOCALES, SOURCES } from "./schema.mjs";
import { validateContent } from "./validate.mjs";
import { writeSource } from "./write.mjs";

export { loadContent };

/** 생성물이 놓이는 자리 (리포 루트 기준 상대 경로). */
const GENERATED_MODULE = "src/data/generated/content.ts";
const localeResource = (locale) => `src/i18n/locales/${locale}/memory-room.json`;
const localeBase = (locale) => `src/i18n/locales/${locale}/memory-room.base.json`;

/**
 * YAML을 읽어 검증하고, 통과하면 생성물 내용을 만든다. 파일은 쓰지 않는다.
 *
 * @returns {{issues: string[], content: object, output: Record<string, string>}}
 *   issues가 비어 있을 때만 output이 채워진다.
 */
export async function buildContent(content) {
  const source = content ?? (await loadContent());
  const minigameIds = await loadMinigameIds();
  const issues = validateContent(source, { minigameIds });

  if (issues.length > 0) return { issues, content: source, output: {} };

  const bases = Object.fromEntries(
    await Promise.all(
      LOCALES.map(async (locale) => [
        locale,
        JSON.parse(await readFile(path.join(REPO_ROOT, localeBase(locale)), "utf8")),
      ]),
    ),
  );

  const emitted = emitAll(source, bases);
  const output = { [GENERATED_MODULE]: emitted.module };
  for (const locale of LOCALES) output[localeResource(locale)] = emitted.locales[locale];

  return { issues, content: source, output };
}

/** 현재 리포에 있는 생성물 내용. 아직 없는 파일은 null. */
export async function readGenerated() {
  const files = [GENERATED_MODULE, ...LOCALES.map(localeResource)];
  const entries = await Promise.all(
    files.map(async (file) => [
      file,
      await readFile(path.join(REPO_ROOT, file), "utf8").catch(() => null),
    ]),
  );
  return Object.fromEntries(entries);
}

/** 생성물을 실제로 쓴다. 내용이 같은 파일은 건너뛰어 mtime을 흔들지 않는다. */
export async function writeGenerated(output) {
  const current = await readGenerated();
  const written = [];

  for (const [file, contents] of Object.entries(output)) {
    if (current[file] === contents) continue;
    const target = path.join(REPO_ROOT, file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, contents, "utf8");
    written.push(file);
  }

  return written;
}

/**
 * 어드민이 넘긴 콘텐츠를 검증하고, 통과하면 YAML과 생성물을 함께 쓴다.
 *
 * 검증에 걸리면 아무것도 쓰지 않는다. 반쯤 저장된 상태로 게임이 깨지는 것보다
 * 어드민 화면에 빨간 줄이 뜨는 편이 낫다.
 */
export async function saveContent(content) {
  const built = await buildContent(content);
  if (built.issues.length > 0) return { ok: false, issues: built.issues, written: [] };

  /*
   * YAML을 먼저 전부 만들어 보고 나서 쓴다. 한 파일이 직렬화에서 터졌을 때
   * 앞의 파일만 저장된 상태로 남지 않게.
   */
  const sources = await Promise.all(
    Object.keys(SOURCES).map((key) => writeSource(key, content[key])),
  );
  for (const { file, text } of sources) await writeFile(file, text, "utf8");

  const written = await writeGenerated(built.output);
  return {
    ok: true,
    issues: [],
    written: [...Object.values(SOURCES).map(({ file }) => `content/${file}`), ...written],
  };
}
