"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  CanvasTexture,
  DoubleSide,
  type Group,
  type Mesh,
  PerspectiveCamera,
  SRGBColorSpace,
  Vector3,
} from "three";
import { i18n } from "@/i18n/config";
import { playSound, playTone } from "@/lib/audio";
import { LivingPiece } from "@/scenes/memory-room/LivingRoomFurniture";
import {
  LIVING_ANCHORS,
  LIVING_PIANO_CENTER,
  LIVING_PIANO_ROTATION,
  scaleLivingHeight,
  scaleLivingPoint,
} from "@/scenes/memory-room/layout";
import { resolveRoomPalette } from "@/scenes/memory-room/palette";
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
import {
  barVisible,
  isComplete,
  isPrefix,
  MELODY_BARS,
  NOTE_HZ,
  noteForKey,
  type Solfege,
} from "./melody";

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
/** 시선은 건반보다 조금 위를 본다: 건반 한 벌과 보면대의 악보가 한 화면에 들어온다. */
const CAMERA_TARGET_LIFT = 0.3;

/**
 * 보면대에 세우는 악보의 크기(로컬)와 자리.
 *
 * 두 번 가렸던 자리다. 윗판(y 1.31부터, z 5.97~6.43) 안에 넣으면 종이의 위쪽이 판
 * 속에 묻히고, 젖혀진 뚜껑 뒤에 두면(z 6.0 언저리, y 1.11까지 선다) 글자가 통째로
 * 가려진다. 그래서 뚜껑보다 앞(z 5.90)·위(y 1.26)다: 윗판 앞 모서리보다 앞이라
 * 파고들 것이 없고, 뚜껑은 그 아래 뒤에 선다.
 */
const SHEET = {
  width: 0.95,
  height: 0.24,
  position: [KEYBOARD_CENTER_X, 1.26, 5.9] as const,
  /** 뒤로 살짝 눕혀 세운다: 보면대에 기대 놓은 각. */
  tilt: 0.24,
};

/** 악보 그림의 해상도. 종이의 가로세로(약 4.3:1)를 따른다: 안 맞으면 글자가 늘어난다. */
const SHEET_TEXTURE = { width: 512, height: 120 };

function canDraw(ctx: CanvasRenderingContext2D | null): ctx is CanvasRenderingContext2D {
  return (
    typeof ctx?.fillRect === "function" &&
    typeof ctx.fillText === "function" &&
    typeof ctx.measureText === "function"
  );
}

/**
 * 보면대에 놓인 악보 한 장을 그림으로 굽는다.
 *
 * 3D 안에 글자를 세우는 자리라 DOM을 못 쓴다. 계이름은 언어를 타므로(도/Do/ド) i18n에서
 * 읽어 캔버스에 찍는다. 지워진 마디는 글자 대신 번진 자국을 그린다: 조각을 들고 있어야
 * 그 마디가 드러난다 (melody의 barVisible).
 */
function useSheetTexture(hasScrap: boolean, paper: string, ink: string): CanvasTexture {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = SHEET_TEXTURE.width;
    canvas.height = SHEET_TEXTURE.height;
    const ctx = canvas.getContext("2d");
    if (canDraw(ctx)) {
      ctx.fillStyle = paper;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // 오선 두 줄: 없으면 글자만 뜬 흰 종이라 악보로 안 읽힌다
      ctx.fillStyle = ink;
      ctx.globalAlpha = 0.22;
      for (const y of [16, 100]) ctx.fillRect(24, y, canvas.width - 48, 2);
      ctx.globalAlpha = 1;

      const notes = MELODY_BARS.flatMap((bar, barIndex) =>
        bar.map((note) => ({ note, shown: barVisible(barIndex, hasScrap) })),
      );
      const step = (canvas.width - 64) / notes.length;
      ctx.font = "600 44px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      notes.forEach(({ note, shown }, index) => {
        const x = 32 + step * (index + 0.5);
        if (shown) {
          ctx.fillStyle = ink;
          ctx.fillText(i18n.t(`minigame.pianoMelody.notes.${note}`), x, 58);
          return;
        }
        // 물에 번진 자국. 글자 자리를 지우지 않고 뭉갠다
        ctx.fillStyle = ink;
        ctx.globalAlpha = 0.16;
        ctx.beginPath();
        ctx.ellipse(x, 58, step * 0.36, 26, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      });
    }
    const made = new CanvasTexture(canvas);
    made.colorSpace = SRGBColorSpace;
    made.anisotropy = 4;
    return made;
  }, [hasScrap, paper, ink]);

  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
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
     * 건반 앞쪽. 피아노의 앞면은 로컬 -z다 (몸통 앞면 6.00, 그 앞에 건반 5.95). +z로
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
 * 뚜껑이 젖혀지고 카메라가 건반 앞에 붙박이로 선다. 악보에 적힌 계이름을 그대로
 * 누르면 열린다. 듣고 맞히는 문제가 아니다: 절대음감을 요구하면 난이도가 아니라 벽이다.
 * 대신 악보의 한 마디가 물에 번져 안 보이고, 그 마디는 안방 책상의 찢어진 조각이
 * 들고 있다. 문제의 내용은 연주가 아니라 **저쪽 공간에서 이쪽으로 가져오는 일**이다.
 *
 * 검은 건반도 눌린다. 곡에 안 쓰이니 누르면 틀린 음이지만, 눌리지 않는 건반이 섞여
 * 있으면 악기가 아니라 버튼 일곱 개가 된다.
 *
 * 스토어를 만지지 않는다. 결과는 onComplete 한 번뿐이다 (.claude/rules/minigames.md).
 */
