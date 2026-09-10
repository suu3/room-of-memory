/**
 * 커튼의 어느 쪽인가.
 *
 * 스토어(누가 어느 쪽을 잡고 있는가)와 씬(그 쪽이 어디로 젖혀지는가)이 함께 보는
 * 이름이라 타입만 여기 둔다. 좌표·진행도 계산은 `src/scenes/memory-room/curtain-motion.ts`.
 */
export type CurtainSide = "left" | "right";
