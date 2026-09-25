import { create } from "zustand";

/**
 * 시각 효과의 살림살이. 게임 진행(memory-room)과 다른 축이라 따로 둔다.
 *
 * `degraded`는 RoomCanvas의 PerformanceMonitor가 프레임이 떨어졌다고 판단해 배율
 * 상한을 내린 상태다. 캔버스 밖(미니게임 DOM)도 이 값을 봐야 하므로 상태로 올린다.
 * 저장하지 않는다: 기기 상태이지 진행이 아니다.
 */
interface EffectsState {
  degraded: boolean;
  setDegraded: (degraded: boolean) => void;
}

export const useEffectsStore = create<EffectsState>()((set) => ({
  degraded: false,
  setDegraded: (degraded) => set((state) => (state.degraded === degraded ? state : { degraded })),
}));
