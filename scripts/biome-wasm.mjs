/*
 * 스테이징된 파일을 Biome로 검사한다. 단, CLI가 아니라 WASM 빌드로.
 *
 * `biome.exe`는 서명이 없어서 Windows Smart App Control이 실행 자체를 막는다
 * ("An Application Control policy has blocked this file"). SAC는 예외 목록이
 * 없고 한 번 끄면 Windows 재설치 전까지 다시 못 켜므로, 보안 설정을 건드리는
 * 대신 실행 파일을 안 쓰는 경로로 우회한다. @biomejs/wasm-nodejs는 node 안에서
 * 도는 WASM이라 SAC가 볼 exe가 없다.
 *
 * WASM 판은 CLI와 같은 2.5.2로 못박아 두었다 (package.json). 버전이 어긋나면
 * 훅과 `pnpm lint`가 서로 다른 판정을 내리므로 같이 올릴 것.
 *
 * CLI의 `biome check --staged`와 다른 점:
 * - WASM 워크스페이스에는 파일 시스템이 없다. biome.json을 직접 읽어
 *   applyConfiguration으로 넘기고, 제외 규칙도 여기서 적용한다.
 * - 그래서 files.includes의 부정 패턴은 "경로 접두사 또는 정확한 경로"까지만
 *   해석한다. 지금 설정(!node_modules, !.next, !public, !src/app/globals.css)은
 *   전부 이 형태다. 더 복잡한 glob을 쓰기 시작하면 여기도 같이 고쳐야 한다.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Biome } from "@biomejs/js-api/nodejs";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");
const CONFIG_PATH = path.join(REPO_ROOT, "biome.json");

/** Biome 2.x가 파싱하는 확장자 가운데 이 리포에 실제로 있는 것들. */
const CHECKED_EXTENSIONS = new Set([
  ".cjs",
  ".css",
  ".js",
  ".json",
  ".jsonc",
  ".jsx",
  ".mjs",
  ".ts",
  ".tsx",
]);

