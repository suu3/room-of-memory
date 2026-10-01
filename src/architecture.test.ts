import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/*
 * 계층 방향 (.claude/rules/architecture.md).
 *
 * 아래 계층은 위 계층을 모른다. 숫자가 작을수록 아래다. 같은 숫자끼리는 서로 가져올 수 있다
 * (화면 계층 안의 얽힘은 아직 풀지 않았다: 규칙 문서의 "남은 것").
 */
const LAYERS: Record<string, number> = {
  types: 0,
  i18n: 1,
  data: 2,
  store: 3,
  lib: 4,
  scenes: 5,
  minigames: 5,
  components: 5,
  app: 6,
};

/** 방향을 거스르는 것을 알고도 둔 자리. 이유 없이 늘리지 않는다. */
const ALLOWED = new Set([
  // i18next의 타입 보강(d.ts)은 번역 자원의 모양을 봐야 한다
  "types/i18next.d.ts -> i18n",
  // 조사 대상의 타입이 기억 id(생성물에서 나온다)를 쓴다. 타입만 가져온다
  "types/interaction.ts -> data",
]);

const SRC = path.resolve(__dirname);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

const IMPORT = /(?:from|import\()\s*["']@\/([a-z0-9]+)[/"']/g;

describe("architecture", () => {
  it("아래 계층이 위 계층을 가져오지 않는다", () => {
    const violations: string[] = [];
    for (const file of sourceFiles(SRC)) {
      const relative = path.relative(SRC, file).split(path.sep).join("/");
      const from = relative.split("/")[0];
      if (!(from in LAYERS)) continue;
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(IMPORT)) {
        const to = match[1];
        if (!(to in LAYERS) || LAYERS[to] <= LAYERS[from]) continue;
        const key = `${relative} -> ${to}`;
        if (!ALLOWED.has(key)) violations.push(key);
      }
    }
    expect([...new Set(violations)]).toEqual([]);
  });

  it.each(["components/ui", "scenes/memory-room", "scenes/memory-room/rooms"])(
    "%s 바로 아래에는 파일을 두지 않는다 (기능별 폴더에 넣는다)",
    (folder) => {
      const dir = path.join(SRC, folder);
      const loose = readdirSync(dir).filter((name) => statSync(path.join(dir, name)).isFile());
      expect(loose).toEqual([]);
    },
  );
});
