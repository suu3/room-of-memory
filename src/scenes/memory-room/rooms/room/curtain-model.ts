import type { Vec3Tuple } from "../../world/types";
import type { CurtainSide } from "./curtain-motion";

/*
 * 커튼 glb(room-curtain)의 규약과 실측.
 *
 * 커튼은 침대 이불(bed.ts의 shape key `folded`)과 같은 방식으로 **shape key로 여닫는다**.
 * 파일에는 닫힌 자세(Basis)와 젖힌 자세(shape key `open`)가 들어 있고, 코드는 젖힘
 * 진행도(curtain-motion의 0~1)를 그 influence에 그대로 쓴다. 천을 옮기는 코드는 없다.
 * 그래서 블렌더에서 만든 커튼으로 바꿔 끼워도 이름 규약만 지키면 코드는 그대로다
 * (docs/model-export.md > Shape key로 여닫는 부품).
 *
 * 파일 규약:
 *  - 노드 `left` · `right`: 창 왼쪽·오른쪽 커튼 한 장씩. 재질이 없어 CurtainCloth가
 *    팔레트 fabric을 입힌다. COLOR_0이 있으면 머리단·밑단 음영으로 곱한다.
 *  - 두 노드 모두 shape key `open`: 0이면 닫혀 창을 덮고, 1이면 바깥쪽 끝에 뭉쳐 창이
 *    드러난다. 바깥쪽 매달린 끝은 두 자세에서 같은 자리다 (커튼봉 끝에 걸려 있다).
 *  - 원점: 창 가운데 x, **밑단 y=0**, 천 두께의 z 중심. 지금 파일은 scripts/assets/create-curtain.mjs가
 *    만들고, 그 스크립트가 아래 실측을 출력한다.
 */

/** 커튼 천이 걸리는 z. 뒷벽(z=-3.88) 앞이고, 잡는 판정 평면과 다가감 판정이 함께 본다. */
export const CURTAIN_Z = -3.72;

/** glb 노드 이름 = 쪽 이름. */
export const CURTAIN_MODEL_PARTS: readonly CurtainSide[] = ["left", "right"];

/** 게임이 찾는 shape key 이름. 0=닫힘, 1=젖힘. */
export const CURTAIN_OPEN_KEY = "open";

/** 모델 실측 (월드 단위, 배율 1). create-curtain.mjs의 "놓는 자리" 출력값. */
const CURTAIN_MODEL = {
  /** 원점 x가 놓이는 창 가운데. */
  windowCenterX: 1.15,
  /** 밑단(y=0)이 오는 높이. 머리단이 커튼봉(3.98) 바로 밑에 온다. */
  hemY: 0.998,
  /** 천 두께 중심이 CURTAIN_Z에서 앞으로 나온 만큼. */
  zCenter: 0.078,
} as const;

/** 모델 원점을 놓는 월드 좌표. 양쪽 커튼이 한 파일이라 두 쪽이 같은 자리에 붙는다. */
export const CURTAIN_MODEL_POSITION: Vec3Tuple = [
  CURTAIN_MODEL.windowCenterX,
  CURTAIN_MODEL.hemY,
  CURTAIN_Z + CURTAIN_MODEL.zCenter,
];
