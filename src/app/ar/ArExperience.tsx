"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import Link from "next/link";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { type Group, Matrix4, type PerspectiveCamera, Quaternion, Vector3 } from "three";
import { LOCALE_PATHS } from "@/i18n/locale-routes";
import { ASSETS } from "@/lib/assets";
import { selectLocale, useSettingsStore } from "@/store/settings";
import { ArActionPicker } from "./ArActionPicker";
import { ArHero } from "./ArHero";
import type { ArAction } from "./ar-motion";
import { loadMindar, type MindarController } from "./mindar";

/*
 * 포토카드를 비추면 카드 위에 도해가 튀어나온다 (테스트용 시제품).
 *
 * 카메라 영상은 <video>가 화면을 꽉 채우고(object-cover), 그 위에 투명한 r3f 캔버스를 겹친다.
 * MindAR Controller가 영상에서 카드를 찾아 카메라 기준 행렬을 주면, 앵커 그룹에 그대로 꽂는다.
 * 카메라는 원점에 두고 화각만 Controller의 투영에 맞춘다 (MindARThree.resize와 같은 계산).
 */

type Phase = "idle" | "starting" | "scanning" | "found" | "error";
type ArError = "noCamera" | "denied" | "unknown";
/** 카드를 책상에 눕혔는지(도해가 카드 면에 선다), 세워 들었는지(카드 면에서 앞으로 나온다). */
type Mount = "flat" | "upright";

interface Tracking {
  matrix: Matrix4;
  visible: boolean;
  /** 카드 가로를 1로 맞추는 보정 (MindARThree의 postMatrix). */
  post: Matrix4;
}

/** 흔들림 필터. 기본값(0.001, 1000)은 카드를 가만히 둬도 떨려서 조금 더 누른다. */
const FILTER_MIN_CF = 0.0001;
const FILTER_BETA = 0.01;
/** 카드 가로(=1) 대비 도해 크기. 모델 키가 1.55라 카드 세로(약 1.5)쯤 된다. */
const HERO_SCALE = 0.62;
/** 카드를 찾았을 때 튀어나오는 시간(s). */
const POP_SECONDS = 0.55;

function easeOutBack(t: number) {
  const c = 1.9;
  return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
}

function CameraSync({ projection }: { projection: Projection | null }) {
  const camera = useThree((state) => state.camera) as PerspectiveCamera;
  const size = useThree((state) => state.size);
  useEffect(() => {
    if (!projection) return;
    const { matrix: m, inputWidth, inputHeight } = projection;
    const inputRatio = inputWidth / inputHeight;
    const containerRatio = size.width / size.height;
    // 영상이 화면보다 넓으면 좌우가 잘리고 세로는 꽉 찬다. 반대면 위아래가 잘린다.
    const displayHeight =
      inputRatio > containerRatio ? size.height : (size.width / inputWidth) * inputHeight;
    const fovAdjust = size.height / displayHeight;
    camera.fov = (2 * Math.atan((1 / m[5]) * fovAdjust) * 180) / Math.PI;
    camera.near = m[14] / (m[10] - 1);
    camera.far = m[14] / (m[10] + 1);
    camera.aspect = size.width / size.height;
    camera.updateProjectionMatrix();
  }, [camera, projection, size]);
  return null;
}

interface Projection {
  matrix: number[];
  inputWidth: number;
  inputHeight: number;
}

