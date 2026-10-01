import type { PointerEvent as ReactPointerEvent } from "react";
import { playSound } from "@/lib/audio";

/**
 * DOM 버튼에 커서가 얹히는 순간의 소리. 3D 오브젝트의 호버(useGlowHover)와 같은 샘플이라
 * 화면 안팎이 같은 손맛으로 이어진다.
 *
 * 손가락은 "얹히지" 않는다. 터치는 pointerenter가 탭과 같은 순간에 오므로 여기서
 * 울리면 클릭 소리와 겹쳐 두 번 난다. 마우스·펜에서만 운다.
 */
export function playHoverSound(event: ReactPointerEvent<Element>) {
  if (event.pointerType === "touch") return;
  playSound("hover");
}
