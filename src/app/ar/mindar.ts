/*
 * MindAR(이미지 타깃 인식) 로더.
 *
 * npm의 mind-ar는 오프라인 컴파일러용 네이티브 `canvas`까지 끌고 와서 설치부터 깨진다.
 * 그래서 브라우저용 배포 번들(tfjs·워커 내장, 외부 import 없음)만 public/vendor에 두고
 * 런타임에 import 한다. 번들러가 2MB짜리를 다시 싸지 않게 turbopackIgnore로 비껴 간다.
 * 렌더링은 우리 r3f 캔버스가 하고, MindAR에서는 Controller(인식)와 Compiler(타깃 굽기)만 쓴다.
 */

const MINDAR_URL = "/vendor/mindar-1.2.5/mindar-image.prod.js";

type MindarUpdate =
  | { type: "updateMatrix"; targetIndex: number; worldMatrix: number[] | null }
  | { type: "processDone" };

export interface MindarController {
  inputWidth: number;
  inputHeight: number;
  addImageTargets(url: string): Promise<{ dimensions: [number, number][] }>;
  dummyRun(input: HTMLVideoElement): void | Promise<void>;
  processVideo(input: HTMLVideoElement): void;
  stopProcessVideo(): void;
  getProjectionMatrix(): number[];
  dispose(): void;
}

interface MindarControllerOptions {
  inputWidth: number;
  inputHeight: number;
  maxTrack?: number;
  filterMinCF?: number;
  filterBeta?: number;
  warmupTolerance?: number;
  missTolerance?: number;
  onUpdate: (data: MindarUpdate) => void;
}

interface MindarCompiler {
  compileImageTargets(
    images: HTMLImageElement[],
    onProgress: (percent: number) => void,
  ): Promise<unknown>;
  exportData(): Uint8Array;
}

interface MindarModule {
  Controller: new (options: MindarControllerOptions) => MindarController;
  Compiler: new () => MindarCompiler;
}

let loading: Promise<MindarModule> | null = null;

export function loadMindar(): Promise<MindarModule> {
  loading ??= import(/* turbopackIgnore: true */ /* webpackIgnore: true */ MINDAR_URL).catch(
    (error: unknown) => {
      loading = null;
      throw error;
    },
  ) as Promise<MindarModule>;
  return loading;
}
