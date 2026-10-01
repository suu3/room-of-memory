"use client";

import { useGLTF } from "@react-three/drei";
import { ASSETS } from "@/lib/assets";
import { FurnitureModel } from "./FurnitureModel";
import type { RoomPalette } from "./palette";

/**
 * 거실의 새 뒷벽에 붙은 작은 오픈 키친.
 *
 * 별도 공간이 아니라 living의 한 구역이다. 조리대·싱크·레인지·상부장을 GLB 하나로
 * 묶어 반복되는 박스 메시의 드로우콜을 줄이고, 재질 이름만 런타임 팔레트에 연결한다.
 */
const KITCHEN_POSITION = [-12.25, 0, -7.05] as const;

useGLTF.preload(ASSETS.models.livingKitchen, true, true);

export function KitchenFurniture({ palette }: { palette: RoomPalette }) {
  return (
    <group name="living-open-kitchen">
      <FurnitureModel
        path={ASSETS.models.livingKitchen}
        position={KITCHEN_POSITION}
        scale={1}
        materialColors={{
          kitchenWood: palette.wood,
          kitchenFrame: palette.frame,
          kitchenLinen: palette.linen,
          kitchenTrim: palette.trim,
          kitchenMetal: palette.sage,
          kitchenDark: palette.void,
        }}
      />
    </group>
  );
}
