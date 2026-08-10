"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { selectDoorReady, useMemoryRoomStore } from "@/store/memory-room";

/** 한 줄이 떠 있는 시간(ms). 읽고 한 박자 쉴 만큼 — 대사창이 아니라 스치는 혼잣말이다. */
const SHOW_MS = 3200;

/**
 * 닫힌 방문을 눌렀을 때 흐르는 한 줄 (docs/content-design.md 3-1).
 *
 * 1막 내내 문이 안 열리는 이유를 말하는 자리다: 잠긴 게 아니라 **안 여는** 것.
 * 라디오 목소리를 들은 뒤에는 여기 오지 않는다 — 그때부터는 같은 클릭이 문을
 * 연다 (RoomShell). 남은 줄은 문이 켜진 직후 한 박자 망설이는 순간의 것이다.
 */
export function DoorNudge() {
  const { t } = useTranslation();
  const nudgedAt = useMemoryRoomStore((state) => state.doorNudgedAt);
  const doorReady = useMemoryRoomStore(selectDoorReady);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (nudgedAt === 0) return;
    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), SHOW_MS);
    return () => window.clearTimeout(timer);
  }, [nudgedAt]);

  if (!visible) return null;

  return (
    <p
      // 두드릴 때마다 새로 떠오른다 — key가 바뀌어야 애니메이션이 다시 돈다
      key={nudgedAt}
      className="pointer-events-none absolute bottom-20 left-1/2 z-10 w-full max-w-xl -translate-x-1/2 animate-fade-rise break-ko text-pretty px-4 text-center font-pixel text-lg text-fog"
    >
      「 {t(doorReady ? "door.nudgeBat" : "door.nudgeStay")} 」
    </p>
  );
}
