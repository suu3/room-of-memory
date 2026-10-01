"use client";

import { RoundedBox } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { CanvasTexture, type Group, PerspectiveCamera, SRGBColorSpace, Vector3 } from "three";
import { playSound, playTone } from "@/lib/audio";
import { LivingPiece } from "@/scenes/memory-room/rooms/living/LivingRoomFurniture";
import { PIANO_FALLBOARD, PianoFallboard } from "@/scenes/memory-room/rooms/living/PianoCabinet";
import {
  LIVING_ANCHORS,
  LIVING_PIANO_CENTER,
  LIVING_PIANO_ROTATION,
  scaleLivingHeight,
  scaleLivingPoint,
} from "@/scenes/memory-room/world/layout";
import { resolveRoomPalette } from "@/scenes/memory-room/world/palette";
import type { MinigameProps } from "@/types/minigame";
import { useOnceCompleter } from "../shell";
import {
  KEY_PRESS_DEPTH,
  KEYBOARD_CENTER_X,
  KEYBOARD_CENTER_Z,
  KEYBOARD_Y,
  LID_OPEN_ANGLE,
  PIANO_KEYS,
} from "./keys";
import { isComplete, NOTE_HZ, noteForKey, pressNote, SOLFEGE, type Solfege } from "./melody";
import { pianoProgress } from "./progress";

/** 마지막 음이 울린 뒤 결과를 내주기까지(ms). 소리가 끊기면 푼 느낌도 끊긴다. */
const SETTLE_MS = 900;
/** 틀린 뒤 건반이 잠기는 시간(ms). 손이 멈출 만큼만. */
const REJECT_MS = 420;
/** 눌린 건반이 오르내리는 속도. */
const KEY_LAMBDA = 18;
/** 뚜껑이 젖혀지는 속도. */
const LID_LAMBDA = 5;

/**
 * 카메라가 건반에서 떨어지는 거리와 높이 (월드 단위). 건반 한 벌(가로 1.82)이 화면을
 * 거의 채우는 자리다. 더 붙이면 양끝 건반이 화면 밖으로 잘린다.
 */
const CAMERA_FORWARD = 1.9;
const CAMERA_LIFT = 1.15;
const CAMERA_FOV = 40;
/**
 * 위 거리와 화각이 맞춰진 화면 비율(가로/세로). 이보다 좁은 화면(세로로 든 폰)에서는
 * 세로 화각을 넓혀 **가로로 보이는 폭**을 이 비율일 때만큼 지킨다. 화각을 고정하면
 * 세로 화면에서 가로 폭이 반 넘게 줄어 양끝 건반과 악보가 잘린다.
 */
const CAMERA_FIT_ASPECT = 1.6;
/** 세로 화각의 상한(도). 이 위로는 화면 위아래가 눈에 띄게 휜다. */
const CAMERA_MAX_FOV = 100;

/** 화면 비율에 맞춘 세로 화각(도). 넓은 화면은 CAMERA_FOV 그대로다. */
export function keyboardFov(aspect: number): number {
  if (aspect >= CAMERA_FIT_ASPECT) return CAMERA_FOV;
  const half = Math.tan(((CAMERA_FOV / 2) * Math.PI) / 180);
  const fov = (2 * Math.atan((half * CAMERA_FIT_ASPECT) / aspect) * 180) / Math.PI;
  return Math.min(CAMERA_MAX_FOV, fov);
}
/** 시선은 건반보다 조금 위를 본다: 건반 한 벌과 보면대의 악보가 한 화면에 들어온다. */
const CAMERA_TARGET_LIFT = 0.39;

/**
 * 흰 건반 앞머리에 붙은 계이름. 낡은 스티커처럼 옅게 찍는다.
 *
 * 화면에 "악보대로 누르세요"를 띄우는 대신 물건이 말하게 하는 쪽을 골랐다. 보면대의
 * 악보에 오선지와 계이름이 있고, 건반에도 같은 글자가 남아 있다. 이 집에서 피아노를
 * 배우던 아이가 붙여 둔 것이지, 플레이어에게 주는 안내가 아니다.
 */
