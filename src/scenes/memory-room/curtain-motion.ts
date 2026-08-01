export type CurtainSide = "left" | "right";

export const CURTAIN_X = {
  left: { closed: 0.22, open: -0.55 },
  right: { closed: 2.08, open: 2.85 },
} as const;

export function curtainTargetX(side: CurtainSide, open: boolean) {
  return CURTAIN_X[side][open ? "open" : "closed"];
}
