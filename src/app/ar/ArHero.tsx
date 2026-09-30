"use client";

import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  Box3,
  type Group,
  MathUtils,
  type Mesh,
  type MeshStandardMaterial,
  type Object3D,
  Quaternion,
  Vector3,
} from "three";
import { ASSETS } from "@/lib/assets";
import { prefersReducedMotion } from "@/lib/reduced-motion";
import {
  batDirection,
  HAND_GAP,
  palmPoint,
  placeHeldBat,
  reachHandTo,
} from "@/scenes/memory-room/held-bat";
import { resolveRoomPalette } from "@/scenes/memory-room/palette";
import {
  createPlayerRig,
  disposePlayerRig,
  reachBone,
  startPlayerRig,
  updatePlayerRig,
} from "@/scenes/memory-room/player-animation";
import { SIT_CONTACT_Y, STEP_RATE } from "@/scenes/memory-room/player-rig";
import { seatOffsetFromCenter } from "@/scenes/memory-room/seats";
import { advanceSitProgress, sitEase } from "@/scenes/memory-room/sit-motion";
import {
  type ArAction,
  advanceActionClock,
  type BatMotion,
  batMotionAt,
  createActionClock,
  type TossMotion,
  tossMotionAt,
} from "./ar-motion";

/** The AR figure shares the authored game clips and adds only the two missing sports gestures. */

const VIEWER_WALK_SPEED = 1.5;
const POSE_BLEND_LAMBDA = 9;

const HOLD_UPPER = -0.55;
const HOLD_FORE = -1.25;
const PALM_LIFT = 0.07;
const BALL_SIZE = 0.16;

const STOOL_HEIGHT = 0.28;
const STOOL_DEPTH = 0.5;
const STOOL_SIZE: [number, number, number] = [0.78, STOOL_HEIGHT, STOOL_DEPTH];
const STOOL_POSITION: [number, number, number] = [
  0,
  SIT_CONTACT_Y - STOOL_HEIGHT / 2,
  -seatOffsetFromCenter(STOOL_DEPTH / 2),
];

function centeredBall(source: Object3D): Object3D {
  const root = source.clone(true);
  const bounds = new Box3().setFromObject(root);
  const size = bounds.getSize(new Vector3());
  const scale = BALL_SIZE / Math.max(size.x, size.y, size.z);
  root.scale.setScalar(scale);
  root.position.sub(bounds.setFromObject(root).getCenter(new Vector3()));
  return root;
}

function castingClone(source: Object3D): Object3D {
  const root = source.clone(true);
  root.traverse((object) => {
    const mesh = object as Mesh;
    if (mesh.isMesh) mesh.castShadow = true;
  });
  return root;
}

