import { MEMORY_IDS, type MemoryId } from "@/data/memory-room";
import type { HotspotStatus } from "@/store/memory-room";

interface RoomInteractionPromptProps {
  nearbyMemoryId: MemoryId | null;
  nearbyLabel: string;
  /** 목록의 이름. 스크린리더가 "버튼 열세 개"가 아니라 "방 안의 물건" 목록으로 읽게. */
  legend: string;
  /** 버튼에 읽힐 이름. 조사할 수 없는 물건은 이유까지 담긴 문구가 온다. */
  labels: Record<MemoryId, string>;
  statuses: Record<MemoryId, HotspotStatus>;
  onInteract: (id: MemoryId) => void;
}

/**
 * 방 안의 물건을 이름으로 조사하는 목록. 화면에는 안 보이고 스크린리더·키보드에만
 * 있다. 3D 공간을 걸어 다니지 않고도 모든 물건에 닿을 수 있어야 하기 때문이다.
 *
 * 조사할 수 없는 물건도 목록에서 지우지 않는다. 이름 뒤에 이유(잠김·조사 완료)를
 * 붙여 두는 편이, 물건이 소리 없이 사라져 "여긴 아무것도 없다"로 들리는 것보다 낫다.
 */
export function RoomInteractionPrompt({
  nearbyMemoryId,
  nearbyLabel,
  legend,
  labels,
  statuses,
  onInteract,
}: RoomInteractionPromptProps) {
  return (
    <>
      {nearbyMemoryId ? (
        <div className="pointer-events-none absolute bottom-6 left-1/2 z-20 max-w-[calc(100vw-2rem)] -translate-x-1/2 break-ko text-pretty rounded-sm border border-line bg-surface px-3 py-1.5 text-center text-xs font-medium text-ivory shadow-chip">
          {nearbyLabel}
        </div>
      ) : null}

      {/*
        화면 밖의 목록이지만 진짜 버튼이다. onInteract는 RoomCanvas의 interact와 같아서
        3D 물건을 누른 것과 똑같이 조사가 시작된다. 걸어가서 만질 필요가 없다.
        조사할 수 없는 물건은 disabled가 아니라 aria-disabled로 둔다. disabled는
        포커스 순서에서 빠져 스크린리더 사용자가 그 물건이 있는지조차 모른다.
      */}
      {/*
        min-w-0: fieldset의 기본 min-inline-size는 min-content라, sr-only의 width:1px가
        먹지 않고 상자가 버튼 줄만큼 넓어진다 (1100px 화면에서 1500px). 그러면 화면 밖으로
        넘쳐서 바깥 컨테이너에 가로 스크롤이 생기고, 무언가 그 스크롤을 끝까지 밀면 게임
        화면 전체가 왼쪽으로 밀려 잘린다. 0으로 눌러야 overflow:hidden이 실제로 자른다.
      */}
      <fieldset className="sr-only min-w-0">
        <legend>{legend}</legend>
        {MEMORY_IDS.map((id) => {
          const available = statuses[id] === "available";
          return (
            <button
              key={id}
              type="button"
              aria-disabled={!available}
              onClick={() => {
                if (available) onInteract(id);
              }}
            >
              {labels[id]}
            </button>
          );
        })}
      </fieldset>
    </>
  );
}
