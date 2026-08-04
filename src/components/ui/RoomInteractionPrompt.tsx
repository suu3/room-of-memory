import { MEMORY_IDS, type MemoryId } from "@/data/memory-room";

interface RoomInteractionPromptProps {
  nearbyMemoryId: MemoryId | null;
  nearbyLabel: string;
  labels: Record<MemoryId, string>;
  availableIds: readonly MemoryId[];
  onInteract: (id: MemoryId) => void;
}

export function RoomInteractionPrompt({
  nearbyMemoryId,
  nearbyLabel,
  labels,
  availableIds,
  onInteract,
}: RoomInteractionPromptProps) {
  return (
    <>
      {nearbyMemoryId ? (
        <div className="pointer-events-none absolute bottom-6 left-1/2 z-20 max-w-[calc(100vw-2rem)] -translate-x-1/2 break-ko text-pretty rounded-lg border-2 border-bone bg-paper px-4 py-2 text-center text-xs font-medium tracking-wider text-ink shadow-chip">
          {nearbyLabel}
        </div>
      ) : null}

      <fieldset className="sr-only">
        {MEMORY_IDS.map((id) => (
          <button
            key={id}
            type="button"
            disabled={!availableIds.includes(id)}
            onClick={() => onInteract(id)}
          >
            {labels[id]}
          </button>
        ))}
      </fieldset>
    </>
  );
}
