import { create } from "zustand";

interface MemoryRoomState {
  collected: string[];
  collect: (id: string) => void;
  reset: () => void;
}

export const useMemoryRoomStore = create<MemoryRoomState>()((set) => ({
  collected: [],
  collect: (id) =>
    set((state) =>
      state.collected.includes(id) ? state : { collected: [...state.collected, id] },
    ),
  reset: () => set({ collected: [] }),
}));

export const selectCollected = (state: MemoryRoomState) => state.collected;
export const selectCount = (state: MemoryRoomState) => state.collected.length;
