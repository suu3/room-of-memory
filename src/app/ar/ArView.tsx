"use client";

import dynamic from "next/dynamic";

/** 카메라와 WebGL은 브라우저에서만 돈다. */
export const ArView = dynamic(() => import("./ArExperience").then((m) => m.ArExperience), {
  ssr: false,
});
