"use client";

import { useEffect, useRef } from "react";
import { signalSilence } from "@/data/story-phase";
import { selectSignalSilenceRunning, useMemoryRoomStore } from "@/store/memory-room";

/**
 * 과거편에서 돌아와 라디오가 저 혼자 깨어나기까지의 정적(ms).
 *
 * 고정 정지가 아니라 조작을 돌려준 채 기다리는 시간이다. 3초를 넘게 멈춰 세우면 멈춘
 * 게임으로 읽히지만, 걸어 다닐 수 있는 방에서의 9초는 가라앉는 시간으로 읽힌다.
 */
const SIGNAL_SILENCE_MS = 9000;
/**
 * 정적 중에 뭔가를 만졌을 때, 그 뒤 신호가 잡히기까지(ms). 만진 물건이 흘린 혼잣말이
 * 다 사라지기 전에 치지직이 끼어든다: 도해의 생각을 라디오가 끊는 자리다.
 */
const SIGNAL_AFTER_TOUCH_MS = 2500;

/**
 * 분기점의 정적을 재다가 라디오에 신호를 잡아 준다 (store의 catchSignal).
 *
 * 대사·컷씬·메뉴가 떠 있는 동안은 재지 않고 남은 시간을 들고 있는다. 방을 만지면
 * (혼잣말 · 전등 · 앉기) 남은 시간이 짧아진다. 아무것도 그리지 않는다.
 */
export function SignalCatch() {
  const running = useMemoryRoomStore(selectSignalSilenceRunning);
  const catchSignal = useMemoryRoomStore((state) => state.catchSignal);
  /** 남은 정적. 정적이 끝나면(신호가 잡히거나 리셋) 처음 값으로 돌아간다 */
  const remainingRef = useRef(SIGNAL_SILENCE_MS);

  useEffect(() => {
    if (!running) return;
    let deadline = Date.now() + remainingRef.current;
    let timer = window.setTimeout(catchSignal, remainingRef.current);

    const shorten = () => {
      const next = Math.min(deadline, Date.now() + SIGNAL_AFTER_TOUCH_MS);
      if (next === deadline) return;
      deadline = next;
      window.clearTimeout(timer);
      timer = window.setTimeout(catchSignal, deadline - Date.now());
    };
    const unsubscribe = useMemoryRoomStore.subscribe((state, previous) => {
      if (
        state.remark !== previous.remark ||
        state.lightsOn !== previous.lightsOn ||
        state.seatedAt !== previous.seatedAt
      )
        shorten();
    });

    return () => {
      unsubscribe();
      window.clearTimeout(timer);
      remainingRef.current = Math.max(0, deadline - Date.now());
    };
  }, [running, catchSignal]);

  // 신호가 잡혔거나 리셋으로 정적 밖에 나가면 다음 정적은 처음부터 잰다
  const silence = useMemoryRoomStore(signalSilence);
  useEffect(() => {
    if (!silence) remainingRef.current = SIGNAL_SILENCE_MS;
  }, [silence]);

  return null;
}
