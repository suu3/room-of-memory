import type { ItemId } from "@/data/items";
import type { MemoryId } from "@/data/memory-room";
import type { DiscoveryId, PuzzleId } from "@/data/room-clues";
import { type EnterablePhase, progressAt } from "@/data/story-phase";
import { type DoorwayId, SPACE_IDS, SPACES, type SpaceId } from "@/scenes/memory-room/spaces";
import { sanitizeProgress, useMemoryRoomStore } from "@/store/memory-room";
import { cycleMemory } from "./admin-progress";

/** 방문을 여는 열쇠가 되는 기억: 이걸 되찾아야 문이 열린다 (sanitizeProgress). */
const DOOR_KEY_MEMORY = "radio" as MemoryId;

/** 어드민 패널이 한 번에 밀어 넣는 진행. 안 적은 항목은 지금 값을 그대로 둔다. */
export interface AdminPatch {
  collected?: MemoryId[];
  revisited?: MemoryId[];
  rechecked?: MemoryId[];
  doorOpened?: boolean;
  batTaken?: boolean;
  solvedPuzzles?: PuzzleId[];
  discoveries?: DiscoveryId[];
  endingStarted?: boolean;
  openedDoorways?: DoorwayId[];
  inventory?: ItemId[];
  started?: boolean;
}

/**
 * 진행을 통째로 갈아 끼운다.
 *
 * 스토어 액션을 안 거치고 setState로 직접 쓰되, **저장본을 걸러내는 그 함수를
 * 먼저 통과시킨다**. persist 계층이 새로고침 때 어차피 같은 함수를 돌리므로,
 * 여기서 미리 걸러 두지 않으면 패널로 만든 상태가 새로고침 한 번에 되돌아간다.
 * 화면에서 본 것과 다시 켰을 때의 것이 달라지는 게 개발 도구로서 제일 나쁘다.
 *
 * started는 저장 대상이 아니라 sanitizeProgress가 모르는 값이다. 걸러진 결과
 * 바깥에서 따로 얹는다.
 */
export function applyAdminPatch(patch: AdminPatch): void {
  const state = useMemoryRoomStore.getState();
  const { started, ...progress } = patch;

  const merged = {
    collected: state.collected,
    revisited: state.revisited,
    rechecked: state.rechecked,
    doorOpened: state.doorOpened,
    batTaken: state.batTaken,
    solvedPuzzles: state.solvedPuzzles,
    discoveries: state.discoveries,
    endingStarted: state.endingStarted,
    // 진행이 아니라 환경설정이지만, 걸러내는 함수가 통째로 받으므로 같이 넘겨야 안 지워진다
    soundMuted: state.soundMuted,
    lightsOn: state.lightsOn,
    difficulty: state.difficulty,
    introDone: state.introDone,
    doorwayDone: state.doorwayDone,
    openedDoorways: state.openedDoorways,
    inventory: state.inventory,
    ...progress,
  };

  useMemoryRoomStore.setState({
    ...sanitizeProgress(merged),
    ...(started === undefined ? {} : { started }),
  });
}

/**
 * 패널이 몸을 떨어뜨리는 자리. 공간 표의 landing을 그대로 쓴다: 게임의 미니맵 이동과
 * 같은 자리에 떨어져야 개발 중에 본 화면이 플레이 중에 보는 화면과 같다.
 */
export const ADMIN_SPAWNS = Object.fromEntries(
  SPACE_IDS.map((id) => [id, SPACES[id].landing]),
) as Record<SpaceId, { x: number; z: number }>;

export type AdminSpace = SpaceId;

/**
 * 방문을 열고 닫는다.
 *
 * `doorOpened: true`만 밀어 넣으면 아무 일도 안 일어난다. sanitizeProgress가 **라디오
 * 목소리를 들은 저장본에서만** 문을 열어 두기 때문이다(진짜 규칙이 그렇다). 그래서 문을
 * 열 때는 그 전제(라디오 1·2차)까지 같이 채운다. 패널의 기억 격자에 radio가 2로 켜지는
 * 것으로 무엇이 함께 채워졌는지 눈에 보인다.
 */
