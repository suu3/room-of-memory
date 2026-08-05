"use client";

import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useCallback, useMemo, useRef } from "react";
import type { Group, Mesh } from "three";
import { ASSETS } from "@/lib/assets";
import { playSound } from "@/lib/audio";
import { selectEndingReady, useMemoryRoomStore } from "@/store/memory-room";
import { BAT_PLACEMENT } from "./layout";
import { MemoryGlowSelection } from "./MemoryOutlineGlow";
import { approach, HOVER_LAMBDA, memoryMotion, PUNCH_DURATION } from "./memory-motion";
import { centerModelXZ } from "./model-utils";
import type { RoomPalette } from "./palette";
import { useGlowHover } from "./use-glow-hover";
import { useNearPlayer } from "./use-near-player";

useGLTF.preload(ASSETS.models.baseballBat, true, true);

const [BAT_X, , BAT_Z] = BAT_PLACEMENT.position;

/** 준비되기 전의 배트가 내는 아주 옅은 빛 — "여기 뭔가 있다"까지만 말한다. */
const DORMANT_EMISSIVE = 0.06;
const READY_EMISSIVE = 0.55;
/** 쥐는 순간 배트가 화면에서 들려 나가는 시간 (초). 문이 열리는 박자보다 짧다. */
const TAKEN_DURATION = 0.45;
/** 들려 올라가는 높이. */
const TAKEN_LIFT = 0.9;

/**
 * 문 옆에 세워둔 배트. 수집 대상이 아니라 엔딩 트리거다.
 *
 * 2바퀴를 다 돌기 전에는 손이 안 간다 — 눌러도 아무 일이 없고 커서도 바뀌지 않는다.
 * 다 돌면 금빛으로 켜지고, 쥐는 순간 문이 열린다.
 */
export function EndingTrigger({ palette }: { palette: RoomPalette }) {
  const ready = useMemoryRoomStore(selectEndingReady);
  const started = useMemoryRoomStore((state) => state.endingStarted);
  const startEnding = useMemoryRoomStore((state) => state.startEnding);
  const clickable = ready && !started;
  const { hovered, handlers } = useGlowHover(clickable);
  // 다가가면 빛난다 — 쥘 수 있게 된 뒤부터만. 아직 아닌 배트가 빛나면
  // 다 돌지도 않았는데 엔딩이 열린 것처럼 읽힌다.
  const near = useNearPlayer(BAT_X, BAT_Z, BAT_PLACEMENT.interactionRadius) && clickable;
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

    // 쥐었으면 배트는 손으로 딸려 나간다 — 문이 열리는 동안 벽에 그대로 서 있으면
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
    startEnding();
  }, [ready, started, startEnding]);

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
      <MemoryGlowSelection selectionKey="ending-bat" tier="memory" enabled={hovered || near}>
        <group ref={motionRef}>
          <group rotation={BAT_PLACEMENT.rotation} scale={BAT_PLACEMENT.scale} {...handlers}>
            <primitive object={bat} />
          </group>
        </group>
      </MemoryGlowSelection>
    </group>
  );
}
