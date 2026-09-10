import { readFileSync } from "node:fs";
import path from "node:path";
import { Biome } from "@biomejs/js-api/nodejs";
import { REPO_ROOT } from "./load.mjs";

/**
 * 생성한 TypeScript를 리포의 Biome 설정대로 포맷한다.
 *
 * 생성물도 `pnpm lint`가 검사하는 파일이라, 생성기가 뱉은 그대로 두면 커밋할
 * 때마다 포맷이 어긋난다고 막힌다. CLI 대신 WASM 판을 쓰는 이유는
 * scripts/biome-wasm.mjs 주석 참고 (서명 없는 exe가 막히는 환경이 있다).
 */
let workspace;

function biomeWorkspace() {
  if (workspace) return workspace;

  const raw = JSON.parse(readFileSync(path.join(REPO_ROOT, "biome.json"), "utf8"));
  // $schema는 편집기용 힌트, vcs는 파일 시스템 전제: WASM 워크스페이스는 둘 다 모른다
  const { $schema: _schema, vcs: _vcs, ...configuration } = raw;

  const biome = new Biome();
  const { projectKey } = biome.openProject(REPO_ROOT);
  biome.applyConfiguration(projectKey, configuration);

  workspace = { biome, projectKey };
  return workspace;
}

export function formatSource(filePath, source) {
  const { biome, projectKey } = biomeWorkspace();
  return biome.formatContent(projectKey, source, { filePath }).content;
}