const LABEL = { size: 0.11, inset: 0.064, texture: 96 };

function canDrawText(ctx: CanvasRenderingContext2D | null): ctx is CanvasRenderingContext2D {
  return typeof ctx?.fillText === "function" && typeof ctx.clearRect === "function";
}

/** 계이름 일곱 자를 각각 작은 그림으로 굽는다. 언어가 바뀌면 다시 굽는다. */
function useNoteLabels(ink: string): Partial<Record<Solfege, CanvasTexture>> {
  // 언어가 바뀌면 t가 새 것으로 오고(useTranslation이 다시 그린다) 글자도 다시 굽는다
  const { t } = useTranslation();

  const textures = useMemo(() => {
    const made: Partial<Record<Solfege, CanvasTexture>> = {};
    for (const note of SOLFEGE) {
      const canvas = document.createElement("canvas");
      canvas.width = LABEL.texture;
      canvas.height = LABEL.texture;
      const ctx = canvas.getContext("2d");
      if (canDrawText(ctx)) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = ink;
        // 폰 화면에서는 건반이 손톱만 하다. 옅고 가는 글자는 안 읽혀서 조금 진하게 찍는다
        ctx.globalAlpha = 0.85;
        ctx.font = "700 60px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(t(`minigame.pianoMelody.notes.${note}`), canvas.width / 2, canvas.height / 2);
      }
      const texture = new CanvasTexture(canvas);
      texture.colorSpace = SRGBColorSpace;
      texture.anisotropy = 4;
      made[note] = texture;
    }
    return made;
  }, [ink, t]);

  useEffect(
    () => () => {
      for (const texture of Object.values(textures)) texture.dispose();
    },
    [textures],
  );
  return textures;
}

/** 건반을 정면에서 내려다보는 붙박이 카메라. 판이 도는 동안 기본 카메라를 대신한다. */
function KeyboardCamera() {
  const set = useThree((state) => state.set);
  const size = useThree((state) => state.size);

  const camera = useMemo(() => {
    const view = new PerspectiveCamera(CAMERA_FOV, 1, 0.05, 40);
    view.name = "piano-camera";

    /*
     * 건반의 월드 자리. 로컬 좌표를 거실 변환에 통과시켜 얻는다: 피아노를 옮기면
     * 카메라도 따라간다. 앞 방향도 같은 식으로 낸다(한 칸 앞의 점 - 가운데). 회전
     * 부호를 손으로 맞추면 가구를 돌려 세울 때마다 여기가 틀어진다.
     */
    const [cx, cz] = scaleLivingPoint(
      LIVING_ANCHORS.piano,
      KEYBOARD_CENTER_X,
      KEYBOARD_CENTER_Z,
      LIVING_PIANO_CENTER,
      LIVING_PIANO_ROTATION,
    );
    /*
     * 건반 앞쪽. 피아노의 앞면은 로컬 -z다. +z로
     * 잡으면 카메라가 등을 댄 벽 속에 서서 몸통 뒤통수를 들여다본다: 화면이 새까맣다.
     */
    const [fx, fz] = scaleLivingPoint(
      LIVING_ANCHORS.piano,
      KEYBOARD_CENTER_X,
      KEYBOARD_CENTER_Z - 1,
      LIVING_PIANO_CENTER,
      LIVING_PIANO_ROTATION,
    );
    const y = scaleLivingHeight(KEYBOARD_Y);
    const forward = new Vector3(fx - cx, 0, fz - cz).normalize();

    view.position.set(
      cx + forward.x * CAMERA_FORWARD,
      y + CAMERA_LIFT,
      cz + forward.z * CAMERA_FORWARD,
    );
    view.lookAt(cx, y + CAMERA_TARGET_LIFT, cz);
    return view;
  }, []);

  useLayoutEffect(() => {
    camera.aspect = size.width / size.height;
    camera.fov = keyboardFov(camera.aspect);
    camera.updateProjectionMatrix();
  }, [camera, size]);

  // 바꿔 끼우고, 내려올 때 돌려놓는다 (FirstPersonRig와 같은 규약)
  useLayoutEffect(() => {
    let previous: PerspectiveCamera | null = null;
    set((state) => {
      previous = state.camera as PerspectiveCamera;
      return { camera };
    });
    return () => {
      if (previous) set({ camera: previous });
    };
  }, [camera, set]);

  return null;
}

