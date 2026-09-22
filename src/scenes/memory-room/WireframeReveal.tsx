"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import type { Material, Mesh } from "three";
import { setScreenTransitionSettle } from "@/lib/effects/screen-transition-input";
import { selectRadioSignaling, useMemoryRoomStore } from "@/store/memory-room";
import { reconstructionAt } from "./reconstruction";
import type { SpaceId } from "./spaces";

/** 와이어프레임 플래그를 가진 재질만. 셰이더 재질(창빛·먼지·거울)은 결이 다른 층이라 건너뛴다. */
const WIREFRAME_TYPES = new Set([
  "MeshStandardMaterial",
  "MeshPhysicalMaterial",
  "MeshBasicMaterial",
]);

type WireframeMaterial = Material & { wireframe: boolean };

function isWireframeMaterial(material: Material): material is WireframeMaterial {
  return WIREFRAME_TYPES.has(material.type) && "wireframe" in material;
}

/** 처음 들어서는 순간 재구성이 도는 공간. 방·거실은 문 넘기 연출이 따로 있다. */
const REVEAL_SPACES: readonly SpaceId[] = ["bathroom", "parents"];

/**
 * 재구성 전환 (docs/visual-experiments.md 7장·11장). 방의 모든 면이 잠깐 선으로 풀렸다가
 * 다시 채워진다. 시간표는 reconstruction.ts.
 *
 * 두 사건을 듣는다: 라디오가 저 혼자 깨어나는 순간(전환 컷씬에서 3D로 돌아온 자리)과,
 * 화장실·안방에 이 세션에서 처음 들어서는 순간. 그리는 것은 없다: 씬의 재질 플래그를
 * 켰다 끄고, 결의 양을 ScreenTransition에 흘린다.
 *
 * 재질 목록은 사건이 날 때 훑는다. 그 순간 보이는 공간의 것만 필요하고, 다 끝나면
 * 그대로 돌려놓는다. 켜져 있던 와이어프레임(있다면)은 건드리지 않는다.
 */
export function WireframeReveal({ enabled }: { enabled: boolean }) {
  const scene = useThree((state) => state.scene);
  const startAt = useRef<number | null>(null);
  const pending = useRef(false);
  const touched = useRef<WireframeMaterial[]>([]);
  const seen = useRef(new Set<SpaceId>(["room", "living"]));

  useEffect(() => {
    if (!enabled) return;
    return useMemoryRoomStore.subscribe((state, previous) => {
      if (selectRadioSignaling(state) && !selectRadioSignaling(previous)) pending.current = true;
      if (state.space !== previous.space && REVEAL_SPACES.includes(state.space)) {
        if (!seen.current.has(state.space)) {
          seen.current.add(state.space);
          pending.current = true;
        }
      }
    });
  }, [enabled]);

  useEffect(
    () => () => {
      for (const material of touched.current) material.wireframe = false;
      touched.current = [];
      setScreenTransitionSettle(0);
    },
    [],
  );

  useFrame((state) => {
    if (pending.current) {
      pending.current = false;
      startAt.current = state.clock.elapsedTime;
      const found: WireframeMaterial[] = [];
      scene.traverse((object) => {
        const mesh = object as Mesh;
        if (!mesh.isMesh || !mesh.visible) return;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const material of materials) {
          if (isWireframeMaterial(material) && !material.wireframe) found.push(material);
        }
      });
      touched.current = found;
      for (const material of found) material.wireframe = true;
    }
    if (startAt.current === null) return;
    const frame = reconstructionAt(state.clock.elapsedTime - startAt.current);
    if (!frame.wireframe && touched.current.length > 0) {
      for (const material of touched.current) material.wireframe = false;
      touched.current = [];
    }
    setScreenTransitionSettle(frame.settle);
    if (frame.done) startAt.current = null;
  });

  return null;
}
