/**
 * 앉을 수 있는 자리의 id.
 *
 * 스토어(누가 어디에 앉아 있는가)와 씬(그 자리가 방 어디인가)이 함께 보는 이름이라
 * 타입만 여기 둔다. 좌면 높이·방향 같은 3D 값은 `src/scenes/memory-room/seats.ts`가 갖는다.
 */
export type SeatId =
  | "desk-chair"
  | "sofa-left"
  | "sofa-center"
  | "sofa-right"
  | "dining-window"
  | "dining-door"
  | "dining-pulled"
  | "piano-bench"
  | "bed";
