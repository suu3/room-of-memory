"use client";

import type { ThreeEvent } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Object3D } from "three";
import { playSound } from "@/lib/audio";
import { clearCursorTargetObject, setCursorTargetObject } from "./cursor-target";

/**
 * 클릭 가능한 3D 오브젝트의 마우스 호버 상태 + 포인터 커서.
 * `clickable`이 false면 호버해도 빛나지 않고 커서도 바뀌지 않는다.
 *
 * 켜지는 동안 그 오브젝트를 cursor-target에 올려 둔다. 커스텀 커서의 링이 그리로
 * 빨려들고, 윤곽선이 한 번 밝아진다 (MemoryOutlineGlow).
 */
export function useGlowHover(clickable: boolean) {
  const [pointerInside, setPointerInside] = useState(false);
  const hovered = pointerInside && clickable;
  /** 핸들러가 붙은 오브젝트(eventObject). 커서가 빨려들 자리를 재는 데 쓴다. */
  const targetRef = useRef<Object3D | null>(null);

  // 호버가 켜지는 순간에만 소리: 커서가 오브젝트 위에서 떨어도 다시 울리지 않는다
  useEffect(() => {
    if (!hovered) return;
    playSound("hover");
    const previous = document.body.style.cursor;
    document.body.style.cursor = "pointer";
    const target = targetRef.current;
    if (target) setCursorTargetObject(target);
    return () => {
      document.body.style.cursor = previous;
      if (target) clearCursorTargetObject(target);
    };
  }, [hovered]);

  const onPointerOver = useCallback((event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    targetRef.current = event.eventObject;
    setPointerInside(true);
  }, []);
  const onPointerOut = useCallback(() => setPointerInside(false), []);

  return useMemo(
    () => ({ hovered, handlers: { onPointerOver, onPointerOut } }),
    [hovered, onPointerOver, onPointerOut],
  );
}
