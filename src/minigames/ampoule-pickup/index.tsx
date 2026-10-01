"use client";

import { useFrame } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Group, MeshStandardMaterial, Object3D } from "three";
import { playSound } from "@/lib/audio";
import { useEffectEnabled } from "@/lib/effects/effect-budget";
import { MemoryGlowSelection } from "@/scenes/memory-room/effects/MemoryOutlineGlow";
import { useGlowHover } from "@/scenes/memory-room/effects/use-glow-hover";
import { Ampoule } from "@/scenes/memory-room/memory/Ampoule";
import { DrawerRations, FridgeDrawer } from "@/scenes/memory-room/memory/FridgeDrawer";
import { approach } from "@/scenes/memory-room/memory/memory-motion";
import { MEMORY_PLACEMENTS } from "@/scenes/memory-room/world/layout";
import { resolveRoomPalette } from "@/scenes/memory-room/world/palette";
import type { MinigameProps } from "@/types/minigame";
import { useOnceCompleter } from "../shell";
import {
  AMPOULE_REST,
  DRAWER_OPEN_DURATION,
  drawerOffset,
  LIFT_DURATION,
  liftPose,
} from "./motion";

/** 앰플이 서는 자리: 냉장고 아래칸의 기억 자리 그대로. 거실 가구 배율도 여기서 온다. */
const PLACEMENT = MEMORY_PLACEMENTS.ampoule;
/** 집을 수 있는 동안 유리에 오르는 금빛. 배트(EndingTrigger)의 READY와 같은 세기. */
const PICKABLE_EMISSIVE = 0.5;
/** 손에 든 뒤 남는 빛. 꺼지면 "집었다"가 아니라 "사라졌다"로 읽힌다. */
const HELD_EMISSIVE = 0.18;
/** 유리가 밝아지는 속도. */
const GLOW_LAMBDA = 3;
/** 터치 판정 구의 반지름. 앰플은 가늘어서 손가락으로 짚기 어렵다. */
const HIT_RADIUS = 0.16;

/** `object`가 `root` 자신이거나 그 아래에 있는가. */
function isWithin(object: Object3D, root: Object3D): boolean {
  for (let node: Object3D | null = object; node; node = node.parent) {
    if (node === root) return true;
  }
  return false;
}

/**
 * 냉장고 아래칸을 열고 앰플을 집어 든다. canvas 모드: 씬의 냉장고 그 자리에서 판이 돈다.
 *
 * 이기고 지는 게임이 아니다. 서랍이 밀려 나오면(소리·0.55초) 식량 사이에 누운
 * 앰플이 금빛으로 뜨고, 클릭·탭하면 손 높이로 올라와 천천히 돈다. 키로는 집지 않는다:
 * 물건을 손으로 집는 판이라 직접 짚어야 "집었다"가 된다.
 * 다 오르면 판이 끝나고, 결과 대사(ampoule-found)가 흐르는 동안에도 앰플은 그
 * 자리에 들려 있다 (stage "result"). 실패도 스킵도 없다: 집는 데 30초가 걸릴 리 없다.
 *
 * 스토어를 만지지 않는다. 결과는 onComplete 한 번뿐이고, 무엇이 열리는지는 엔진의
 * 몫이다 (.claude/rules/minigames.md).
 */
