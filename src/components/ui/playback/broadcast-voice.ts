import type { CutsceneCut } from "@/types/interaction";

/**
 * 재난 방송의 목소리가 지금 어디에 서 있는가.
 *
 * 목소리는 줄마다 끊어 틀지 않는다. 자동 반복 송출이라 읽는 속도와 상관없이 제 박자로
 * 흐르고, 방송 줄이 처음 뜨는 순간 한 번 걸려 그 컷이 서 있는 동안 이어진다. 방송이 아닌
 * 줄(도해의 "…맞아. 그날이었다.")이 뜨면 꺼지는 게 아니라 뒤로 물러난다. 컷이 넘어가면
 * 끊긴다.
 *
 * - `off`: 방송이 없는 컷이거나, 아직 방송 줄에 닿지 않았다
 * - `front`: 방송이 말하는 중
 * - `behind`: 방송은 계속 흐르지만 지금 줄은 다른 사람의 말이다
 */
export type BroadcastAiring = "off" | "front" | "behind";

const BROADCAST_SPEAKER = "broadcast";

export function carriesBroadcast(cut: Pick<CutsceneCut, "lines"> | undefined): boolean {
  return cut?.lines.some((line) => line.speaker === BROADCAST_SPEAKER) === true;
}

export function broadcastAiring(
  cut: Pick<CutsceneCut, "lines"> | undefined,
  lineIndex: number,
): BroadcastAiring {
  if (!cut) return "off";
  const first = cut.lines.findIndex((line) => line.speaker === BROADCAST_SPEAKER);
  if (first < 0 || lineIndex < first) return "off";
  return cut.lines[lineIndex]?.speaker === BROADCAST_SPEAKER ? "front" : "behind";
}
