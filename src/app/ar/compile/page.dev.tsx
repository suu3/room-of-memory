"use client";

import { useState } from "react";
import { loadMindar } from "../mindar";

/*
 * 포토카드 그림 → MindAR 타깃(.mind) 굽기. dev 서버에서만 열린다.
 *
 * 저장 버튼이 public/assets/ar/ar-target-hero.mind를 덮는다. 그다음 ASSETS.ar의 v를 올린다.
 * 특징점 수도 같이 보여 준다: 적으면(수십 개) 인쇄해도 잘 안 잡히니 그림부터 손본다.
 */

/**
 * 가장자리에서 덜어 내는 비율 (각 변). 인쇄소 재단은 1~2mm씩 밀린다: 55mm 카드에서 2mm면 3.6%.
 * 잘려 나갈 수 있는 띠를 타깃에서 빼 두면 어느 쪽으로 밀려도 인식할 그림이 다 남는다.
 * 네 변을 똑같이 덜므로 카드 한가운데는 그대로다.
 */
const CUT_MARGIN = 0.036;

/** 원본 그대로 구우면 피라미드가 커져 느리고 .mind도 무거워진다. 인식 품질은 이 정도면 충분하다. */
const MAX_SIDE = 1000;

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

export default function ArCompilePage() {
  const [status, setStatus] = useState("그림을 고르면 바로 굽는다.");
  const [download, setDownload] = useState<Blob | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  async function compile(file: File) {
    setDownload(null);
    setSaved(null);
    setStatus("MindAR 불러오는 중…");
    const { Compiler } = await loadMindar();
    const original = await loadImage(URL.createObjectURL(file));
    const cropX = Math.round(original.naturalWidth * CUT_MARGIN);
    const cropY = Math.round(original.naturalWidth * CUT_MARGIN);
    const cropWidth = original.naturalWidth - cropX * 2;
    const cropHeight = original.naturalHeight - cropY * 2;
    const ratio = Math.min(1, MAX_SIDE / Math.max(cropWidth, cropHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(cropWidth * ratio);
    canvas.height = Math.round(cropHeight * ratio);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("캔버스를 열 수 없다");
    // 투명한 곳은 굽는 쪽이 검정(0)으로 읽는다. 인쇄하면 흰 종이이므로 흰 바탕을 먼저 깐다.
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(
      original,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    const image = await loadImage(canvas.toDataURL("image/png"));
    const compiler = new Compiler();
    const targets = (await compiler.compileImageTargets([image], (percent) =>
      setStatus(`굽는 중 ${percent.toFixed(0)}%`),
    )) as {
      trackingData: { points: unknown[] }[];
      matchingData: { maximaPoints: unknown[]; minimaPoints: unknown[] }[];
    }[];
    const tracking = targets[0].trackingData.reduce((sum, level) => sum + level.points.length, 0);
    const matching = targets[0].matchingData.reduce(
      (sum, level) => sum + level.maximaPoints.length + level.minimaPoints.length,
      0,
    );
    const blob = new Blob([compiler.exportData() as BlobPart]);
    setDownload(blob);
    setStatus(
      `완료: ${image.naturalWidth}×${image.naturalHeight} · 추적 특징점 ${tracking} · 인식 특징점 ${matching}`,
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-4 bg-night p-6 text-ivory">
      <h1 className="text-xl font-semibold">AR 타깃 굽기</h1>
      <input
        type="file"
        accept="image/*"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) compile(file).catch((error: unknown) => setStatus(`실패: ${String(error)}`));
        }}
      />
      <p className="text-sm text-fog" data-testid="compile-status">
        {status}
      </p>
      {download && (
        <button
          type="button"
          className="self-start text-memory underline"
          onClick={async () => {
            const response = await fetch("/ar/compile/save", { method: "POST", body: download });
            const result = (await response.json()) as { path?: string; error?: string };
            setSaved(
              result.path
                ? `${result.path}에 저장했다. ASSETS.ar.target의 v를 올릴 것.`
                : `실패: ${result.error}`,
            );
          }}
        >
          리포에 저장 (public/assets/ar/ar-target-hero.mind)
        </button>
      )}
      {saved && <p className="text-sm text-fog">{saved}</p>}
    </main>
  );
}
