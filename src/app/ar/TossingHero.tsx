"use client";

import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { Box3, type Group, type Object3D, Quaternion, Vector3 } from "three";
import { ASSETS } from "@/lib/assets";
import {
  createPlayerRig,
  disposePlayerRig,
  reachBone,
  startPlayerRig,
  updatePlayerRig,
} from "@/scenes/memory-room/player-animation";

/*
 * 공을 위로 던졌다 받는 도해 (AR 카드 위).
 *
 * 던지는 클립이 없어서 Idle 위에 오른팔을 코드로 얹는다 (player-animation의 커튼 팔과 같은
 * 방식: 믹서가 끝난 뒤 뼈를 돌린다). 공은 매 프레임 오른손 위치에서 포물선 높이만큼 띄운다.
 */

/** 한 번 던지고 받는 데 걸리는 시간(s). */
const TOSS_PERIOD = 1.5;
/** 손을 떠나는/돌아오는 순간 (주기 비율). */
const RELEASE = 0.1;
const CATCH = 0.86;
/** 손 위로 올라가는 높이 (모델 단위, 키 1.55). */
const TOSS_HEIGHT = 0.62;
/** 공을 받쳐 드는 기본 자세: 팔을 앞으로 들고 팔꿈치를 굽힌다. 음수가 앞쪽. */
const HOLD_UPPER = -0.55;
const HOLD_FORE = -1.25;
/** 던질 때 손목을 튕기듯 팔이 더 올라가는 양, 받을 때 살짝 내려앉는 양. */
const FLICK = -0.45;
const CATCH_DIP = 0.18;
/** 공 지름 (모델 단위). 실제 비율보다 키워야 카드 위에서 보인다. */
const BALL_SIZE = 0.16;
/** 손바닥 위에 얹히도록 손 뼈에서 띄우는 높이. */
const PALM_LIFT = 0.07;

const handWorld = new Vector3();
const ballBox = new Box3();
const ballSize = new Vector3();

function armOffset(phase: number) {
  if (phase < RELEASE) return FLICK * Math.sin((Math.PI * phase) / RELEASE);
  if (phase > CATCH) return CATCH_DIP * Math.sin((Math.PI * (phase - CATCH)) / (1 - CATCH));
  return 0;
}

function ballLift(phase: number) {
  if (phase < RELEASE || phase > CATCH) return 0;
  const s = (phase - RELEASE) / (CATCH - RELEASE);
  return 4 * TOSS_HEIGHT * s * (1 - s);
}

export function TossingHero() {
  const groupRef = useRef<Group>(null);
  const ballRef = useRef<Group>(null);
  const timeRef = useRef(0);
  const { scene, animations } = useGLTF(ASSETS.models.playerBlocky, true, true);
  const { scene: ballScene } = useGLTF(ASSETS.models.baseball, true, true);

  const rig = useMemo(() => {
    const created = createPlayerRig(scene, animations);
    const upper = created.root.getObjectByName("upper_armR");
    const fore = created.root.getObjectByName("forearmR");
    const hand = created.root.getObjectByName("handR");
    return {
      ...created,
      throwArm: upper && fore && hand ? { upper, fore, hand } : null,
      // 믹서는 값이 안 바뀐 트랙을 다시 쓰지 않는다. 얹은 회전을 매 프레임 되돌려 두지 않으면 쌓인다.
      beforeOffset: [new Quaternion(), new Quaternion()],
      offsetApplied: false,
    };
  }, [scene, animations]);

  const ball = useMemo(() => {
    const root: Object3D = ballScene.clone(true);
    ballBox.setFromObject(root).getSize(ballSize);
    const scale = BALL_SIZE / Math.max(ballSize.x, ballSize.y, ballSize.z);
    root.scale.setScalar(scale);
    ballBox.setFromObject(root).getCenter(handWorld);
    root.position.sub(handWorld);
    return root;
  }, [ballScene]);

  useEffect(() => {
    startPlayerRig(rig);
    return () => disposePlayerRig(rig);
  }, [rig]);

  useFrame((_, delta) => {
    const step = Math.min(delta, 0.05);
    timeRef.current += step;
    const phase = (timeRef.current / TOSS_PERIOD) % 1;
    const arm = rig.throwArm;
    if (arm && rig.offsetApplied) {
      arm.upper.quaternion.copy(rig.beforeOffset[0]);
      arm.fore.quaternion.copy(rig.beforeOffset[1]);
    }
    updatePlayerRig(rig, 0, 0, step);
    if (arm) {
      rig.beforeOffset[0].copy(arm.upper.quaternion);
      rig.beforeOffset[1].copy(arm.fore.quaternion);
      reachBone(rig.root, arm.upper, HOLD_UPPER + armOffset(phase));
      reachBone(rig.root, arm.fore, HOLD_FORE);
      rig.offsetApplied = true;
    }

    const group = groupRef.current;
    const ballGroup = ballRef.current;
    if (!arm || !group || !ballGroup) return;
    group.updateMatrixWorld(true);
    arm.hand.getWorldPosition(handWorld);
    group.worldToLocal(handWorld);
    ballGroup.position.set(handWorld.x, handWorld.y + PALM_LIFT + ballLift(phase), handWorld.z);
    // 떠 있는 동안만 돈다. 손 안에서 도는 공은 미끄러지는 것처럼 보인다.
    if (ballLift(phase) > 0) ballGroup.rotation.x -= step * 9;
  });

  return (
    <group ref={groupRef}>
      <primitive object={rig.root} dispose={null} />
      <group ref={ballRef}>
        <primitive object={ball} dispose={null} />
      </group>
    </group>
  );
}

useGLTF.preload(ASSETS.models.playerBlocky, true, true);
useGLTF.preload(ASSETS.models.baseball, true, true);
