/**
 * 로컬 전용 어드민 — 대본과 흐름을 폼으로 고친다.
 *
 * `page.dev.tsx`라는 이름이 배포를 막는다: next.config.ts가 dev에서만 `dev.tsx`를
 * 라우트 확장자로 치기 때문에, 프로덕션 빌드에는 이 라우트가 아예 만들어지지
 * 않는다 (`pnpm build` 후 라우트 목록에 /admin이 없는 것으로 확인 가능).
 *
 * 열려면 `pnpm dev` 후 http://localhost:3000/admin.
 */
import type { Metadata } from "next";
import { ContentAdmin } from "./ContentAdmin";

export const metadata: Metadata = {
  title: "대본 · 흐름 편집기",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return (
    <main className="min-h-dvh bg-night text-paper">
      <ContentAdmin />
    </main>
  );
}