/**
 * 거실 피아노의 멜로디 자물쇠. canvas 모드: 씬의 피아노 그 자리에서 판이 돈다.
 *
 * 뚜껑이 젖혀지고 카메라가 건반 앞에 붙박이로 선다. 보면대의 악보(PianoSheet: 판이
 * 아니라 씬이 늘 세워 둔다)에 적힌 대로 누르면 열린다. 듣고 맞히는 문제가 아니다:
 * 절대음감을 요구하면 난이도가 아니라 벽이다. 대신 악보의 한 마디가 물에 번져 안
 * 보이고, 그 마디는 안방 책상의 찢어진 조각이 들고 있다. 문제의 내용은 연주가 아니라
 * **저쪽 공간에서 이쪽으로 가져오는 일**이다.
 *
 * 무엇을 하라고 적어 주는 화면은 없다. 악보가 서 있고 건반에 같은 글자가 남아 있을
 * 뿐이다 (card-odd와 같은 규칙: 답을 시작 카드에 적으면 문제가 사라진다). 대신 맞게 친
 * 음은 악보 위에서 금빛으로 켜진다 (progress.ts): 지시는 없어도 "지금 곡을 따라가고
 * 있다"는 건 보여야 끝났을 때 놀라지 않는다.
 *
 * 검은 건반도 눌린다. 곡에 안 쓰이니 누르면 틀린 음이지만, 눌리지 않는 건반이 섞여
 * 있으면 악기가 아니라 버튼 일곱 개가 된다.
 *
 * 스토어를 만지지 않는다. 결과는 onComplete 한 번뿐이다 (.claude/rules/minigames.md).
 */
