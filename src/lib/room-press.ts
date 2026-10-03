import type { DoorwayId } from "@/data/spaces";
import { playSound } from "@/lib/audio";
import {
  selectBatReady,
  selectDoorReady,
  selectDoorwayOpen,
  selectDoorwayReady,
  selectExitReady,
  selectSinkHintRead,
  useMemoryRoomStore,
} from "@/store/memory-room";

/**
 * 방의 물건을 누른다 (기억이 아닌 것: 문 · 전등 스위치). 씬의 3D 물건과 화면 밖 목록
 * (RoomInteractionPrompt)이 같은 길을 탄다: 마우스로 집을 수 없는 사람도 같은 소리와
 * 같은 결과를 얻는다.
 */

/**
 * 문을 누른다.
 *
 * 열 수 있으면 연다. 아직이면 거절음이 나고, 방문은 안 여는 이유를 한 줄 흘린다
 * (RemarkLine). 이미 열린 문은 아무 일도 없다.
 */
export function pressDoor(id: DoorwayId): void {
  const state = useMemoryRoomStore.getState();
  if (selectDoorwayOpen(id)(state)) return;
  if (id === "room-living") {
    if (selectDoorReady(state)) {
      playSound("doorOpen");
      state.openRoomDoor();
      return;
    }
    playSound("deny");
    state.nudgeDoor();
    return;
  }
  if (!selectDoorwayReady(id)(state)) {
    playSound("deny");
    return;
  }
  playSound("doorOpen");
  state.openDoorway(id);
}

/** 전등 스위치를 누른다. 딸깍은 조작음이라 방 밝기와 무관하게 늘 같은 크기로 울린다. */
export function pressLightSwitch(): void {
  playSound("lightSwitch");
  useMemoryRoomStore.getState().toggleLights();
}

/** 세면대 마개를 뽑는다. 이미 뽑았으면 아무 일도 없다. */
export function pressSinkPlug(): void {
  const state = useMemoryRoomStore.getState();
  if (state.sinkDrained) return;
  playSound("drawer");
  state.drainSink();
}

/** 세면대 하부장을 누른다. 아빠 메일의 힌트를 읽기 전에는 거절음과 한 줄뿐이다. */
export function pressSinkCabinet(): void {
  const state = useMemoryRoomStore.getState();
  if (state.solvedPuzzles.includes("sink-dial")) return;
  if (selectSinkHintRead(state)) {
    playSound("open");
    state.openPuzzle("sink-dial");
    return;
  }
  playSound("deny");
  state.sayRemark("sink-locked");
}

/** 현관의 배트를 쥔다. 떠나기로 하기 전(resolve 전)이거나 이미 쥐었으면 아무 일도 없다. */
export function pressBat(): void {
  const state = useMemoryRoomStore.getState();
  if (!selectBatReady(state)) return;
  playSound("collect");
  state.takeBat();
}

/** 현관문을 연다. 챙길 것을 다 챙기기 전에는 거절음만 난다. */
export function pressFrontDoor(): void {
  const state = useMemoryRoomStore.getState();
  if (state.endingStarted) return;
  if (!selectExitReady(state)) {
    playSound("deny");
    return;
  }
  playSound("doorOpen");
  state.startEnding();
}
