"use client";

import dynamic from "next/dynamic";

const BallRippleLab = dynamic(
  () => import("./BallRippleLab").then((module) => module.BallRippleLab),
  { ssr: false },
);

export default function BallRipplePage() {
  return <BallRippleLab />;
}
