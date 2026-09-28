import type { Metadata } from "next";
import { ASSETS } from "@/lib/assets";

export const metadata: Metadata = {
  title: "AR 테스트 그림",
  robots: { index: false, follow: false },
};

/**
 * 인쇄한 카드 대신 모니터에 띄워 두고 폰으로 비추는 그림.
 * 화면 반사가 적도록 밝기를 조금 낮추면 더 잘 잡힌다.
 */
export default function ArTargetPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-night p-4">
      {/* biome-ignore lint/performance/noImgElement: 타깃은 원본 픽셀 그대로여야 한다 (next/image 재압축 없이) */}
      <img
        src={ASSETS.ar.targetImage}
        alt="AR 인식용 도해 일러스트"
        className="max-h-[92dvh] w-auto bg-white"
      />
    </main>
  );
}
