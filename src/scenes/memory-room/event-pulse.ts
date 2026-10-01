import { selectRadioSignaling, useMemoryRoomStore } from "@/store/memory-room";

/**
 * 화면 전체가 반응하는 사건과 그 세기 (0~1).
 *
 * 색수차(FilmLook), 그레인, 카메라(CameraRig)가 같은 사건에 같은 세기로 반응한다.
 * 호출부마다 심는 대신 스토어 변화를 한곳에서 듣는다 (audio의 collect와 같은 자리).
 * 라디오가 깨어나는 순간이 기억 하나를 줍는 순간보다 크다.
 * 수집은 1차(collected)와 2차(revisited)가 같다: 금빛 티끌(MemoryBurst)·수집 소리와 같은 범위다.
 */
export const EVENT_PULSE = {
  collect: 0.6,
  radioWake: 1,
} as const;

/** 사건이 날 때마다 세기를 넘긴다. 돌려주는 함수로 구독을 끊는다. */
export function subscribeEventPulse(onPulse: (strength: number) => void): () => void {
  return useMemoryRoomStore.subscribe((state, previous) => {
    if (
      state.collected.length > previous.collected.length ||
      state.revisited.length > previous.revisited.length
    ) {
      onPulse(EVENT_PULSE.collect);
    }
    if (selectRadioSignaling(state) && !selectRadioSignaling(previous)) {
      onPulse(EVENT_PULSE.radioWake);
    }
  });
}
