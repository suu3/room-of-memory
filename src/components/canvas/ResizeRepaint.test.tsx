/** @vitest-environment jsdom */

import { type RootState, useFrame, useStore } from "@react-three/fiber";
import ReactThreeTestRenderer from "@react-three/test-renderer";
import { useEffect } from "react";
import { describe, expect, it } from "vitest";
import { ResizeRepaint } from "./ResizeRepaint";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface Probe {
  frames: number;
  state: (() => RootState) | null;
  setState: ((partial: Partial<RootState>) => void) | null;
}

/** 프레임 수를 세고, 테스트가 r3f 스토어를 만질 수 있게 내준다. */
function FrameProbe({ probe }: { probe: Probe }) {
  const store = useStore();
  useEffect(() => {
    probe.state = store.getState;
    probe.setState = store.setState;
  }, [store, probe]);
  useFrame(() => {
    probe.frames += 1;
  });
  return null;
}

async function mount() {
  const probe: Probe = { frames: 0, state: null, setState: null };
  const renderer = await ReactThreeTestRenderer.create(
    <>
      <ResizeRepaint />
      <FrameProbe probe={probe} />
    </>,
  );
  await ReactThreeTestRenderer.act(async () => {
    // 테스트 렌더러의 기본은 never다. 게임 캔버스처럼 늘 그리는 상태로 둔다
    probe.setState?.({ frameloop: "always" });
    await renderer.advanceFrames(1, 0.016);
  });
  return { renderer, probe };
}

describe("ResizeRepaint", () => {
  it("캔버스 크기가 바뀌면 다음 프레임을 기다리지 않고 곧장 한 장을 그린다", async () => {
    const { renderer, probe } = await mount();
    const before = probe.frames;

    await ReactThreeTestRenderer.act(async () => {
      const state = probe.state?.();
      // 지금 값과 다르기만 하면 된다. 절대값을 박으면 다른 파일이 남긴 환경에 따라 같아질 수 있다
      if (state) state.setSize(state.size.width + 10, state.size.height + 10);
    });

    expect(probe.frames).toBe(before + 1);
    await renderer.unmount();
  });

  it("배율이 바뀌어도 같다", async () => {
    const { renderer, probe } = await mount();
    const before = probe.frames;

    await ReactThreeTestRenderer.act(async () => {
      const state = probe.state?.();
      if (state) state.setDpr(state.viewport.dpr + 1);
    });

    expect(probe.frames).toBe(before + 1);
    await renderer.unmount();
  });

  it("크기가 그대로면 그리지 않고, 그리지 않는 구간(frameloop never)에도 그리지 않는다", async () => {
    const { renderer, probe } = await mount();
    const before = probe.frames;

    await ReactThreeTestRenderer.act(async () => {
      const state = probe.state?.();
      if (state) state.setSize(state.size.width, state.size.height);
    });
    expect(probe.frames).toBe(before);

    await ReactThreeTestRenderer.act(async () => {
      probe.setState?.({ frameloop: "never" });
      const state = probe.state?.();
      if (state) state.setSize(state.size.width + 20, state.size.height + 20);
    });
    expect(probe.frames).toBe(before);

    await renderer.unmount();
  });
});