export function PianoMelodyMinigame({ onComplete, onSettled, carrying = [] }: MinigameProps) {
  const palette = useMemo(resolveRoomPalette, []);
  const complete = useOnceCompleter(onComplete);
  const hasScrap = carrying.includes("piano-sheet");
  const sheet = useSheetTexture(hasScrap, palette.linen, palette.frame);

  const lidRef = useRef<Group>(null);
  const keyRefs = useRef<(Mesh | null)[]>([]);
  /** 건반마다 눌린 정도(0~1). 프레임마다 여기로 damp한다 (useFrame에서 setState 금지). */
  const pressRef = useRef<number[]>(PIANO_KEYS.map(() => 0));
  const playedRef = useRef<Solfege[]>([]);
  const lockedRef = useRef(false);
  const doneRef = useRef(false);

  const pressKey = (index: number) => {
    const key = PIANO_KEYS[index];
    if (doneRef.current || lockedRef.current) return;
    pressRef.current[index] = 1;
    playTone(NOTE_HZ[key.note]);

    // 검은 건반은 곡에 없는 음이다. 눌리기는 하되 언제나 틀린 음이 된다
    const next: Solfege[] = [...playedRef.current, key.note];

    if (key.black || !isPrefix(next)) {
      playedRef.current = [];
      lockedRef.current = true;
      playSound("fail");
      window.setTimeout(() => {
        lockedRef.current = false;
      }, REJECT_MS);
      return;
    }

    playedRef.current = next;
    if (!isComplete(next)) return;

    doneRef.current = true;
    onSettled?.();
    window.setTimeout(() => complete({ cleared: true }), SETTLE_MS);
  };
  const pressRefFn = useRef(pressKey);
  pressRefFn.current = pressKey;

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
      const mesh = keyRefs.current[index];
      if (!mesh) continue;
      pressRef.current[index] += (0 - pressRef.current[index]) * step;
      mesh.position.y = key.position[1] - pressRef.current[index] * KEY_PRESS_DEPTH;
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
          뚜껑이 건반을 파고든다. 판이 서면 뚜껑만 여기 있고 몸통 쪽 PIANO_LID는 빠진다
        */}
        <group ref={lidRef} position={[KEYBOARD_CENTER_X, KEYBOARD_Y + 0.07, 6.06]}>
          <mesh position={[0, 0, -0.13]} castShadow>
            <boxGeometry args={[1.5, 0.05, 0.26]} />
            <meshStandardMaterial color={palette.wood} roughness={0.6} />
          </mesh>
        </group>

        {PIANO_KEYS.map((key, index) => (
          // biome-ignore lint/a11y/noStaticElementInteractions: R3F mesh는 DOM이 아니라 Canvas 안의 포인터 대상이다.
          <mesh
            // biome-ignore lint/suspicious/noArrayIndexKey: 건반의 자리가 곧 그 건반이다 (같은 음이 흰·검으로 두 번 온다)
            key={index}
            name={`piano-key-${index}`}
            ref={(mesh) => {
              keyRefs.current[index] = mesh;
            }}
            position={key.position}
            castShadow
            receiveShadow
            onClick={(event) => {
              event.stopPropagation();
              pressRefFn.current(index);
            }}
          >
            <boxGeometry args={key.size} />
            <meshStandardMaterial
              color={key.black ? palette.frame : palette.linen}
              roughness={key.black ? 0.5 : 0.72}
            />
          </mesh>
        ))}

        {/*
          보면대의 악보. 조각을 들고 있으면 지워진 마디가 드러난다.
          앞면(-z)을 보도록 반 바퀴 돌린 뒤 그 안에서 눕힌다: 안 돌리면 글자가
          벽 쪽을 보고 뒤집힌다.
        */}
        <group position={SHEET.position} rotation={[0, Math.PI, 0]}>
          <mesh rotation={[SHEET.tilt, 0, 0]}>
            <planeGeometry args={[SHEET.width, SHEET.height]} />
            <meshStandardMaterial map={sheet} roughness={0.9} side={DoubleSide} />
          </mesh>
        </group>
      </LivingPiece>
    </>
  );
}
