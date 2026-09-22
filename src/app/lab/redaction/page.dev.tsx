"use client";

import dynamic from "next/dynamic";

const RedactionLab = dynamic(() => import("./RedactionLab").then((m) => m.RedactionLab), {
  ssr: false,
});

export default function RedactionLabPage() {
  return <RedactionLab />;
}
