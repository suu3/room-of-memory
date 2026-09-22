"use client";

import dynamic from "next/dynamic";

// 미니게임이 Web Audio·Canvas 2D를 쓰므로 서버에서는 렌더하지 않는다.
const RadioNoiseLab = dynamic(() => import("./RadioNoiseLab").then((m) => m.RadioNoiseLab), {
  ssr: false,
});

export default function RadioNoiseLabPage() {
  return <RadioNoiseLab />;
}
