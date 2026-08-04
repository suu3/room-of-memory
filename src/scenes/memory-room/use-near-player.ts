"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Vector3 } from "three";

/**
 * 플레이어의 현재 위치. 매 프레임 바뀌므로 값이 아니라 ref로 흘린다 —
 * 값으로 내리면 걸음마다 씬 전체가 리렌더된다.
 *
 * 씬 최상단(MemoryRoomScene)이 채우고, 방 안 아무 깊이에서나 꺼내 쓴다.
 * 커튼이나 전등 스위치처럼 벽·가구 안쪽에 박힌 오브젝트까지 prop으로 내리려면
 * 중간 컴포넌트를 전부 거쳐야 해서 컨텍스트로 둔다.
 */
const PlayerPositionContext = createContext<{ current: Vector3 } | null>(null);

export const PlayerPositionProvider = PlayerPositionContext.Provider;

/**
 * 근접 판정 주기(ms). 매 프레임 재지 않는다 — useFrame에서 setState는 금지고
 * (.claude/rules/r3f.md), 켜졌다/꺼졌다만 알면 되는 값이라 100ms면 충분히 촘촘하다.
 * RoomCanvas가 기억 근접을 재는 주기와 같은 값이다.
 */
export const NEAR_POLL_MS = 100;

export function isWithin(
  player: { x: number; z: number },
  x: number,
  z: number,
  radius: number,
): boolean {
  return (player.x - x) ** 2 + (player.z - z) ** 2 <= radius ** 2;
}

/**
 * 플레이어가 (x, z) 반경 안에 들어와 있는가.
 *
 * 기억 오브젝트는 삼각형 + 고리 표식으로 "여기 뭔가 있다"를 알리지만, 커튼이나
 * 전등 스위치 같은 곁가지 인터랙션까지 표식을 달면 방이 표지판밭이 된다.
 * 대신 가까이 갔을 때만 은은히 빛나게 해서, 다가간 사람에게만 보이게 한다.
 *
 * 좌표를 배열이 아니라 x·z 낱개로 받는다 — 배열 리터럴을 넘기면 렌더마다 참조가
 * 바뀌어 effect가 매번 다시 걸린다.
 */
export function useNearPlayer(x: number, z: number, radius: number): boolean {
  const positionRef = useContext(PlayerPositionContext);
  const [near, setNear] = useState(false);

  useEffect(() => {
    if (positionRef === null) return;
    const check = () => {
      const inside = isWithin(positionRef.current, x, z, radius);
      setNear((current) => (current === inside ? current : inside));
    };
    check();
    const timer = window.setInterval(check, NEAR_POLL_MS);
    return () => window.clearInterval(timer);
  }, [positionRef, x, z, radius]);

  return near;
}
