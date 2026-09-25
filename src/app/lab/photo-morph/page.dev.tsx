"use client";

import dynamic from "next/dynamic";

// 밀림이 Canvas 2D를 쓰므로 서버에서는 렌더하지 않는다 (다른 lab 페이지와 같은 방식).
const PhotoMorphLab = dynamic(
  () => import("./PhotoMorphLab").then((module) => module.PhotoMorphLab),
  { ssr: false },
);

export default function PhotoMorphPage() {
  return <PhotoMorphLab />;
}
