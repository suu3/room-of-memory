import path from "node:path";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["vitest.setup.ts"],
    // 로컬 worktree(직접 만든 것 · Claude Code가 만든 것)의 테스트를 같이 돌리지 않는다
    exclude: [...configDefaults.exclude, ".worktrees/**", ".claude/worktrees/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