function git(args) {
  return execFileSync("git", args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

/*
 * 기본은 스테이징된 것만(훅), `--all`이면 git이 아는 파일 전부(`pnpm lint:wasm`).
 * 스테이징 모드에서는 워킹 트리가 아니라 **스테이징된 내용**을 읽는다. 커밋되는
 * 것이 그것이고, CLI의 `biome check --staged`도 그렇게 본다.
 */
const CHECK_ALL = process.argv.includes("--all");
/** `biome check --write`에 해당. 안전한 수정만 적용한다. 훅에서는 쓰지 않는다. */
const WRITE = process.argv.includes("--write");

function listFiles() {
  const output = CHECK_ALL
    ? git(["ls-files"])
    : git(["diff", "--cached", "--name-only", "--diff-filter=ACMR"]);
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function contentOf(file) {
  return CHECK_ALL ? readFileSync(path.join(REPO_ROOT, file), "utf8") : git(["show", `:${file}`]);
}

/*
 * Biome의 도메인(react/next/test)은 CLI가 package.json 의존성을 보고 알아서 켠다.
 * WASM 워크스페이스에는 파일 시스템이 없어 그 감지가 통째로 빠지고, 그러면
 * useExhaustiveDependencies·noArrayIndexKey 같은 react 도메인 규칙이 조용히 안
 * 돈다. 규칙이 안 도니 그 규칙을 향한 biome-ignore가 전부 "쓸모없는 억제"로
 * 잘못 잡히기까지 한다. 그래서 감지를 여기서 대신 해 준다.
 */
const DOMAIN_BY_DEPENDENCY = { next: "next", react: "react", vitest: "test" };

function detectDomains() {
  const manifest = JSON.parse(readFileSync(path.join(REPO_ROOT, "package.json"), "utf8"));
  const installed = new Set([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.devDependencies ?? {}),
  ]);
  const domains = {};
  for (const [dependency, domain] of Object.entries(DOMAIN_BY_DEPENDENCY)) {
    if (installed.has(dependency)) domains[domain] = "recommended";
  }
  return domains;
}

function loadConfiguration() {
  const raw = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
  // $schema는 편집기용 힌트라 워크스페이스가 모르는 키다. vcs는 파일 시스템을
  // 전제하므로 WASM 워크스페이스에서는 뺀다. 제외는 아래에서 직접 처리한다.
  const { $schema, vcs, ...configuration } = raw;
  const excludes = (configuration.files?.includes ?? [])
    .filter((pattern) => pattern.startsWith("!"))
    .map((pattern) => pattern.slice(1));
  return {
    configuration: {
      ...configuration,
      linter: { ...configuration.linter, domains: detectDomains() },
    },
    excludes,
  };
}

function isExcluded(file, excludes) {
  return excludes.some((exclude) => file === exclude || file.startsWith(`${exclude}/`));
}

const { configuration, excludes } = loadConfiguration();
const files = listFiles().filter(
  (file) => CHECKED_EXTENSIONS.has(path.extname(file)) && !isExcluded(file, excludes),
);

if (files.length === 0) {
  process.exit(0);
}

/*
 * 진단을 한 줄로 찍는다. js-api의 printDiagnostics는 이름과 달리 HTML을 뱉어서
 * 터미널에서는 태그만 쏟아진다. 훅이 읽히려면 파일:줄:칸과 규칙 이름이면 된다.
 */
function formatDiagnostic(file, source, diagnostic) {
  const [start] = diagnostic.location?.span ?? [];
  let where = file;
  if (typeof start === "number") {
    const before = source.slice(0, start);
    const line = before.split("\n").length;
    const column = start - before.lastIndexOf("\n");
    where = `${file}:${line}:${column}`;
  }
  const rule = diagnostic.category ? ` ${diagnostic.category}` : "";
  return `  ${diagnostic.severity}: ${where}${rule}\n    ${diagnostic.description}\n`;
}

const biome = new Biome();
const { projectKey } = biome.openProject(REPO_ROOT);
biome.applyConfiguration(projectKey, configuration);

let failed = false;
let fixedCount = 0;

for (const file of files) {
  const source = contentOf(file);

  if (WRITE) {
    // 안전한 lint 수정 → 포맷 순서. 반대로 하면 수정이 포맷을 다시 깨뜨린다.
    const fixed = biome.lintContent(projectKey, source, {
      filePath: file,
      fixFileMode: "safeFixes",
    });
    const written = biome.formatContent(projectKey, fixed.content, { filePath: file }).content;
    if (written !== source) {
      writeFileSync(path.join(REPO_ROOT, file), written);
      process.stderr.write(`  고침: ${file}\n`);
      fixedCount += 1;
    }
    continue;
  }

  const { diagnostics } = biome.lintContent(projectKey, source, { filePath: file });
  const blocking = diagnostics.filter(
    (diagnostic) => diagnostic.severity === "error" || diagnostic.severity === "fatal",
  );
  // hint·information은 CLI의 `check`도 기본으로 안 찍는다. 여기선 특히 WASM 판이
  // 자기 버전을 0.0.0으로 보고해 biome.json의 $schema를 걸고 넘어지는 잡음이 섞인다.
  for (const diagnostic of diagnostics) {
    if (diagnostic.severity === "hint" || diagnostic.severity === "information") continue;
    process.stderr.write(formatDiagnostic(file, source, diagnostic));
  }
  if (blocking.length > 0) failed = true;

  const formatted = biome.formatContent(projectKey, source, { filePath: file });
  if (formatted.content !== source) {
    const fix = CHECK_ALL
      ? "`pnpm lint:fix`(exe가 막혔으면 `pnpm lint:fix:wasm`)로 고치세요."
      : "`pnpm lint:fix:wasm` 후 다시 스테이징하세요.";
    process.stderr.write(`  error: ${file} 포맷이 어긋나 있습니다. ${fix}\n`);
    failed = true;
  }
}

biome.shutdown();

if (WRITE) {
  process.stderr.write(
    `✔ Biome(WASM) 수정: ${fixedCount}개 고침 / 검사한 파일 ${files.length}개.\n`,
  );
  process.exit(0);
}

if (failed) {
  process.stderr.write(`\n✖ Biome(WASM) 검사에서 막혔습니다. 검사한 파일 ${files.length}개.\n`);
  process.exit(1);
}

process.stderr.write(`✔ Biome(WASM) 통과: 검사한 파일 ${files.length}개.\n`);
