"use client";

import dynamic from "next/dynamic";

const PhotoParticlesLab = dynamic(
  () => import("./PhotoParticlesLab").then((module) => module.PhotoParticlesLab),
  { ssr: false },
);

export default function PhotoParticlesPage() {
  return <PhotoParticlesLab />;
}
