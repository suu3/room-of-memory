import { create } from "zustand";
import type { MemoryId } from "@/data/memory-room";

interface MemoryRoomState {
  collected: MemoryId[];
  collect: (id: MemoryId) => void;
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
