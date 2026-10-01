"use client";

import type { ThreeEvent } from "@react-three/fiber";
import { useFrame } from "@react-three/fiber";
import { type RefObject, useCallback, useMemo, useRef } from "react";
import { type Group, MathUtils } from "three";
import { playSound } from "@/lib/audio";
import { selectSceneInputLocked, useMemoryRoomStore } from "@/store/memory-room";
import type { SeatId } from "@/types/seat";
import { useGlowHover } from "../effects/use-glow-hover";
import { SEATS } from "./seats";
import { useNearPlayer } from "./use-near-player";

/** 모션을 끈 사람에게는 미끄러짐 없이 곧바로 옮겨 놓는다 (RoomFurniture와 같은 값). */
const REDUCED_LAMBDA = 18;
/** 의자가 빠지고 들어가는 속도. 서랍보다 느리다. 의자는 무겁다. */
const PULL_LAMBDA = 4.5;

export function usePrefersReducedMotion(): boolean {
  return useMemo(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);
}

/**
 * 앉을 수 있는 가구의 클릭·글로우.
 *
 * 앉는 건 몸이 하는 일이라 기억 조사와 달리 **다가가야** 한다. 멀리서 누르면 몸이
 * 방을 가로질러 순간이동한다. 다가갔는지는 빛으로 먼저 알려 준다.
 */
export function useSeat(id: SeatId) {
  const seat = SEATS[id];
  const occupied = useMemoryRoomStore((state) => state.seatedAt === id);
  const sitOnSeat = useMemoryRoomStore((state) => state.sitOnSeat);
  const standUp = useMemoryRoomStore((state) => state.standUp);
  const near = useNearPlayer(seat.near.x, seat.near.z, seat.reach);
  // 멀리서 누르면 거절하므로 멀리서는 호버·커서도 켜지 않는다. 빛나면 앉을 수 있어야 한다
  const { handlers } = useGlowHover(near || occupied);

  const onClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      // 의자 뒤에 있는 벽·가구까지 같이 눌리면 안 된다.
      event.stopPropagation();
      // 대사·미니게임 중에는 아무 소리도 내지 않는다. "안 되는 것"이 아니라 "지금 차례가
      // 아닌 것"이다 (RoomCanvas의 interact와 같은 규칙).
      if (selectSceneInputLocked(useMemoryRoomStore.getState())) return;
      if (occupied) {
        playSound("sit");
        standUp();
        return;
      }
      if (!near) {
        playSound("deny");
        return;
      }
      playSound("sit");
      sitOnSeat(id);
    },
    [id, near, occupied, sitOnSeat, standUp],
  );

  return useMemo(
    () => ({
      occupied,
      /** 앉아 있는 동안에도 켜 둔다. 다시 누르면 일어난다는 표시다. */
      glowing: near || occupied,
      handlers: { ...handlers, onClick },
    }),
    [handlers, near, occupied, onClick],
  );
}

/**
 * 앉는 동안 의자가 빠져 나갔다 들어오는 움직임.
 *
 * 책상·식탁 밑으로 밀어 넣은 의자는 빼지 않으면 앉은 몸이 상판을 뚫는다. 빠지는 양은
 * 좌석 데이터(SEATS[id].pull)가 갖고 있고: 몸이 앉는 자리도 거기서 나온다.
 */
export function useSeatPull(
  groupRef: RefObject<Group | null>,
  id: SeatId,
  /** 제자리에 있을 때의 가구 좌표: 빠지는 양은 여기에 더해진다. */
  base: { x: number; z: number; rotationY: number },
) {
  const pull = SEATS[id].pull;
  const occupied = useMemoryRoomStore((state) => state.seatedAt === id);
  const reducedMotion = usePrefersReducedMotion();
  const baseRef = useRef(base);
  baseRef.current = base;

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group || !pull) return;
    const lambda = reducedMotion ? REDUCED_LAMBDA : PULL_LAMBDA;
    const { x, z, rotationY } = baseRef.current;
    const out = occupied ? 1 : 0;
    group.position.x = MathUtils.damp(group.position.x, x + pull.x * out, lambda, delta);
    group.position.z = MathUtils.damp(group.position.z, z + pull.z * out, lambda, delta);
    group.rotation.y = MathUtils.damp(group.rotation.y, rotationY + pull.turn * out, lambda, delta);
  });
}
