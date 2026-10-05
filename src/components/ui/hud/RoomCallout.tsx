"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { hotspotStatus, useMemoryRoomStore } from "@/store/memory-room";

/** 한 줄이 떠 있는 시간(ms). RemarkLine과 같은 박자: 스치는 혼잣말이다. */
const SHOW_MS = 4200;

/**
 * 거실에 있는 동안 방의 물건이 켜졌다고 알리는 한 줄
 * (docs/story/content-design.md 4-3).
 *
 * 4페이즈에 안방의 서류와 출입증을 보고 나면 방의 액자가 열린다 (액자 2차). 그런데
 * 그때 플레이어는 방 밖에 있어서 금빛이 켜지는 걸 볼 수가 없다. 한 번에 한 방만
 * 보이기 때문이다.
 *
 * 화면을 덮지 않고, 화살표도 그리지 않는다. 모달이나 지시선은 심부름표가 되고,
 * 2막의 첫 직면이 플레이어의 결정이 아니라 안내에 따른 이동이 된다. 도해가
 * 스스로 떠올린 것처럼 들려야 한다. 그래서 RemarkLine과 같은 자리·같은 문법의
 * 혼잣말 한 줄이다.
 */
export function RoomCallout() {
  const { t } = useTranslation();
  // 방 밖 어디에 있든 방의 물건이 켜진 건 안 보인다. 거실이든 화장실이든 같다
  const awayFromRoom = useMemoryRoomStore((state) => state.space !== "room");
  /*
   * 액자가 방금 열렸는가. hotspotStatus를 그대로 쓴다. 해금 조건(서류·출입증)을
   * 여기서 따로 세면 YAML의 unlockAfter와 두 벌이 되고, 둘이 어긋나면 있지도 않은
   * 물건을 보러 방으로 돌려보내게 된다.
   */
  const frameReady = useMemoryRoomStore((state) => hotspotStatus(state, "frame") === "available");
  const armed = frameReady && awayFromRoom;
  const shownRef = useRef(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // 한 번만 뜬다. 거실에 드나들 때마다 다시 뜨면 재촉이 된다.
    if (!armed || shownRef.current) return;
    shownRef.current = true;
    setVisible(true);
  }, [armed]);

  /*
   * 끄는 타이머는 따로 건다. 띄우는 effect 안에서 걸면 "떴다"는 표시가 바뀌는 순간 그
   * effect의 cleanup이 타이머를 지워, 한 줄이 엔딩까지 화면에 남았다 (2026-10-05).
   */
  useEffect(() => {
    if (!visible) return;
    const timer = window.setTimeout(() => setVisible(false), SHOW_MS);
    return () => window.clearTimeout(timer);
  }, [visible]);

  if (!visible) return null;

  return (
    <p className="monologue-text pointer-events-none absolute bottom-20 left-1/2 z-10 w-full max-w-xl -translate-x-1/2 animate-fade-rise break-ko text-pretty px-4 text-center font-pixel text-lg leading-normal text-memory">
      {t("callout.frame")}
    </p>
  );
}
