import { MEMORY_IDS, type MemoryId } from "@/data/memory-room";
import type { HotspotStatus } from "@/store/memory-room";

interface RoomInteractionPromptProps {
  nearbyMemoryId: MemoryId | null;
  nearbyLabel: string;
  /** 버튼에 읽힐 이름. 조사할 수 없는 물건은 이유까지 담긴 문구가 온다. */
  labels: Record<MemoryId, string>;
  statuses: Record<MemoryId, HotspotStatus>;
  onInteract: (id: MemoryId) => void;
}

/**
 * 방 안의 물건을 이름으로 조사하는 목록. 화면에는 안 보이고 스크린리더·키보드에만
 * 있다 — 3D 공간을 걸어 다니지 않고도 모든 물건에 닿을 수 있어야 하기 때문이다.
 *
 * 조사할 수 없는 물건도 목록에서 지우지 않는다. 이름 뒤에 이유(잠김·조사 완료)를
 * 붙여 두는 편이, 물건이 소리 없이 사라져 "여긴 아무것도 없다"로 들리는 것보다 낫다.
 */
export function RoomInteractionPrompt({
  nearbyMemoryId,
  nearbyLabel,
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

      <fieldset className="sr-only">
        {MEMORY_IDS.map((id) => (
          <button
            key={id}
            type="button"
            disabled={statuses[id] !== "available"}
            onClick={() => onInteract(id)}
          >
            {labels[id]}
          </button>
        ))}
      </fieldset>
    </>
  );
}
