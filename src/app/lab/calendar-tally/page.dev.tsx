"use client";

import dynamic from "next/dynamic";

const CalendarTallyLab = dynamic(
  () => import("./CalendarTallyLab").then((m) => m.CalendarTallyLab),
  { ssr: false },
);

export default function CalendarTallyLabPage() {
  return <CalendarTallyLab />;
}