export function setAdminDoor(open: boolean): void {
  const { collected, revisited } = useMemoryRoomStore.getState();
  if (!open) {
    applyAdminPatch({ doorOpened: false });
    return;
  }
  applyAdminPatch({
    collected: collected.includes(DOOR_KEY_MEMORY) ? collected : [...collected, DOOR_KEY_MEMORY],
    revisited: revisited.includes(DOOR_KEY_MEMORY) ? revisited : [...revisited, DOOR_KEY_MEMORY],
    doorOpened: true,
  });
}

/**
 * 몸을 그 공간으로 옮긴다. 타이틀 화면에서 눌러도 한 번에 그 자리에 서 있게 된다.
 *
 * 게임을 같이 시작하는 이유: 안 그러면 워프는 됐는데 화면은 여전히 타이틀이라 아무 일도
 * 안 일어난 것처럼 보이고, 이어하기를 한 번 더 눌러야 한다.
 *
 * 거실로 갈 때는 방문도 같이 연다. 문이 닫혀 있으면 걷기 범위가 방 하나뿐이라
 * (Player의 CLOSED_ZONES) 거실 한복판에 떨어뜨려 놔도 한 발짝도 못 움직인다.
 * 개발 도구가 사람을 가둬 놓는 꼴이 된다.
 */
export function warpToSpace(space: AdminSpace): void {
  if (space !== "room") setAdminDoor(true);
  // 거실 너머로 갈 때는 그 문도 연다. 방문과 같은 이유: 닫힌 채 떨어뜨리면 못 나온다
  if (space === "bathroom") applyAdminPatch({ openedDoorways: ["living-bathroom"] });
  if (space === "parents") {
    // 안방 문은 열쇠가 연다 (src/data/doors.ts). 열쇠까지 쥐어 준다
    const { inventory } = useMemoryRoomStore.getState();
    applyAdminPatch({
      inventory: inventory.includes("parents-key") ? inventory : [...inventory, "parents-key"],
      openedDoorways: ["living-bathroom", "living-parents"],
    });
  }
  applyAdminPatch({ started: true });
  const spawn = ADMIN_SPAWNS[space];
  useMemoryRoomStore.getState().warpPlayer(spawn.x, spawn.z);
}

/** 기억 하나를 다음 단계로. 패널의 셀 클릭이 부른다. */
export function cycleAdminMemory(id: MemoryId): void {
  const { collected, revisited } = useMemoryRoomStore.getState();
  applyAdminPatch(cycleMemory({ collected, revisited }, id));
}

/** 건너뛸 수 있는 페이즈. intro는 새 게임, ending은 현관문을 눌러야 서니 뺀다. */
export const ADMIN_PHASES = [
  "p1",
  "turning",
  "p2",
  "p3",
  "p4",
  "resolve",
] as const satisfies readonly EnterablePhase[];

/**
 * 그 페이즈의 첫 순간으로 건너뛴다 (v4 설계서의 페이즈 표). 곁가지는 안 채운다.
 * 문·열쇠·하부장처럼 페이즈를 가르는 것도 같이 맞춘다 (src/data/story-phase.ts의 progressAt).
 */
export function jumpToPhase(phase: EnterablePhase): void {
  const { introDone, ...progress } = progressAt(phase);
  applyAdminPatch({
    ...progress,
    openedDoorways: progress.openedDoorways as DoorwayId[],
    inventory: progress.inventory as ItemId[],
    solvedPuzzles: progress.solvedPuzzles as PuzzleId[],
    batTaken: false,
    endingStarted: false,
    started: true,
  });
  useMemoryRoomStore.setState({ introDone, doorwayDone: progress.doorOpened, lightsOn: true });
}
