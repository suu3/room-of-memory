import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * 3D로 집어 본 물건을 그 순간 찍어 둔 정지 그림 (src/lib/still-capture.ts).
 *
 * 쪽지·출입증·앰플처럼 3D 판으로 살펴보는 조사는 미리 그린 스틸(replayStill)이 없다.
 * 찾을 것을 보고 내려놓는 순간의 판을 한 장으로 찍어, 결과 대사 동안 판 대신 세우고
 * 수첩 카드와 다시보기에도 같은 한 장을 쓴다. 출입증처럼 언어마다 글자가 다른 물건도
 * 플레이어가 본 그대로 남는다.
 *
 * 진행(rom-progress)과 따로 저장한다. 그림 한 장이 수십 KB라 진행 저장본에 섞으면
 * 대사 한 줄 넘길 때마다 그 덩어리를 다시 쓴다. 새 게임(reset)에서는 같이 비운다.
 */
interface StillState {
  /** 키는 stillKeyOf의 값. 값은 JPEG data URL. */
  stills: Record<string, string>;
  putStill: (key: string, dataUrl: string) => void;
  clearStills: () => void;
}

/** 기억 한 차수의 키. 같은 물건이라도 차수가 다르면 본 것이 다르다. */
export const stillKeyOf = (memoryId: string, visit: number) => `${memoryId}:${visit}`;

/** 책상 위 문제집 (기억이 아니라 단서): 이름 대사가 그 위에 흐른다 (PlaybackScene). */
export const WORKBOOK_STILL_KEY = "clue:workbook";

export const useStillStore = create<StillState>()(
  persist(
    (set) => ({
      stills: {},
      putStill: (key, dataUrl) => set((state) => ({ stills: { ...state.stills, [key]: dataUrl } })),
      clearStills: () => set({ stills: {} }),
    }),
    {
      name: "rom-stills",
      /*
       * 용량이 차서 쓰기가 실패해도 게임은 멈추지 않는다. 그림은 이번 판 동안 메모리에
       * 남아 있고, 다음에 열면 아이콘 판으로 돌아갈 뿐이다.
       */
      storage: createJSONStorage(() => ({
        getItem: (name) => {
          try {
            return localStorage.getItem(name);
          } catch {
            return null;
          }
        },
        setItem: (name, value) => {
          try {
            localStorage.setItem(name, value);
          } catch {
            // 용량 초과·사생활 보호 모드: 저장만 건너뛴다
          }
        },
        removeItem: (name) => {
          try {
            localStorage.removeItem(name);
          } catch {
            // 위와 같다
          }
        },
      })),
    },
  ),
);
