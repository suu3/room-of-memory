"use client";

import { forwardRef } from "react";
import type { Group, MeshStandardMaterial } from "three";
import type { RoomPalette } from "./palette";

/** 유리 재질의 공통값. 관 하나만 밖에서 빛을 밀고, 바닥은 같은 투명도로 따라간다. */
const GLASS = { roughness: 0.08, transparent: true, opacity: 0.4 } as const;
/**
 * 굴절 유리 (docs/visual-experiments.md 11장 "굴절 → 앰플 유리"). transmission이 뒤의
 * 냉장고 안을 관 너머로 굴절시켜 보인다. 두께는 관 반지름과 같은 급으로 두어 굴절이
 * 있는 듯 없는 듯 선다: 너무 두꺼우면 렌즈가 되어 액체가 사라진다. transmission이
 * 투명도를 대신하므로 transparent는 끈다 (켜면 정렬이 겹쳐 액체가 깜빡인다).
 */
const REFRACTIVE_GLASS = {
  roughness: 0.08,
  transmission: 0.9,
  thickness: 0.02,
  ior: 1.45,
  transparent: false,
} as const;
/** 관의 반지름과 길이 (둥근 바닥 제외). */
const TUBE_RADIUS = 0.017;
const TUBE_LENGTH = 0.15;
/** 관의 아래·위 끝 높이. 원점은 관의 가운데다. */
const TUBE_BOTTOM = -TUBE_LENGTH / 2;
const TUBE_TOP = TUBE_LENGTH / 2;
/** 액체가 차 있는 높이: 관의 6할쯤. */
const LIQUID_TOP = 0.01;

/**
 * 정체불명의 앰플: 실험실 채혈관 같은 시험관형 튜브 (docs/content-design.md 4-2).
 *
 * 곧은 투명 관, 둥근 바닥, 위를 막은 색 캡. 눈금도 바늘도 없고 캡은 돌려 여는
 * 것인지 뽑는 것인지도 모르겠다. 안에 든 것은 차가운 빛깔의 액체 하나. 관에 붙은
 * 종이 라벨은 인쇄가 반쯤 지워져 읽을 수 없다. 도해가 사용을 생각조차 못 하는
 * 물건이어야 하므로 "어떻게 쓰는지"를 말해 주는 요소를 하나도 두지 않는다.
 *
 * 1배 로컬 단위로 높이 0.2쯤: 야구공(0.19)과 같은 잣대라 손에 들면 손가락 길이만 하다.
 *
 * 관의 `emissive`는 밖에서 민다 (집을 수 있을 때 금빛이 올라온다). 재질을 프레임마다
 * 새로 만들지 않도록 ref로 내준다.
 *
 * `refractive`면 관만 MeshPhysicalMaterial(transmission)로 바꾼다. transmission은 씬을
 * 렌더 타깃에 한 번 더 그리므로 heavy다: 호출부(ampoule-pickup)가 효과 예산을 보고
 * 카메라가 붙박이인 미니게임 구간에만 켠다. 냉장고 진열의 앰플은 늘 기본 유리다.
 * MeshPhysicalMaterial은 MeshStandardMaterial을 상속하므로 glassRef는 그대로 받는다.
 */
export const Ampoule = forwardRef<
  Group,
  {
    palette: RoomPalette;
    /** 관 유리 재질. 글로우 세기를 밖에서 밀 때 잡는다. */
    glassRef?: React.Ref<MeshStandardMaterial>;
    /** 관 유리를 굴절 유리(transmission)로. 렌더 타깃이 하나 더 드는 heavy 효과다. */
    refractive?: boolean;
  }
>(function Ampoule({ palette, glassRef, refractive = false }, ref) {
  return (
    <group ref={ref} name="ampoule">
      {/* 관 */}
      <mesh castShadow>
        <cylinderGeometry args={[TUBE_RADIUS, TUBE_RADIUS, TUBE_LENGTH, 18]} />
        {refractive ? (
          <meshPhysicalMaterial
            key="refractive"
            ref={glassRef}
            color={palette.linen}
            {...REFRACTIVE_GLASS}
            emissive={palette.memory}
            emissiveIntensity={0}
          />
        ) : (
          <meshStandardMaterial
            key="plain"
            ref={glassRef}
            color={palette.linen}
            {...GLASS}
            emissive={palette.memory}
            emissiveIntensity={0}
          />
        )}
      </mesh>
      {/* 둥근 바닥 */}
      <mesh position={[0, TUBE_BOTTOM, 0]}>
        <sphereGeometry args={[TUBE_RADIUS, 18, 10]} />
        <meshStandardMaterial color={palette.linen} {...GLASS} />
      </mesh>
      {/* 액체: 바닥에서 6할까지. 무엇인지 모른다. 차가운 빛깔 하나로만 말한다 */}
      <mesh position={[0, (TUBE_BOTTOM + LIQUID_TOP) / 2, 0]}>
        <cylinderGeometry
          args={[TUBE_RADIUS - 0.003, TUBE_RADIUS - 0.003, LIQUID_TOP - TUBE_BOTTOM, 14]}
        />
        <meshStandardMaterial color={palette.daylight} roughness={0.3} transparent opacity={0.9} />
      </mesh>
      <mesh position={[0, TUBE_BOTTOM, 0]}>
        <sphereGeometry args={[TUBE_RADIUS - 0.003, 14, 8]} />
        <meshStandardMaterial color={palette.daylight} roughness={0.3} transparent opacity={0.9} />
      </mesh>
      {/* 캡: 관보다 한 치수 굵은 색 마개. 관 위 끝을 4mm 물고 앉는다 */}
      <mesh position={[0, TUBE_TOP + 0.012, 0]} castShadow>
        <cylinderGeometry args={[0.021, 0.021, 0.032, 18]} />
        <meshStandardMaterial color={palette.leaf} roughness={0.7} />
      </mesh>
      {/* 캡 윗면의 얕은 홈: 밋밋한 원기둥이 마개로 읽히려면 위에 단이 하나 있어야 한다 */}
      <mesh position={[0, TUBE_TOP + 0.0285, 0]}>
        <cylinderGeometry args={[0.016, 0.016, 0.003, 18]} />
        <meshStandardMaterial color={palette.frame} roughness={0.8} />
      </mesh>
      {/* 종이 라벨: 관 앞면에 붙은 띠. 인쇄 두 줄 중 아랫줄은 반쯤 지워져 짧다 */}
      <mesh position={[0, -0.01, TUBE_RADIUS - 0.0005]}>
        <boxGeometry args={[0.026, 0.046, 0.0015]} />
        <meshStandardMaterial color={palette.linen} roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.0, TUBE_RADIUS + 0.0008]}>
        <boxGeometry args={[0.019, 0.0035, 0.001]} />
        <meshStandardMaterial color={palette.frame} roughness={0.9} transparent opacity={0.75} />
      </mesh>
      <mesh position={[-0.004, -0.012, TUBE_RADIUS + 0.0008]}>
        <boxGeometry args={[0.01, 0.0035, 0.001]} />
        <meshStandardMaterial color={palette.frame} roughness={0.9} transparent opacity={0.4} />
      </mesh>
    </group>
  );
});
