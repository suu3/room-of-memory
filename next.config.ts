import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  /**
   * `*.dev.tsx` / `*.dev.ts`는 dev 서버에서만 라우트로 친다.
   *
   * 로컬 어드민(/admin)을 실서비스에 내보내지 않기 위한 것이다. 환경변수로 404를
   * 내는 것과 달리 프로덕션 빌드에는 라우트 자체가 만들어지지 않는다 —
   * `pnpm build`의 라우트 목록에 /admin이 없는 것으로 확인할 수 있다.
   */
  pageExtensions: isDev ? ["dev.tsx", "dev.ts", "tsx", "ts"] : ["tsx", "ts"],

  /**
   * 어드민이 콘텐츠 파이프라인을 서버에서 그대로 import 한다. Biome WASM은 번들에
   * 들어가면 옆에 놓인 .wasm 파일을 못 찾으므로 번들 밖에 둔다.
   */
  serverExternalPackages: ["@biomejs/js-api", "@biomejs/wasm-nodejs"],
};

export default nextConfig;
