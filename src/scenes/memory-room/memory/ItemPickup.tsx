"use client";

import type { ReactNode } from "react";
import type { ItemId } from "@/data/items";
import { playSound } from "@/lib/audio";
import { selectViewpoint, useMemoryRoomStore } from "@/store/memory-room";
import { MemoryGlowSelection } from "../effects/MemoryOutlineGlow";
import { useGlowHover } from "../effects/use-glow-hover";
import { useNearPlayer } from "../player/use-near-player";
import type { RoomPalette } from "../world/palette";
import type { Vec3Tuple } from "../world/types";
import { MemoryBeacon } from "./MemoryBeacon";

/**
 * 집을 수 있는 물건 (v3 방탈출 축). 단서 물건(ClueProp)과 같은 문법: 곁가지 등급
 * 글로우, 다가가면 켜지고, 누르면 집는다. 집으면 사라진다. 어디에 쓰는지는
 * src/data/doors.ts가 안다.
 *
 * `beacon`을 주면 기억 오브젝트와 같은 금빛 표식(MemoryBeacon)을 세울 수 있다. 켜는
 * 조건(`beckon`)은 부르는 쪽이 정한다: 플레이어가 이 물건을 찾아야 한다는 걸 안 뒤에만.
 */
export function ItemPickup({
  id,
  near,
  radius,
  beacon,
  beckon = false,
  hitSize,
  children,
}: {
  id: ItemId;
  near: readonly [number, number];
  radius: number;
  /** 표식이 서는 자리(월드). 없으면 표식을 그리지 않는다. */
  beacon?: { position: Vec3Tuple; palette: RoomPalette };
  /** 표식을 켜는가. beacon이 있을 때만 뜻이 있다. */
  beckon?: boolean;
  /**
   * 부르는 동안 눌리는 범위 [가로, 높이, 세로]. 물건 위로 표식까지 감싸는 안 보이는 상자다.
   * 종잇조각처럼 납작한 물건은 제 모양만으로는 거의 안 눌리고, 사람은 떠 있는 표식을 누른다.
   * 부르지 않는 동안에는 두지 않는다: 옆 물건(책상 위 서류)의 클릭을 가로채면 안 된다.
   */
  hitSize?: Vec3Tuple;
  children: ReactNode;
}) {
  const taken = useMemoryRoomStore((state) => state.inventory.includes(id));
  const takeItem = useMemoryRoomStore((state) => state.takeItem);
  const firstPerson = useMemoryRoomStore(selectViewpoint) !== null;
  const active = !taken && !firstPerson;
  const { hovered, handlers } = useGlowHover(active);
  const nearPlayer = useNearPlayer(near[0], near[1], radius);

  if (taken) return null;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: R3F group은 DOM이 아니라 Canvas 안의 포인터 대상이다.
    <group
      name={`item-${id}`}
      {...handlers}
      onClick={(event) => {
        if (!active) return;
        event.stopPropagation();
        playSound("collect");
        takeItem(id);
      }}
    >
      {/* 글로우 레이어 밖: 표식은 아웃라인 선택 대상이 아니다 (MemoryObjects와 같다) */}
      {beacon && (
        <group position={beacon.position}>
          <MemoryBeacon
            id={id}
            color={beacon.palette.memory}
            active={active && beckon}
            near={nearPlayer}
            groundOffset={beacon.position[1]}
          />
        </group>
      )}
      {beacon && hitSize && active && beckon && (
        <mesh
          position={[beacon.position[0], beacon.position[1] + hitSize[1] / 2, beacon.position[2]]}
        >
          <boxGeometry args={hitSize} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
      <MemoryGlowSelection
        selectionKey={`item-${id}`}
        tier="prop"
        enabled={active && (hovered || nearPlayer)}
      >
        {children}
      </MemoryGlowSelection>
    </group>
  );
}
