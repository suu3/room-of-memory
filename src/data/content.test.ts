import { describe, expect, it } from "vitest";
import { buildContent, readGenerated } from "../../scripts/content/index.mjs";

/**
 * 생성물은 리포에 커밋돼 있다 (프로덕션 빌드가 YAML을 몰라도 되게). 그래서
 * content/*.yaml만 고치고 `pnpm content:build`를 잊으면 게임은 예전 대본으로
 * 돈다. 조용히 어긋나는 그 상태를 여기서 막는다.
 */
describe("콘텐츠 생성물", () => {
  it("content/*.yaml이 검증을 통과한다", async () => {
    const built = await buildContent();

    expect(built.issues).toEqual([]);
  });

  it("커밋된 생성물이 content/*.yaml과 일치한다. 어긋나면 pnpm content:build", async () => {
    const built = await buildContent();
    const current = await readGenerated();

    const stale = Object.keys(built.output).filter((file) => current[file] !== built.output[file]);

    expect(stale).toEqual([]);
  });
});
