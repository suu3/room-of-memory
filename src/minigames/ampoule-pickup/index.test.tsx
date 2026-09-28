/** @vitest-environment jsdom */

import ReactThreeTestRenderer from "@react-three/test-renderer";
import { act } from "react";
import type { Group } from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MinigameResult } from "@/types/minigame";
import { AmpoulePickupMinigame } from "./index";
import { DRAWER_OPEN_DURATION, DRAWER_TRAVEL, LIFT_DURATION } from "./motion";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// 이 스위트는 집기 입력·모션 계약을 검사한다. GLB 디코딩 계약은 ampoule-model.test.ts가
// 실제 파일로 따로 검사하므로, 상대 URL을 읽지 못하는 jsdom에서는 시각 모델만 경계에서 뺀다.
vi.mock("@/scenes/memory-room/Ampoule", () => ({
  Ampoule: () => <group name="ampoule" />,
}));

/** 이벤트 객체 흉내: 핸들러가 부르는 stopPropagation만 있으면 된다. */
const click = { stopPropagation: () => undefined };

async function renderPickup(stage: "play" | "result" = "play") {
  const results: MinigameResult[] = [];
  const settled = vi.fn();
  const renderer = await ReactThreeTestRenderer.create(
    <AmpoulePickupMinigame
      onComplete={(result) => results.push(result)}
      onSettled={settled}
      stage={stage}
    />,
  );
  return { renderer, results, settled };
}

/** 서랍이 다 열릴 때까지 기다린다 (setTimeout 기반). */
async function waitDrawerOpen() {
  await act(async () => {
    vi.advanceTimersByTime(DRAWER_OPEN_DURATION * 1000 + 10);
  });
}

async function waitLift() {
  await act(async () => {
    vi.advanceTimersByTime(LIFT_DURATION * 1000 + 10);
  });
}

describe("AmpoulePickupMinigame", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("서랍이 다 열리기 전에는 집히지 않는다", async () => {
    const { renderer, results } = await renderPickup();

    // 판정 구가 아직 없다: 누를 수 있는 것이 없다
    expect(renderer.scene.findAll((node) => node.props.name === "mg-ampoule-pickup-hit")).toEqual(
      [],
    );
    const ampoule = renderer.scene.find((node) => node.props.name === "ampoule");
    await renderer.fireEvent(ampoule.parent as never, "click", click);
    await waitLift();
    expect(results).toEqual([]);
    await renderer.unmount();
  });

  it("열린 서랍의 앰플을 누르면 들어 올린 뒤 한 번만 끝난다", async () => {
    const { renderer, results, settled } = await renderPickup();
    await waitDrawerOpen();

    const hit = renderer.scene.find((node) => node.props.name === "mg-ampoule-pickup-hit");
    await renderer.fireEvent(hit, "click", click);
    // 손에 닿는 순간 결과는 정해진다 (호스트가 닫기를 막는다)
    expect(settled).toHaveBeenCalledTimes(1);
    // 아직 오르는 중: 판은 끝나지 않았다
    expect(results).toEqual([]);

    await waitLift();
    expect(results).toEqual([{ cleared: true, celebrated: true }]);

    // 다시 눌러도 두 번 끝나지 않는다
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    await waitLift();
    expect(results).toHaveLength(1);
    await renderer.unmount();
  });

  it("키로는 집지 않는다: 클릭·탭으로만", async () => {
    const { renderer, results, settled } = await renderPickup();
    await waitDrawerOpen();

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
      window.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));
    });
    await waitLift();
    expect(settled).not.toHaveBeenCalled();
    expect(results).toEqual([]);
    await renderer.unmount();
  });

  it("서랍은 프레임을 따라 밀려 나오고, 앰플은 서랍 안에서 함께 나온다", async () => {
    const { renderer } = await renderPickup();
    await renderer.advanceFrames(20, 0.1);

    const drawer = renderer.scene.find((node) => node.props.name === "fridge-drawer");
    expect((drawer.instance as Group).position.z).toBeCloseTo(DRAWER_TRAVEL);
    const carrier = renderer.scene.find((node) => node.props.name === "mg-ampoule-pickup-ampoule")
      .instance as Group;
    // 서랍 안에 누운 자리: 열린 만큼 앞으로 와 있다
    expect(carrier.position.z).toBeGreaterThan(0);
    expect(carrier.rotation.z).toBeCloseTo(Math.PI / 2);
    await renderer.unmount();
  });

  it("결과 대사 단계에서는 더 집을 것이 없다", async () => {
    const { renderer, results } = await renderPickup("result");
    await waitDrawerOpen();

    expect(renderer.scene.findAll((node) => node.props.name === "mg-ampoule-pickup-hit")).toEqual(
      [],
    );
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    await waitLift();
    expect(results).toEqual([]);
    await renderer.unmount();
  });
});
