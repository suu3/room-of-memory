"use client";

import dynamic from "next/dynamic";

const SinkWaterLab = dynamic(() => import("./SinkWaterLab").then((module) => module.SinkWaterLab), {
  ssr: false,
});

export default function SinkWaterPage() {
  return <SinkWaterLab />;
}
