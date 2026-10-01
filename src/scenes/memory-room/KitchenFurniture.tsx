"use client";

import { useGLTF } from "@react-three/drei";
import { ASSETS } from "@/lib/assets";
import { FurnitureModel } from "./FurnitureModel";
import { LIVING_KITCHEN } from "./layout";
import type { RoomPalette } from "./palette";

/**
 * 거실 뒷벽의 ㄱ자 오픈 키친: 냉장고 옆 조리대(싱크·레인지·상부장)와 거실 쪽으로 꺾인 반도.
 *
 * 별도 공간이 아니라 living의 한 구역이다. 부품을 GLB 하나로 묶어 반복되는 박스 메시의
 * 드로우콜을 줄이고, 재질 이름만 런타임 팔레트에 연결한다. 자리와 발자국은 layout의
 * LIVING_KITCHEN 한곳에서 나온다.
 */
useGLTF.preload(ASSETS.models.livingKitchen, true, true);

export function KitchenFurniture({ palette }: { palette: RoomPalette }) {
  return (
    <group name="living-open-kitchen">
      <FurnitureModel
        path={ASSETS.models.livingKitchen}
        position={LIVING_KITCHEN.position}
        scale={1}
        materialColors={{
          kitchenWood: palette.wood,
          kitchenFrame: palette.frame,
          kitchenLinen: palette.linen,
          kitchenTrim: palette.trim,
          kitchenMetal: palette.sage,
          kitchenDark: palette.void,
          kitchenClay: palette.clay,
        }}
      />
    </group>
  );
}
