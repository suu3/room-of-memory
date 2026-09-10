"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { AdditiveBlending, DoubleSide, type Group, type Mesh, type MeshBasicMaterial } from "three";
import type { MemoryId } from "@/data/memory-room";

/**
 * "이건 만질 수 있다"를 멀리서도 알리는 표식.
 *
 * 지금까지 인터랙션 단서는 (1) 마우스를 올렸을 때의 아웃라인과 (2) 가까이 갔을 때
 * 화면 아래 뜨는 칩뿐이었다. 둘 다 이미 그 물건을 찾은 뒤에야 켜지는 것들이라,
 * 방을 처음 둘러보는 사람에게는 어디를 봐야 하는지 알려주지 않았다.
 *
 * 그래서 바닥의 고리와 공중의 마름모 두 겹으로 알린다:
 * - 바닥 고리는 "여기 서라"는 표시. 벽에 걸린 물건(달력·창)도 바닥에 고리가 생겨
 *   다가갈 자리를 알려준다.
 * - 마름모는 물건 자체를 가리킨다. 천천히 돌면서 위아래로 까딱인다.
 *
 * 색은 memory(금빛) 하나다. DESIGN.md에서 금빛은 "만질 수 있는 기억"에만 허용된
 * 색이라, 표식의 의미와 색의 의미가 정확히 겹친다.
 */

/** 가까이 갔을 때 표식이 커지고 밝아지는 배율. 멀 때와 확실히 달라야 한다. */
const NEAR_SCALE = 1.35;
const NEAR_BOOST = 1.9;

/** 바닥 고리 반경. 상호작용 반경보다 조금 작게: 고리를 밟으면 이미 닿는다. */
const RING_INNER = 0.42;
const RING_OUTER = 0.56;

/** 마름모가 뜨는 높이(물건 원점 기준)와 까딱이는 폭. */
const DIAMOND_LIFT = 0.52;
const DIAMOND_BOB = 0.07;
const DIAMOND_SIZE = 0.1;

/**
 * 물건마다 마름모를 얼마나 더 띄울지. 기본값(0.52)은 책상 위 소품 기준이라,
 * 덩치가 크거나 벽에 붙은 것들은 따로 올려 준다. 안 그러면 물건 속에 파묻힌다.
 */
const EXTRA_LIFT: Partial<Record<MemoryId, number>> = {
  window: 0.95,
  calendar: 0.62,
  console: 0.18,
  ball: 0.14,
};

export function MemoryBeacon({
  id,
  color,
  /** 아직 조사하지 않은 기억인가. false면 표식을 아예 그리지 않는다. */
  active,
  /** 플레이어가 상호작용 반경 안에 있는가. */
  near,
  /** 물건이 놓인 높이: 바닥 고리를 월드 바닥으로 되돌리는 데 쓴다. */
  groundOffset,
}: {
  id: MemoryId;
  color: string;
  active: boolean;
  near: boolean;
  groundOffset: number;
}) {
  const ringRef = useRef<Mesh>(null);
  const diamondRef = useRef<Group>(null);
  const ringMaterialRef = useRef<MeshBasicMaterial>(null);
  const diamondMaterialRef = useRef<MeshBasicMaterial>(null);
  /** 켜짐 정도와 근접 정도. 둘 다 부드럽게 따라간다. 툭 켜지면 눈에 거슬린다. */
  const shownRef = useRef(0);
  const nearRef = useRef(0);
  /** 표식이 도는 각도. 회전은 카메라를 돌려도 같은 속도로 보여야 해서 시간으로 센다. */
  const spinRef = useRef(0);

  const lift = DIAMOND_LIFT + (EXTRA_LIFT[id] ?? 0);
  // 상호작용 반경이 물건마다 달라도 고리 크기는 같게 둔다. 크기가 제각각이면
  // 고리가 "표식"이 아니라 물건의 일부처럼 보인다.
  const ringArgs = useMemo(() => [RING_INNER, RING_OUTER, 28] as const, []);

  useFrame((state, delta) => {
    const ring = ringRef.current;
    const diamond = diamondRef.current;
    if (!ring || !diamond) return;

    // damp를 직접 쓰지 않는다. 껐다 켤 때 0/1 양 끝에 정확히 닿아야
    // visible 토글이 깔끔하다.
    const shownGoal = active ? 1 : 0;
    shownRef.current += Math.min(1, delta * 5) * (shownGoal - shownRef.current);
    nearRef.current += Math.min(1, delta * 6) * ((near ? 1 : 0) - nearRef.current);
    spinRef.current += delta;

    const shown = shownRef.current;
    const visible = shown > 0.01;
    ring.visible = visible;
    diamond.visible = visible;
    if (!visible) return;

    const nearness = nearRef.current;
    const pulse = 0.72 + 0.28 * Math.sin(state.clock.elapsedTime * 2.1);
    const scale = 1 + (NEAR_SCALE - 1) * nearness;

    ring.scale.setScalar(scale);
    if (ringMaterialRef.current) {
      ringMaterialRef.current.opacity = shown * pulse * 0.34 * (1 + (NEAR_BOOST - 1) * nearness);
    }

    diamond.position.y = lift + Math.sin(state.clock.elapsedTime * 1.7) * DIAMOND_BOB;
    diamond.rotation.y = spinRef.current * 1.1;
    diamond.scale.setScalar(scale);
    if (diamondMaterialRef.current) {
      diamondMaterialRef.current.opacity = shown * (0.5 + 0.5 * nearness);
    }
  });

  return (
    <group name={`beacon-${id}`}>
      {/* 바닥 고리: 물건이 얼마나 높이 있든 바닥에 눕는다 */}
      <mesh
        ref={ringRef}
        position={[0, -groundOffset + 0.03, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        // 표식은 클릭 대상이 아니다. 고리를 눌러 물건이 열리면 조준이 헐거워진다.
        raycast={() => null}
      >
        <ringGeometry args={ringArgs} />
        <meshBasicMaterial
          ref={ringMaterialRef}
          color={color}
          transparent
          opacity={0}
          depthWrite={false}
          side={DoubleSide}
          blending={AdditiveBlending}
        />
      </mesh>

      {/* 공중의 마름모 */}
      <group ref={diamondRef} position={[0, lift, 0]}>
        <mesh raycast={() => null}>
          <octahedronGeometry args={[DIAMOND_SIZE]} />
          <meshBasicMaterial
            ref={diamondMaterialRef}
            color={color}
            transparent
            opacity={0}
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </mesh>
      </group>
    </group>
  );
}