export function PianoMelodyMinigame({ onComplete, onSettled, onBlocked, carrying }: MinigameProps) {
  const hasScrap = carrying?.includes("piano-sheet") ?? false;
  const palette = useMemo(resolveRoomPalette, []);
  const complete = useOnceCompleter(onComplete);
  const labels = useNoteLabels(palette.frame);

  const lidRef = useRef<Group>(null);
  const keyRefs = useRef<(Group | null)[]>([]);
  /** 건반마다 눌린 정도(0~1). 프레임마다 여기로 damp한다 (useFrame에서 setState 금지). */
  const pressRef = useRef<number[]>(PIANO_KEYS.map(() => 0));
  const playedRef = useRef<Solfege[]>([]);
  const lockedRef = useRef(false);
  const doneRef = useRef(false);

  const pressKey = (index: number) => {
    const key = PIANO_KEYS[index];
    if (doneRef.current || lockedRef.current) return;
    pressRef.current[index] = 1;
    // 악보 조각이 없으면 건반은 눌리기만 하고 소리가 안 난다. 무엇을 칠지 모르는 채로
    // 두드리게 두지 않고 "악보가 필요하다"를 호스트가 띄운다 (needsItem)
    if (!hasScrap) {
      playSound("deny");
      onBlocked?.();
      return;
    }
    playTone(NOTE_HZ[key.note]);

    // 검은 건반은 곡에 없는 음이다. 눌리기는 하되 언제나 틀린 음이 된다
    const result = key.black
      ? { played: [], wrong: true }
      : pressNote(playedRef.current, key.note, hasScrap);

    if (result.wrong) {
      playedRef.current = result.played;
      pianoProgress.played = result.played.length;
      lockedRef.current = true;
      playSound("fail");
      window.setTimeout(() => {
        lockedRef.current = false;
      }, REJECT_MS);
      return;
    }

    playedRef.current = result.played;
    pianoProgress.played = result.played.length;
    if (!isComplete(result.played)) return;

    doneRef.current = true;
    onSettled?.();
    window.setTimeout(() => complete({ cleared: true }), SETTLE_MS);
  };
  const pressRefFn = useRef(pressKey);
  pressRefFn.current = pressKey;

  // 보면대의 악보가 친 음을 칠한다. 판이 서고 내려갈 때 비워 둔다
  useEffect(() => {
    pianoProgress.played = 0;
    return () => {
      pianoProgress.played = 0;
    };
  }, []);

  // 숫자 키 1~7. 손가락도 마우스도 없는 손을 위한 길이다 (.claude/rules/minigames.md)
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const note = noteForKey(event.key);
      if (note === null) return;
      const index = PIANO_KEYS.findIndex((key) => !key.black && key.note === note);
      if (index < 0) return;
      event.preventDefault();
      pressRefFn.current(index);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useFrame((_, delta) => {
    const lid = lidRef.current;
    if (lid) {
      const step = Math.min(1, delta * LID_LAMBDA);
      lid.rotation.x += (LID_OPEN_ANGLE - lid.rotation.x) * step;
    }
    const step = Math.min(1, delta * KEY_LAMBDA);
    for (const [index, key] of PIANO_KEYS.entries()) {
      const pressed = keyRefs.current[index];
      if (!pressed) continue;
      pressRef.current[index] += (0 - pressRef.current[index]) * step;
      pressed.position.y = key.position[1] - pressRef.current[index] * KEY_PRESS_DEPTH;
    }
  });

  return (
    <>
      <KeyboardCamera />
      <LivingPiece
        anchor={LIVING_ANCHORS.piano}
        at={LIVING_PIANO_CENTER}
        rotationY={LIVING_PIANO_ROTATION}
      >
        {/*
          젖혀지는 뚜껑. 축은 건반 **뒤쪽**(+z) 모서리다: 가운데를 축으로 돌리면
          뚜껑이 건반을 파고든다. 판이 서면 닫힌 덮개 대신 같은 부품을 여기서 움직인다
        */}
        <group ref={lidRef} position={PIANO_FALLBOARD.pivot}>
          <PianoFallboard palette={palette} />
        </group>

        {PIANO_KEYS.map((key, index) => (
          <group
            // biome-ignore lint/suspicious/noArrayIndexKey: 건반의 자리가 곧 그 건반이다 (같은 음이 흰·검으로 두 번 온다)
            key={index}
            // 눌리는 것은 이 무리다. 건반에 붙은 계이름도 같이 내려갔다 올라온다
            ref={(node) => {
              keyRefs.current[index] = node;
            }}
            position={key.position}
          >
            <RoundedBox
              name={`piano-key-${index}`}
              args={[...key.size]}
              radius={key.black ? 0.004 : 0.003}
              smoothness={2}
              castShadow
              receiveShadow
              onClick={(event) => {
                event.stopPropagation();
                pressRefFn.current(index);
              }}
            >
              <meshStandardMaterial
                color={key.black ? palette.void : palette.linen}
                roughness={key.black ? 0.3 : 0.38}
              />
            </RoundedBox>
            {/*
              흰 건반 앞머리의 계이름. 건반 윗면에 눕혀 놓되 글자의 위쪽이 피아노
              안쪽(+z)을 보게 반 바퀴 돌린다: 안 돌리면 앞에서 볼 때 거꾸로 선다.
            */}
            {!key.black && labels[key.note] && (
              <mesh
                position={[0, key.size[1] / 2 + 0.001, -key.size[2] / 2 + LABEL.inset]}
                rotation={[-Math.PI / 2, 0, Math.PI]}
              >
                <planeGeometry args={[LABEL.size, LABEL.size]} />
                <meshBasicMaterial map={labels[key.note]} transparent depthWrite={false} />
              </mesh>
            )}
          </group>
        ))}
      </LivingPiece>
    </>
  );
}
