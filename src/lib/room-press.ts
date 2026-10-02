import type { DoorwayId } from "@/data/spaces";
import { playSound } from "@/lib/audio";
import {
  selectDoorReady,
  selectDoorwayOpen,
  selectDoorwayReady,
  useMemoryRoomStore,
} from "@/store/memory-room";

/**
 * 문을 누른다. 씬의 문짝(RoomShell · SpaceDoor)과 화면 밖 목록(RoomInteractionPrompt)이
 * 같은 길을 탄다: 마우스로 문을 집을 수 없는 사람도 같은 소리와 같은 결과를 얻는다.
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
