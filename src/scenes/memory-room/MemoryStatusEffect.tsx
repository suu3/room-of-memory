import type { hotspotStatus } from "@/store/memory-room";

export function MemoryStatusEffect({
  status,
  memoryColor,
  interactionRadius,
}: {
  status: ReturnType<typeof hotspotStatus>;
  memoryColor: string;
  interactionRadius: number;
}) {
  if (status !== "done") return null;

  return (
    <mesh>
      <torusGeometry args={[interactionRadius * 0.52, 0.025, 8, 32]} />
      <meshStandardMaterial
        color={memoryColor}
        emissive={memoryColor}
        emissiveIntensity={0.2}
        opacity={0.62}
        transparent
      />
    </mesh>
  );
}