export function AmpoulePickupMinigame({ onComplete, onSettled, stage = "play" }: MinigameProps) {
  const palette = useMemo(resolveRoomPalette, []);
  const complete = useOnceCompleter(onComplete);
  /*
   * 결과 대사 단계에서 새로 마운트되면(HMR·재렌더) 이미 집은 뒤다. 서랍은 열려 있고
   * 앰플은 손에 들려 있어야 한다. 서랍 안에서 다시 시작하면 "든 채로 말한다"가 거짓이 된다.
   */
  const alreadyHeld = stage === "result";
  const [open, setOpen] = useState(alreadyHeld);
  const [picked, setPicked] = useState(alreadyHeld);
  const pickable = open && !picked && stage === "play";
  const { handlers } = useGlowHover(pickable);
  /*
   * 굴절 유리 (docs/visual-experiments.md 11장): 들어 올린 앰플 너머로 냉장고 안이 굴절돼
   * 보인다. transmission은 씬을 렌더 타깃에 한 번 더 그리는 heavy 효과라, 카메라가
   * 붙박이인 이 판에서만, 예산이 full인 기기에서만 켠다.
   */
  const refractive = useEffectEnabled("heavy");
  const drawerRef = useRef<Group>(null);
  const ampouleRef = useRef<Group>(null);
  const glassRef = useRef<MeshStandardMaterial>(null);
  /** 판이 선 뒤 흐른 시간(초): 서랍이 여기서 나온다. */
  const elapsedRef = useRef(alreadyHeld ? DRAWER_OPEN_DURATION : 0);
  /** 집은 뒤 흐른 시간(초). null이면 아직 서랍 안이다. */
  const liftRef = useRef<number | null>(alreadyHeld ? LIFT_DURATION : null);
  const onSettledRef = useRef(onSettled);
  onSettledRef.current = onSettled;

  // 서랍이 밀려 나오는 소리와 함께 판이 선다. 다 나와야 집을 수 있다
  useEffect(() => {
    if (alreadyHeld) return;
    playSound("drawer");
    const timer = window.setTimeout(() => setOpen(true), DRAWER_OPEN_DURATION * 1000);
    return () => window.clearTimeout(timer);
  }, [alreadyHeld]);

  const pick = useCallback(() => {
    if (!pickable) return;
    setPicked(true);
    liftRef.current = 0;
    playSound("collect");
    // 손에 닿은 순간 결과는 정해졌다. 호스트가 바깥 클릭·Esc를 막는다
    onSettledRef.current?.();
  }, [pickable]);

  // 손 높이까지 다 오르면 판이 끝난다. 그 전에 판이 닫히면 타이머도 같이 지운다
  useEffect(() => {
    if (!picked || alreadyHeld) return;
    const timer = window.setTimeout(
      // 소리(collect)와 들어 올리는 연출을 이미 보여줬다. 호스트가 또 터뜨리지 않는다
      () => complete({ cleared: true, celebrated: true }),
      LIFT_DURATION * 1000,
    );
    return () => window.clearTimeout(timer);
  }, [picked, alreadyHeld, complete]);

  // 서랍·앰플·유리빛: 전부 ref만 민다 (.claude/rules/r3f.md)
  useFrame((state, delta) => {
    elapsedRef.current += delta;
    const offset = drawerOffset(elapsedRef.current);
    drawerRef.current?.position.setZ(offset);

    const ampoule = ampouleRef.current;
    if (ampoule) {
      if (liftRef.current === null) {
        const [x, y, z] = AMPOULE_REST.position;
        ampoule.position.set(x, y, z + offset);
        ampoule.rotation.set(...AMPOULE_REST.rotation);
      } else {
        liftRef.current += delta;
        const pose = liftPose(liftRef.current, state.clock.elapsedTime);
        ampoule.position.set(...pose.position);
        ampoule.rotation.set(...pose.rotation);
        ampoule.scale.setScalar(pose.scale);
      }
    }

    const glass = glassRef.current;
    if (glass) {
      const target = picked ? HELD_EMISSIVE : open ? PICKABLE_EMISSIVE : 0;
      glass.emissiveIntensity = approach(glass.emissiveIntensity, target, GLOW_LAMBDA, delta);
    }
  });

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: R3F group은 DOM이 아니라 Canvas 안의 포인터 대상이다.
    <group
      name="mg-ampoule-pickup"
      position={PLACEMENT.position}
      rotation={PLACEMENT.rotation}
      scale={PLACEMENT.scale}
      onClick={(event) => {
        // 서랍 어디를 눌러도 바닥 걷기로 새지 않는다
        event.stopPropagation();
        /*
         * 서랍 앞판·옆벽이 앰플보다 카메라에 가까우면 그 면이 클릭을 먼저 받고 여기서
         * 멎는다. 광선이 앰플(판정 구 포함)을 지났으면 가려져 있어도 집는다.
         */
        const ampoule = ampouleRef.current;
        if (ampoule && event.intersections.some((hit) => isWithin(hit.object, ampoule))) pick();
      }}
    >
      <FridgeDrawer ref={drawerRef} palette={palette}>
        <DrawerRations palette={palette} />
      </FridgeDrawer>
      {/* 앰플은 서랍의 자식이 아니다. 서랍 안에 있을 때만 서랍을 따라가고, 집으면 제 길을 간다 */}
      <group ref={ampouleRef} name="mg-ampoule-pickup-ampoule">
        {/* 서랍이 열리면 빛나고, 손에 든 뒤에도 계속 빛난다. 든 것이 어두우면 "집었다"가 안 읽힌다 */}
        <MemoryGlowSelection selectionKey="mg-ampoule-pickup" tier="memory" enabled={open}>
          {/* biome-ignore lint/a11y/noStaticElementInteractions: R3F group은 DOM이 아니라 Canvas 안의 포인터 대상이다. */}
          <group
            {...handlers}
            onClick={(event) => {
              event.stopPropagation();
              pick();
            }}
          >
            <Ampoule palette={palette} glassRef={glassRef} refractive={refractive} />
          </group>
        </MemoryGlowSelection>
        {/*
          터치 판정: 글로우 선택 밖에 둔다. 안에 두면 투명한 구의 윤곽선이 같이 그려진다
          (EndingTrigger의 ending-bat-hit와 같은 방식).
        */}
        {pickable ? (
          // biome-ignore lint/a11y/noStaticElementInteractions: R3F mesh는 DOM이 아니라 Canvas 안의 포인터 대상이다.
          <mesh
            name="mg-ampoule-pickup-hit"
            onClick={(event) => {
              event.stopPropagation();
              pick();
            }}
          >
            <sphereGeometry args={[HIT_RADIUS, 10, 8]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        ) : null}
      </group>
    </group>
  );
}
