"use client";

import { createPortal, type ThreeElements, useThree } from "@react-three/fiber";
import { type Ref, useEffect, useRef, useState } from "react";
import { type Object3D, PointLight } from "three";

/*
 * 광원 개수는 셰이더에 박힌다. 보이는 point light가 하나 늘거나 줄면 화면의 모든 재질이
 * 새 프로그램으로 한꺼번에 재컴파일된다. 공간 그룹(방·거실…)은 visible로 숨기는데, 그 안에
 * 광원이 있으면 문턱을 넘을 때마다 광원 수가 바뀌어 한참 멈췄다 (거실 진입 버벅임).
 *
 * 그래서 공간에 딸린 광원은 제자리 대신 씬 루트에 세운다(포털). 제자리에는 자리표(앵커)만
 * 남고, 렌더 직전에 광원이 앵커의 월드 위치로 옮겨 간다. 앵커의 조상 중 하나라도 숨어 있으면
 * 그 렌더 동안만 세기를 0으로 누른다: 빛은 사라지되 개수는 그대로다.
 */

type Entry = { anchor: Object3D; light: PointLight; saved: number; muted: boolean };

const entries = new Set<Entry>();

function hiddenInTree(object: Object3D) {
  for (let node: Object3D | null = object; node; node = node.parent) {
    if (!node.visible) return true;
  }
  return false;
}

/**
 * 씬 하나에 한 번 건다. 렌더마다(컴포저의 패스마다) 앞뒤로 불려, 숨은 공간의 광원을 끄고
 * 다시 켠다. 각 컴포넌트의 useFrame이 세기를 읽고 밀 때는 늘 원래 값이 보인다.
 */
export function SpaceLightGate() {
  const scene = useThree((state) => state.scene);
  useEffect(() => {
    const before = scene.onBeforeRender;
    const after = scene.onAfterRender;
    scene.onBeforeRender = (...args) => {
      before.apply(scene, args);
      for (const entry of entries) {
        entry.anchor.updateWorldMatrix(true, false);
        entry.light.position.setFromMatrixPosition(entry.anchor.matrixWorld);
        entry.muted = hiddenInTree(entry.anchor);
        if (!entry.muted) continue;
        entry.saved = entry.light.intensity;
        entry.light.intensity = 0;
      }
    };
    scene.onAfterRender = (...args) => {
      for (const entry of entries) {
        if (entry.muted) entry.light.intensity = entry.saved;
        entry.muted = false;
      }
      after.apply(scene, args);
    };
    return () => {
      scene.onBeforeRender = before;
      scene.onAfterRender = after;
    };
  }, [scene]);
  return null;
}

type SpaceLightProps = Omit<ThreeElements["pointLight"], "ref"> & { ref?: Ref<PointLight> };

/**
 * 공간 그룹 안에 두는 point light. 쓰는 법은 `<pointLight>`와 같다 (ref도 진짜 광원을
 * 가리킨다). position은 제자리 기준이고, 숨은 공간에서는 빛만 꺼진다. SpaceLightGate가
 * 씬에 걸려 있어야 한다.
 */
export function SpaceLight({ position, ref, ...props }: SpaceLightProps) {
  const scene = useThree((state) => state.scene);
  const anchorRef = useRef<Object3D>(null);
  const [light] = useState(() => new PointLight());

  useEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const entry: Entry = { anchor, light, saved: 0, muted: false };
    entries.add(entry);
    return () => {
      entries.delete(entry);
      light.dispose();
    };
  }, [light]);

  return (
    <>
      <object3D ref={anchorRef} position={position} />
      {createPortal(<primitive object={light} ref={ref} {...props} />, scene)}
    </>
  );
}
