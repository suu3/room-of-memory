"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { hotspotStatus, useMemoryRoomStore } from "@/store/memory-room";

/** 한 줄이 떠 있는 시간(ms). DoorNudge와 같은 박자: 스치는 혼잣말이다. */
const SHOW_MS = 4200;

/**
 * 거실에 있는 동안 방의 물건이 켜졌다고 알리는 한 줄
 * (docs/content-design.md 4-3).
 *
 * 2막에서 나갈 준비를 마치면(냉장고·가방) 방의 액자가 열린다. 그런데 그때
 * 플레이어는 거실에 있어서 금빛이 켜지는 걸 볼 수가 없다. 한 번에 한 방만
 * 보이기 때문이다.
 *
 * 화면을 덮지 않고, 화살표도 그리지 않는다. 모달이나 지시선은 심부름표가 되고,
 * 2막의 첫 직면이 플레이어의 결정이 아니라 안내에 따른 이동이 된다. 도해가
 * 스스로 떠올린 것처럼 들려야 한다. 그래서 DoorNudge와 같은 자리·같은 문법의
 * 혼잣말 한 줄이다.
 */
export function RoomCallout() {
  const { t } = useTranslation();
  const inLivingRoom = useMemoryRoomStore((state) => state.inLivingRoom);
  /*
   * 액자가 방금 열렸는가. hotspotStatus를 그대로 쓴다. 해금 조건(냉장고·가방)을
   * 여기서 따로 세면 YAML의 unlockAfter와 두 벌이 되고, 둘이 어긋나면 있지도 않은
   * 물건을 보러 방으로 돌려보내게 된다.
   */
  const frameReady = useMemoryRoomStore((state) => hotspotStatus(state, "frame") === "available");
  const armed = frameReady && inLivingRoom;
  const [shown, setShown] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // 한 번만 뜬다. 거실에 드나들 때마다 다시 뜨면 재촉이 된다.
    if (!armed || shown) return;
    setShown(true);
    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), SHOW_MS);
    return () => window.clearTimeout(timer);
  }, [armed, shown]);

  if (!visible) return null;

  return (
    <p className="monologue-text pointer-events-none absolute bottom-20 left-1/2 z-10 w-full max-w-xl -translate-x-1/2 animate-fade-rise break-ko text-pretty px-4 text-center font-pixel text-lg leading-normal text-memory">
      {t("callout.frame")}
    </p>
  );
}
