"use client";

import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Suspense, useCallback, useMemo, useRef } from "react";
import type { Group, Mesh } from "three";
import { ASSETS } from "@/lib/assets";
import { playSound } from "@/lib/audio";
import { selectBatReady, useMemoryRoomStore } from "@/store/memory-room";
import { BAT_PLACEMENT } from "./layout";
import { MemoryGlowSelection } from "./MemoryOutlineGlow";
import { approach, HOVER_LAMBDA, memoryMotion, PUNCH_DURATION } from "./memory-motion";
import { centerModelXZ } from "./model-utils";
import type { RoomPalette } from "./palette";
import { useGlowHover } from "./use-glow-hover";

useGLTF.preload(ASSETS.models.baseballBat, true, true);

/** 준비되기 전의 배트가 내는 아주 옅은 빛: "여기 뭔가 있다"까지만 말한다. */
const DORMANT_EMISSIVE = 0.06;
const READY_EMISSIVE = 0.55;
/** 쥐는 순간 배트가 화면에서 들려 나가는 시간 (초). 문이 열리는 박자보다 짧다. */
const TAKEN_DURATION = 0.45;
/** 들려 올라가는 높이. */
const TAKEN_LIFT = 0.9;

/**
 * 현관문 옆에 세워둔 배트: 3막의 물건이다 (docs/content-design.md 3-2).
 *
 * 앰플을 손에 넣어야(2막 완료) 켜지고, 쥐면 현관문이 열린다. 야구부였다는
 * 사실이 처음으로 쓸모를 갖는 자리이자, 도해가 밖을 어떻게 생각하고 있는지를
 * 말없이 보여주는 자리다. 문을 여는 것 자체는 현관문이 맡는다 (FrontDoor).
 */
/** 배트. Suspense 경계는 밖의 EndingTrigger가 들고 있다 (아래 주석). */
function LoadedEndingTrigger({ palette }: { palette: RoomPalette }) {
  const ready = useMemoryRoomStore(selectBatReady);
  const started = useMemoryRoomStore((state) => state.batTaken);
  const takeBat = useMemoryRoomStore((state) => state.takeBat);
  const clickable = ready && !started;
  const { hovered, handlers } = useGlowHover(clickable);
  const motionRef = useRef<Group>(null);
  const hoverRef = useRef(0);
  const punchRef = useRef(PUNCH_DURATION);
  const takenRef = useRef(0);

  const { scene } = useGLTF(ASSETS.models.baseballBat, true, true);
  const bat = useMemo(() => {
    const copy = scene.clone(true);
    copy.traverse((object) => {
      const mesh = object as Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map((material) => material.clone())
        : mesh.material.clone();
    });
    return centerModelXZ(copy);
  }, [scene]);

  // 준비되면 금빛이 서서히 올라온다. 재질을 매 프레임 새로 만들지 않고 값만 민다.
  useFrame((_, delta) => {
    const target = ready && !started ? READY_EMISSIVE : DORMANT_EMISSIVE;
    bat.traverse((object) => {
      const mesh = object as Mesh;
      if (!mesh.isMesh) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) {
        const lit = material as {
          emissive?: { set: (value: string) => void };
          emissiveIntensity?: number;
        };
        if (!lit.emissive) continue;
        lit.emissive.set(palette.memory);
        lit.emissiveIntensity = approach(lit.emissiveIntensity ?? 0, target, 3, delta);
      }
    });

    const group = motionRef.current;
    if (!group) return;

    // 쥐었으면 배트는 손으로 딸려 나간다. 문이 열리는 동안 벽에 그대로 서 있으면
    // "쥐었다"가 거짓말이 된다.
    if (started) {
      takenRef.current = Math.min(TAKEN_DURATION, takenRef.current + delta);
      const taken = takenRef.current / TAKEN_DURATION;
      group.position.y = taken * TAKEN_LIFT;
      group.scale.setScalar(Math.max(0, 1 - taken));
      return;
    }

    hoverRef.current = approach(hoverRef.current, hovered ? 1 : 0, HOVER_LAMBDA, delta);
    punchRef.current = Math.min(PUNCH_DURATION, punchRef.current + delta);
    const motion = memoryMotion(hoverRef.current, punchRef.current);
    group.scale.setScalar(motion.scale);
    group.position.y = motion.lift;
  });

  const grab = useCallback(() => {
    if (!ready || started) return;
    punchRef.current = 0;
    playSound("collect");
    // 여기서 바로 쥐지 않는다. 두 줄이 먼저고, 그 재생이 끝나야 손에 들어온다 (store.takeBat)
    takeBat();
  }, [ready, started, takeBat]);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: R3F group은 DOM이 아니라 Canvas 안의 포인터 대상이다.
    <group
      name="ending-bat"
      position={BAT_PLACEMENT.position}
      onClick={(event) => {
        event.stopPropagation();
        grab();
      }}
    >
      {/*
        쥘 수 있으면 거실 어디서 봐도 빛난다. HUD가 "현관의 배트가 빛난다"고
        말해 주는데 다가가야만 켜지면 그 말이 거짓이 된다. 아직 아닌 배트는
        원래대로 어둡다 (DORMANT_EMISSIVE).
      */}
      <MemoryGlowSelection selectionKey="ending-bat" tier="memory" enabled={clickable}>
        <group ref={motionRef}>
          <group rotation={BAT_PLACEMENT.rotation} scale={BAT_PLACEMENT.scale} {...handlers}>
            <primitive object={bat} />
          </group>
        </group>
      </MemoryGlowSelection>
      {/*
        터치 판정: 배트는 얇고 기울어진 메쉬라 모바일에서 정확히 짚기 어렵다.
        기억 오브젝트들의 memory-hit 구와 같은 방식으로, 쥘 수 있는 동안만
        투명한 구가 탭을 받아 준다 (글로우 선택 밖이라 윤곽선에는 안 잡힌다).
      */}
      {clickable ? (
        <mesh name="ending-bat-hit">
          <sphereGeometry args={[BAT_PLACEMENT.interactionRadius, 12, 8]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      ) : null}
    </group>
  );
}

/**
 * 배트. Suspense 경계를 제 안에 둔다 (Player·FurnitureModel과 같은 이유).
 *
 * glb가 늦게 오면 서스펜드가 씬 전체로 올라가 1인칭 리그까지 내려간다. 늦는 건
 * 배트 하나로 족하다.
 */
export function EndingTrigger(props: { palette: RoomPalette }) {
  return (
    <Suspense fallback={null}>
      <LoadedEndingTrigger {...props} />
    </Suspense>
  );
}