export function ArHero({ action, active }: { action: ArAction; active: boolean }) {
  const modelRef = useRef<Group>(null);
  const ballRef = useRef<Group>(null);
  const batRef = useRef<Group>(null);
  const stoolRef = useRef<Mesh>(null);
  const actionClockRef = useRef(createActionClock(action, active));
  const walkPhaseRef = useRef(0);
  const walkWeightRef = useRef(0);
  const sitRef = useRef(0);
  const tossWeightRef = useRef(1);
  const batWeightRef = useRef(0);
  const previousTossStageRef = useRef<TossMotion["stage"]>("rest");
  const releasePositionRef = useRef(new Vector3());
  const handPositionRef = useRef(new Vector3());
  const leftHandPositionRef = useRef(new Vector3());
  const batDirectionRef = useRef(new Vector3());
  const gripRef = useRef(new Vector3());
  const rightTargetRef = useRef(new Vector3());
  const leftTargetRef = useRef(new Vector3());
  const ballPositionRef = useRef(new Vector3());
  const tossMotionRef = useRef<TossMotion>({
    stage: "rest",
    armOffset: 0,
    ballLift: 0,
    flight: 0,
  });
  const batMotionRef = useRef<BatMotion>(batMotionAt(0));
  const reducedMotion = useMemo(prefersReducedMotion, []);
  const palette = useMemo(resolveRoomPalette, []);

  const { scene, animations } = useGLTF(ASSETS.models.playerBlocky, true, true);
  const { scene: ballScene } = useGLTF(ASSETS.models.baseball, true, true);
  const { scene: batScene } = useGLTF(ASSETS.models.baseballBat, true, true);
  const ball = useMemo(() => centeredBall(ballScene), [ballScene]);
  const bat = useMemo(() => castingClone(batScene), [batScene]);
  const rig = useMemo(() => {
    const created = createPlayerRig(scene, animations);
    const bones = {
      upperR: created.root.getObjectByName("upper_armR"),
      foreR: created.root.getObjectByName("forearmR"),
      handR: created.root.getObjectByName("handR"),
      upperL: created.root.getObjectByName("upper_armL"),
      foreL: created.root.getObjectByName("forearmL"),
      handL: created.root.getObjectByName("handL"),
    };
    const manual = [bones.upperR, bones.foreR, bones.upperL, bones.foreL].filter(
      (bone): bone is Object3D => bone !== undefined,
    );
    return {
      ...created,
      arBones: bones,
      manual,
      beforeManual: manual.map(() => new Quaternion()),
      manualApplied: false,
    };
  }, [scene, animations]);

  useEffect(() => {
    startPlayerRig(rig);
    return () => disposePlayerRig(rig);
  }, [rig]);

  useFrame((_, delta) => {
    const step = Math.min(delta, 0.05);
    const actionTime = advanceActionClock(actionClockRef.current, action, active, step);
    if (actionClockRef.current.restarted) {
      previousTossStageRef.current = "rest";
    }
    if (!active) return;

    if (rig.manualApplied) {
      for (let index = 0; index < rig.manual.length; index += 1) {
        rig.manual[index].quaternion.copy(rig.beforeManual[index]);
      }
    }

    walkWeightRef.current = MathUtils.damp(
      walkWeightRef.current,
      action === "walk" ? 1 : 0,
      POSE_BLEND_LAMBDA,
      step,
    );
    tossWeightRef.current = MathUtils.damp(
      tossWeightRef.current,
      action === "toss" ? 1 : 0,
      POSE_BLEND_LAMBDA,
      step,
    );
    batWeightRef.current = MathUtils.damp(
      batWeightRef.current,
      action === "bat" ? 1 : 0,
      POSE_BLEND_LAMBDA,
      step,
    );
    sitRef.current = advanceSitProgress(sitRef.current, action === "sit", step);
    walkPhaseRef.current += STEP_RATE * VIEWER_WALK_SPEED * walkWeightRef.current * step;
    const sitting = sitEase(sitRef.current);
    updatePlayerRig(rig, walkPhaseRef.current, walkWeightRef.current, step, sitting);

    for (let index = 0; index < rig.manual.length; index += 1) {
      rig.beforeManual[index].copy(rig.manual[index].quaternion);
    }

    const toss = tossMotionAt(
      action === "toss" ? actionTime : 0,
      reducedMotion,
      tossMotionRef.current,
    );
    const tossWeight = tossWeightRef.current;
    const { upperR, foreR, handR, upperL, foreL, handL } = rig.arBones;
    if (upperR && foreR && tossWeight > 0.001) {
      reachBone(rig.root, upperR, (HOLD_UPPER + toss.armOffset) * tossWeight);
      reachBone(rig.root, foreR, HOLD_FORE * tossWeight);
    }

    const batting = batMotionAt(
      action === "bat" ? actionTime : 0,
      reducedMotion,
      batMotionRef.current,
    );
    const batWeight = batWeightRef.current;

    // 몸통을 먼저 튼다: 팔은 틀어진 몸에서 손잡이를 향해 뻗어야 한다
    const model = modelRef.current;
    if (model) {
      model.rotation.y = MathUtils.damp(model.rotation.y, batWeight * batting.turn, 13, step);
      model.updateMatrixWorld(true);
    }

    const batDirection3 = batDirectionRef.current;
    batDirection(batting.yaw, batting.pitch, batDirection3);
    if (model && batWeight > 0.001 && upperR && foreR && handR && upperL && foreL && handL) {
      // 오른손 타자: 오른손이 배럴 쪽, 왼손이 노브 쪽
      const grip = gripRef.current.set(batting.gripX, batting.gripY, batting.gripZ);
      const rightTarget = rightTargetRef.current
        .copy(grip)
        .addScaledVector(batDirection3, HAND_GAP / 2);
      const leftTarget = leftTargetRef.current
        .copy(grip)
        .addScaledVector(batDirection3, -HAND_GAP / 2);
      model.localToWorld(rightTarget);
      model.localToWorld(leftTarget);
      reachHandTo(upperR, foreR, handR, rightTarget, batWeight);
      reachHandTo(upperL, foreL, handL, leftTarget, batWeight);
    }
    rig.manualApplied = tossWeight > 0.001 || batWeight > 0.001;

    const stool = stoolRef.current;
    if (stool) {
      stool.visible = sitting > 0.02;
      (stool.material as MeshStandardMaterial).opacity = sitting;
    }

    if (!model || !handR) return;
    handR.getWorldPosition(handPositionRef.current);
    model.worldToLocal(handPositionRef.current);

    const ballGroup = ballRef.current;
    if (ballGroup && action === "toss") {
      if (toss.stage === "flight") {
        if (previousTossStageRef.current !== "flight") {
          releasePositionRef.current.copy(handPositionRef.current);
        }
        ballPositionRef.current.lerpVectors(
          releasePositionRef.current,
          handPositionRef.current,
          toss.flight,
        );
        ballPositionRef.current.y += PALM_LIFT + toss.ballLift;
        ballGroup.position.copy(ballPositionRef.current);
        ballGroup.rotation.x -= step * 9;
      } else {
        ballGroup.position.copy(handPositionRef.current);
        ballGroup.position.y += PALM_LIFT;
      }
      previousTossStageRef.current = toss.stage;
    }

    const batGroup = batRef.current;
    if (batGroup && action === "bat" && handL) {
      // 배트는 목표가 아니라 실제로 모인 두 손바닥 사이에 끼운다
      const palms = palmPoint(handL, leftHandPositionRef.current);
      palms.add(palmPoint(handR, gripRef.current)).multiplyScalar(0.5);
      model.worldToLocal(palms);
      placeHeldBat(palms, batDirection3, batGroup.position, batGroup.quaternion);
    }
  });

  return (
    <group ref={modelRef}>
      <primitive object={rig.root} dispose={null} />
      <group ref={ballRef} visible={action === "toss"}>
        <primitive object={ball} dispose={null} />
      </group>
      <group ref={batRef} visible={action === "bat"}>
        <primitive object={bat} dispose={null} />
      </group>
      <mesh ref={stoolRef} position={STOOL_POSITION} visible={false} castShadow>
        <boxGeometry args={STOOL_SIZE} />
        <meshStandardMaterial color={palette.wood} roughness={0.78} transparent opacity={0} />
      </mesh>
    </group>
  );
}

useGLTF.preload(ASSETS.models.playerBlocky, true, true);
useGLTF.preload(ASSETS.models.baseball, true, true);
useGLTF.preload(ASSETS.models.baseballBat, true, true);
