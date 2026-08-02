"use client";

import type { ThreeEvent } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * 클릭 가능한 3D 오브젝트의 마우스 호버 상태 + 포인터 커서.
 * `clickable`이 false면 호버해도 빛나지 않고 커서도 바뀌지 않는다.
 */
export function useGlowHover(clickable: boolean) {
  const [pointerInside, setPointerInside] = useState(false);
  const hovered = pointerInside && clickable;

  useEffect(() => {
    if (!hovered) return;
    const previous = document.body.style.cursor;
    document.body.style.cursor = "pointer";
    return () => {
      document.body.style.cursor = previous;
    };
  }, [hovered]);

  const onPointerOver = useCallback((event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    setPointerInside(true);
  }, []);
  const onPointerOut = useCallback(() => setPointerInside(false), []);

  return useMemo(
    () => ({ hovered, handlers: { onPointerOver, onPointerOut } }),
    [hovered, onPointerOver, onPointerOut],
  );
}
