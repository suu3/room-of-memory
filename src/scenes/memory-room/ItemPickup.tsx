"use client";

import type { ReactNode } from "react";
import type { ItemId } from "@/data/items";
import { playSound } from "@/lib/audio";
import { selectViewpoint, useMemoryRoomStore } from "@/store/memory-room";
import { MemoryGlowSelection } from "./MemoryOutlineGlow";
import { useGlowHover } from "./use-glow-hover";
import { useNearPlayer } from "./use-near-player";

/**
 * 집을 수 있는 물건 (v3 방탈출 축). 단서 물건(ClueProp)과 같은 문법: 곁가지 등급
 * 글로우, 다가가면 켜지고, 누르면 집는다. 집으면 사라진다. 어디에 쓰는지는
 * src/data/doors.ts가 안다.
 */
export function ItemPickup({
  id,
  near,
  radius,
  children,
}: {
  id: ItemId;
  near: readonly [number, number];
  radius: number;
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
