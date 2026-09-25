"use client";

import dynamic from "next/dynamic";

const MonologueExitLab = dynamic(
  () => import("./MonologueExitLab").then((m) => m.MonologueExitLab),
  { ssr: false },
);

export default function MonologueExitLabPage() {
  return <MonologueExitLab />;
}
