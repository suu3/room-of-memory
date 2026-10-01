"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  DoubleSide,
  HalfFloatType,
  MathUtils,
  type Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Vector3,
  WebGLRenderTarget,
} from "three";
import { EYE_HEIGHT, MIRROR_ONLY_LAYER } from "./first-person";
import { usePlayerPosition } from "./use-near-player";

/** 얼굴을 담는 텍스처의 한 변. 유리가 작고 얼굴 하나라 이만큼이면 또렷하다. */
const FACE_SIZE = 256;
/** 다시 찍는 간격(프레임). 거울 앞에 서 있는 동안만 돈다. */
const RENDER_INTERVAL = 2;
/** 세로 화각. 세면대 앞(1m 남짓)에서 머리와 어깨가 든다. */
const FACE_FOV = 30;
/**
 * 얼굴의 높이: 1인칭 눈높이(EYE_HEIGHT)보다 아래다. 머리가 큰 캐릭터라 눈이 머리의 아래쪽에
 * 있다. 유리 한가운데(1.72m)에서 내려다보면 머리카락만 찍힌다. 거울 앞에 선 사람이 보는 건
 * 제 눈높이의 제 얼굴이라, 카메라도 그 높이로 내리되 유리 밖으로는 나가지 않게 조인다.
 */
const FACE_HEIGHT = EYE_HEIGHT - 0.24;
/** 얼굴이 떠오르고 사라지는 속도. 다가서면 서서히 맺히고, 물러나면 서서히 흩어진다. */
const FADE_LAMBDA = 2.5;
/** 유리 두께의 절반. 반사판(MirrorReflection)보다 조금 앞에 둔다. */
const FACE_LIFT = 0.006;

const cameraPosition = new Vector3();
const head = new Vector3();
const back = new Vector3();

/**
 * 세면대 앞에 서면 거울에 얼굴이 맺힌다.
 *
 * 방을 내려다보는 카메라의 반사(MirrorReflection)에는 정수리와 어깨만 잡힌다. 거울이
 * 보는 쪽에서 찍어야 얼굴이다: 유리 한가운데에 세운 카메라로 머리를 보고, 그 그림을
 * 좌우로 뒤집어 유리 위에 얹는다. 거울 앞에 선 사람에게 거울이 보여 주는 것이 바로
 * 이 그림이다. 세면대 앞에 섰을 때만 맺히고(active), 떨어지면 다시 방의 반사만 남는다.
 *
 * 대사도 창도 없다. 다가서면 얼굴이 떠오르는 것, 그뿐이다.
 *
 * 렌더 타깃 하나, 간격마다 씬을 한 번 더 그린다. Reflector와 같은 급이라 같은 가드를
 * 둔다: 그림자 갱신과 XR을 잠깐 끄고, 컴포저가 꺼 둔 autoClear 대신 직접 비운다.
 */
export function FaceMirror({
  width,
  height,
  offset,
  active,
}: {
  width: number;
  height: number;
  /** 유리면의 로컬 z. 얼굴 판은 그 바로 앞에 선다. */
  offset: number;
  /** 세면대 앞에 서 있는가. */
  active: boolean;
}) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const player = usePlayerPosition();
  const meshRef = useRef<Mesh>(null);
  const frameRef = useRef(0);
  const activeRef = useRef(active);
  activeRef.current = active;

  const { target, camera, material } = useMemo(() => {
    const renderTarget = new WebGLRenderTarget(FACE_SIZE, FACE_SIZE, { type: HalfFloatType });
    const faceCamera = new PerspectiveCamera(FACE_FOV, 1, 0.05, 8);
    // 1인칭 구간에 몸이 옮겨 가는 층도 본다. 화장실은 1인칭이 아니지만 거울의 규약이다
    faceCamera.layers.enable(MIRROR_ONLY_LAYER);
    const faceMaterial = new MeshBasicMaterial({
      map: renderTarget.texture,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      toneMapped: false,
      // 판을 좌우로 뒤집어 세우므로(scale -1) 뒷면이 앞이 된다
      side: DoubleSide,
    });
    return { target: renderTarget, camera: faceCamera, material: faceMaterial };
  }, []);

  useEffect(
    () => () => {
      target.dispose();
      material.dispose();
    },
    [target, material],
  );

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const goal = activeRef.current ? 1 : 0;
    material.opacity = MathUtils.damp(material.opacity, goal, FADE_LAMBDA, delta);
    if (material.opacity < 0.005) {
      material.opacity = 0;
      mesh.visible = false;
      return;
    }
    mesh.visible = true;
    frameRef.current += 1;
    if (frameRef.current % RENDER_INTERVAL !== 0) return;

    /*
     * 거울의 상은 유리 너머 같은 거리에 맺힌다. 카메라를 유리면에 붙이면 얼굴까지 거리가
     * 절반이라 두 배로 크게 찍힌다. 유리에서 얼굴까지의 거리만큼 유리 뒤로 물러선 자리에서
     * 눈높이로 본다: 실제 거울에 비치는 크기다.
     */
    mesh.getWorldPosition(cameraPosition);
    head.set(player.current.x, player.current.y + FACE_HEIGHT, player.current.z);
    back.set(cameraPosition.x - head.x, 0, cameraPosition.z - head.z);
    camera.position.set(cameraPosition.x + back.x, head.y, cameraPosition.z + back.z);
    // 유리 뒤는 벽이다. 가까운 면을 유리면 바로 너머에 두어 벽을 잘라 내고 방만 찍는다
    camera.near = back.length() + 0.02;
    camera.updateProjectionMatrix();
    camera.lookAt(head);
    camera.updateMatrixWorld();

    // 제 판은 찍지 않는다 (유리 속에 유리가 비친다)
    mesh.visible = false;
    const { shadowMap, xr } = gl;
    const shadowAutoUpdate = shadowMap.autoUpdate;
    const xrEnabled = xr.enabled;
    shadowMap.autoUpdate = false;
    xr.enabled = false;
    gl.setRenderTarget(target);
    gl.clear();
    gl.render(scene, camera);
    gl.setRenderTarget(null);
    shadowMap.autoUpdate = shadowAutoUpdate;
    xr.enabled = xrEnabled;
    mesh.visible = true;
  });

  return (
    // 거울은 좌우가 뒤집힌다. 판을 x로 뒤집어 세워 사진이 아니라 거울로 보이게 한다
    <mesh ref={meshRef} position={[0, 0, offset + FACE_LIFT]} scale={[-1, 1, 1]} visible={false}>
      <planeGeometry args={[width, height]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}
