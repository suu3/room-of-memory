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
        sr-only는 fieldset이 아니라 **감싼 div**에 건다. 상자를 1px로 눌러도 fieldset은
        그만큼 작아지지 않는다: 기본 min-inline-size가 min-content라 가로로 버튼 줄만큼
        벌어지고(1100px 화면에서 1500px), legend는 크롬에서 상자 **밖**에 그려져 세로로
        23px이 더 붙는다. 둘 다 바깥 컨테이너의 스크롤 영역을 늘린다.

        그게 왜 문제인가: 방을 담은 상자는 h-dvh + overflow-hidden이라 스크롤바가 없지만,
        넘치는 만큼은 **프로그램으로 굴러간다**. 어딘가에서 scrollIntoView나 focus가 한 번
        일어나면 게임 화면 전체가 그만큼 밀린 채 남고, 되돌릴 손잡이가 없다 (예전에 가로로
        잘려 보이던 것도, 대사 로그를 닫으면 HUD가 위로 올라가던 것도 같은 이유다).

        1px짜리 div가 overflow:hidden으로 실제로 자르므로, 안쪽 fieldset이 얼마나 벌어지든
        바깥에는 1px만 보인다. legend는 그대로 남아 목록 이름을 읽어 준다.
      */}
      <div className="sr-only">
        <fieldset>
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
      </div>
    </>
  );
}