function Anchor({
  tracking,
  mount,
  action,
  active,
}: {
  tracking: Tracking;
  mount: Mount;
  action: ArAction;
  active: boolean;
}) {
  const anchorRef = useRef<Group>(null);
  const popRef = useRef<Group>(null);
  const popTime = useRef(0);

  useFrame((_, delta) => {
    const anchor = anchorRef.current;
    const pop = popRef.current;
    if (!anchor || !pop) return;
    anchor.visible = tracking.visible;
    if (!tracking.visible) {
      popTime.current = 0;
      return;
    }
    anchor.matrix.copy(tracking.matrix);
    popTime.current = Math.min(POP_SECONDS, popTime.current + delta);
    pop.scale.setScalar(HERO_SCALE * easeOutBack(popTime.current / POP_SECONDS));
  });

  // 앵커 공간: 카드가 XY 평면(가로 1), +Y가 그림 위쪽, +Z가 카드 앞(보는 사람 쪽).
  // 눕힘: 모델의 위(+Y)를 카드 앞(+Z)으로 세우고, 얼굴은 카드 아래쪽 가장자리를 본다.
  const rotation: [number, number, number] = mount === "flat" ? [Math.PI / 2, 0, 0] : [0, 0, 0];
  const position: [number, number, number] = mount === "flat" ? [0, -0.15, 0] : [0, -0.55, 0.12];

  return (
    <group ref={anchorRef} matrixAutoUpdate={false} visible={false}>
      <group position={position} rotation={rotation}>
        <group ref={popRef} scale={0}>
          <Suspense fallback={null}>
            <ArHero action={action} active={active} />
          </Suspense>
          {/* 발밑 그림자. 없으면 카드 위에 떠 있는 것처럼 보인다 */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
            <circleGeometry args={[0.42, 32]} />
            <meshBasicMaterial color="black" transparent opacity={0.28} depthWrite={false} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

export function ArExperience() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controllerRef = useRef<MindarController | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trackingRef = useRef<Tracking>({
    matrix: new Matrix4(),
    visible: false,
    post: new Matrix4(),
  });
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<ArError | null>(null);
  const { t } = useTranslation("ar");
  // 언어는 QR 주소가 아니라 저장된 선택을 따른다 (루트 / 와 같은 규칙). 카드 한 장에 QR 하나라서.
  const locale = useSettingsStore(selectLocale);
  const [mount, setMount] = useState<Mount>("flat");
  const [action, setAction] = useState<ArAction>("toss");
  const [projection, setProjection] = useState<Projection | null>(null);

  const stop = useCallback(() => {
    controllerRef.current?.stopProcessVideo();
    controllerRef.current?.dispose();
    controllerRef.current = null;
    for (const track of streamRef.current?.getTracks() ?? []) track.stop();
    streamRef.current = null;
  }, []);

  useEffect(() => stop, [stop]);

  async function start() {
    const video = videoRef.current;
    if (!video) return;
    setPhase("starting");
    setError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setPhase("error");
        setError("noCamera");
        return;
      }
      const [stream, { Controller }] = await Promise.all([
        navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        }),
        loadMindar(),
      ]);
      streamRef.current = stream;
      video.srcObject = stream;
      await new Promise<void>((resolve) => {
        if (video.readyState >= 1) resolve();
        else video.addEventListener("loadedmetadata", () => resolve(), { once: true });
      });
      await video.play();
      // Controller는 video.width/height 속성을 입력 크기로 읽는다.
      video.width = video.videoWidth;
      video.height = video.videoHeight;

      const tracking = trackingRef.current;
      const controller = new Controller({
        inputWidth: video.videoWidth,
        inputHeight: video.videoHeight,
        filterMinCF: FILTER_MIN_CF,
        filterBeta: FILTER_BETA,
        onUpdate: (data) => {
          if (data.type !== "updateMatrix") return;
          const found = data.worldMatrix !== null;
          if (data.worldMatrix) {
            tracking.matrix.fromArray(data.worldMatrix).multiply(tracking.post);
          }
          if (found !== tracking.visible) {
            tracking.visible = found;
            setPhase(found ? "found" : "scanning");
          }
        },
      });
      controllerRef.current = controller;
      const { dimensions } = await controller.addImageTargets(ASSETS.ar.target);
      const [width, height] = dimensions[0];
      tracking.post.compose(
        new Vector3(width / 2, width / 2 + (height - width) / 2, 0),
        new Quaternion(),
        new Vector3(width, width, width),
      );
      setProjection({
        matrix: controller.getProjectionMatrix(),
        inputWidth: controller.inputWidth,
        inputHeight: controller.inputHeight,
      });
      await controller.dummyRun(video);
      controller.processVideo(video);
      setPhase("scanning");
    } catch (cause) {
      console.error(cause);
      stop();
      setPhase("error");
      setError(
        cause instanceof DOMException && cause.name === "NotAllowedError"
          ? "denied"
          : cause instanceof DOMException && cause.name === "NotFoundError"
            ? "noCamera"
            : "unknown",
      );
    }
  }

  return (
    <main className="fixed inset-0 overflow-hidden bg-night text-ivory">
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        playsInline
        muted
        autoPlay
      />
      <Canvas
        style={{ position: "absolute", inset: 0 }}
        camera={{ position: [0, 0, 0], near: 10, far: 100000 }}
        gl={{ alpha: true, antialias: true }}
        dpr={[1, 2]}
      >
        <CameraSync projection={projection} />
        <ambientLight intensity={1.35} />
        <directionalLight position={[2.5, 3.5, 3]} intensity={1.7} />
        <directionalLight position={[-3, 1.5, -2]} intensity={0.5} />
        <Anchor
          tracking={trackingRef.current}
          mount={mount}
          action={action}
          active={phase === "found"}
        />
      </Canvas>

      {phase === "idle" || phase === "error" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-night/90 p-6 text-center">
          <p className="text-lg font-semibold">{t("intro.title")}</p>
          <p className="max-w-xs text-sm text-fog">{t("intro.body")}</p>
          {error && <p className="max-w-xs text-sm text-ember">{t(`error.${error}`)}</p>}
          <button
            type="button"
            onClick={start}
            className="rounded-full bg-memory px-6 py-3 font-semibold text-night"
          >
            {t("intro.start")}
          </button>
          <Link href="/ar/target" className="text-sm text-fog underline">
            {t("intro.noCard")}
          </Link>
        </div>
      ) : (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
            <p className="rounded-sm border border-line bg-surface px-3 py-2 text-ivory shadow-panel">
              {t(
                `status.${phase === "starting" ? "starting" : phase === "scanning" ? "scanning" : "found"}`,
              )}
            </p>
            <button
              type="button"
              onClick={() => setMount((current) => (current === "flat" ? "upright" : "flat"))}
              className="pointer-events-auto rounded-sm border border-line bg-surface px-3 py-2 text-fog shadow-panel transition-colors duration-150 hover:text-ivory active:bg-surface-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-memory"
            >
              {t(mount === "flat" ? "mount.toUpright" : "mount.toFlat")}
            </button>
          </div>
          {phase === "found" ? (
            <div className="pointer-events-auto flex w-full justify-center">
              <ArActionPicker value={action} onChange={setAction} />
            </div>
          ) : null}
        </div>
      )}

      {/*
       * 본편으로는 문서 이동이다 (<Link>가 아니다). 클라이언트 이동이면 MindAR의 tfjs WebGL
       * 컨텍스트와 워커가 같은 탭에 남은 채 방이 뜬다. 새로 열어야 AR이 본편에 아무것도 안 남긴다.
       */}
      <a
        href={LOCALE_PATHS[locale]}
        className="absolute top-[max(1rem,env(safe-area-inset-top))] right-4 rounded-full border border-line bg-night/70 px-4 py-2 text-sm"
      >
        {t("toRoom")}
      </a>
    </main>
  );
}
