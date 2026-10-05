/**
 * 로컬 전용: 3D 인스펙트 물건의 다시보기 스틸을 찍어 `public/assets/images/`에 쓴다.
 *
 * 쪽지·출입증·앰플·문제집은 그린 그림이 없고 글자가 언어마다 달라, 찾을 것을 본 자세로
 * 판을 세워 언어별로 한 장씩 찍어 둔다. 물건의 그림이나 문구를 고쳤으면 `pnpm dev` 후
 * http://localhost:3000/admin/stills 에서 다시 찍고 `pnpm images:blur`를 돌린다.
 * `page.dev.tsx`라 프로덕션 빌드에는 라우트가 없다 (../page.dev.tsx 머리말 참고).
 */
import type { Metadata } from "next";
import "../admin-theme.css";
import { StillCapture } from "./StillCapture";

export const metadata: Metadata = {
  title: "스틸 찍기",
  robots: { index: false, follow: false },
};

export default function StillCapturePage() {
  return (
    <main className="admin-theme min-h-dvh bg-[var(--admin-canvas)] p-6 text-[var(--admin-ink)]">
      <StillCapture />
    </main>
  );
}
