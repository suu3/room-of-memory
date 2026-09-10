"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { RisingDust } from "@/components/ui/RisingDust";
import { BUTTON_QUIET } from "@/components/ui/ui-classes";

/**
 * 없는 주소: "길을 잘못 들었어요". 타이틀 화면과 같은 문법이다: 어두운 바탕, 떠오르는 먼지, 픽셀 서체 제목
 * 아래 조용한 한 줄. 방(3D)은 띄우지 않는다: 여기는 방이 없는 곳이라는 게 이 화면의
 * 말이고, 캔버스를 세우면 돌아가는 길보다 그 자리가 무거워진다.
 */
export default function NotFound() {
  const { t } = useTranslation();

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-night px-6 py-16">
      {/* 타이틀·부팅 커튼과 같은 공기: 빈 화면도 이 게임 안이어야 한다 */}
      <RisingDust count={18} />
      <div className="relative flex max-w-md flex-col items-center gap-3 text-center">
        <p className="font-pixel text-sm tracking-[0.45em] text-memory/80">404</p>
        <h1 className="title-logo break-ko font-pixel text-4xl leading-tight text-ivory md:text-5xl">
          {t("notFound.title")}
        </h1>
        <p className="mt-1 break-ko text-pretty text-sm leading-normal text-fog">
          {t("notFound.body")}
        </p>
        <Link href="/" className={`${BUTTON_QUIET} mt-6`}>
          {t("contact.back")}
        </Link>
      </div>
    </main>
  );
}
