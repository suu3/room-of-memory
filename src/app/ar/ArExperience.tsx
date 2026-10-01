"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Euler, type Group, Matrix4, type PerspectiveCamera, Quaternion, Vector3 } from "three";
import { LanguageToggle } from "@/components/ui/hud/LanguageToggle";
import { LOCALE_PATHS } from "@/i18n/locale-routes";
import { ASSETS } from "@/lib/assets";
import { selectLocale, useSettingsStore } from "@/store/settings";
import { ArActionPicker } from "./ArActionPicker";
import { ArHero } from "./ArHero";
import type { ArAction } from "./ar-motion";
import { loadMindar, type MindarController } from "./mindar";

/*
 * 포토카드를 비추면 도해가 카드에서 튀어나와 화면으로 뛰어나온다 (테스트용 시제품).
 *
 * 카메라 영상은 <video>가 화면을 꽉 채우고(object-cover), 그 위에 투명한 r3f 캔버스를 겹친다.
 * MindAR Controller가 영상에서 카드를 찾아 카메라 기준 행렬을 주면 도해를 카드 위에 세운다.
 * 카메라는 원점에 두고 화각만 Controller의 투영에 맞춘다 (MindARThree.resize와 같은 계산).
 *
 * 카드는 5.5cm라 거기 붙은 도해는 폰 화면에서 작다. 그래서 카드는 "소환 열쇠"로만 쓴다:
 * 카드 위에 톡 튀어나온 뒤(card) 화면 가운데로 포물선을 그리며 뛰어나와(summoning) 크게
 * 선다(summoned). 그 뒤로는 카드를 계속 비출 필요가 없으니 인식을 멈춰 배터리를 아낀다.
 */

type Phase = "idle" | "starting" | "scanning" | "found" | "error";
/** 도해가 어디 서 있는지: 카드 위 → 뛰어나오는 중 → 화면 가운데. */
type Stage = "card" | "summoning" | "summoned";
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
/** 카드 위에 선 모습을 잠깐 보여 준 뒤 뛰어나온다(s). 바로 뛰면 카드에서 나왔다는 게 안 읽힌다. */
const SUMMON_DELAY_SECONDS = POP_SECONDS + 0.35;
/** 카드에서 화면 가운데까지 뛰는 시간(s). 모션 줄이기면 짧게, 포물선 없이 옮긴다. */
const SUMMON_SECONDS = 0.9;
const SUMMON_SECONDS_REDUCED = 0.3;
/** 화면에 섰을 때 도해 키가 화면 세로에서 차지하는 비율, 발이 놓이는 높이(가운데 0, 아래 끝 -0.5). */
const SCREEN_HERO_HEIGHT = 0.6;
const SCREEN_FEET_Y = -0.28;
/** 화면 모드에서 도해를 세우는 거리. 원근만 정하므로 값 자체는 중요하지 않다 (카메라 near 10 너머). */
const SCREEN_DISTANCE = 1000;
/** 모델 키 (player-blocky, 발 y=0). */
const MODEL_HEIGHT = 1.55;
/** 뛰어나올 때 포물선 꼭대기 (화면 세로 대비). */
const SUMMON_ARC = 0.18;
/** 핀치로 키울 수 있는 범위. */
const ZOOM_MIN = 0.6;
const ZOOM_MAX = 1.8;
/** 가로로 화면 폭만큼 끌면 몇 바퀴 도는지 (rad). */
const DRAG_TURN = Math.PI * 2;

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function easeOutBack(t: number) {
  const c = 1.9;
  return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
}

function easeInOut(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/** 화면 모드의 손놀림. 값으로 내리면 드래그 한 번에 수십 번 리렌더된다. */
interface ScreenControl {
  yaw: number;
  zoom: number;
}

const cardLocal = new Matrix4();
const cardLocalRotation = new Quaternion();
const cardLocalEuler = new Euler();
const cardLocalPosition = new Vector3();
const cardLocalScale = new Vector3();
const screenPosition = new Vector3();
const screenRotation = new Quaternion();
const screenScale = new Vector3();
const yawAxis = new Vector3(0, 1, 0);
const blendPosition = new Vector3();
const blendRotation = new Quaternion();
const blendScale = new Vector3();

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

function HeroStage({
  tracking,
  mount,
  action,
  stage,
  control,
}: {
  tracking: Tracking;
  mount: Mount;
  action: ArAction;
  stage: Stage;
  control: ScreenControl;
}) {
  const heroRef = useRef<Group>(null);
  const camera = useThree((state) => state.camera) as PerspectiveCamera;
  const popTime = useRef(0);
  const summonTime = useRef(0);
  /** 뛰기 시작한 순간 카드 위의 자세. 그 뒤로 카드를 놓쳐도 여기서 출발한다. */
  const from = useRef({
    position: new Vector3(),
    rotation: new Quaternion(),
    scale: new Vector3(),
  });
  const lastStage = useRef<Stage>(stage);
  const summonSeconds = useRef(SUMMON_SECONDS);

  useEffect(() => {
    summonSeconds.current = reducedMotion() ? SUMMON_SECONDS_REDUCED : SUMMON_SECONDS;
  }, []);

  useFrame((_, delta) => {
    const hero = heroRef.current;
    if (!hero) return;
    const step = Math.min(delta, 0.05);

    // 카드 위 자세: 카드 행렬 × (눕힘/세움 자리) × 튀어나오는 크기
    // 앵커 공간: 카드가 XY 평면(가로 1), +Y가 그림 위쪽, +Z가 카드 앞(보는 사람 쪽).
    // 눕힘: 모델의 위(+Y)를 카드 앞(+Z)으로 세우고, 얼굴은 카드 아래쪽 가장자리를 본다.
    const flat = mount === "flat";
    cardLocalPosition.set(0, flat ? -0.15 : -0.55, flat ? 0 : 0.12);
    cardLocalRotation.setFromEuler(cardLocalEuler.set(flat ? Math.PI / 2 : 0, 0, 0));
    const pop = easeOutBack(popTime.current / POP_SECONDS);
    cardLocalScale.setScalar(HERO_SCALE * Math.max(pop, 0.0001));
    cardLocal.compose(cardLocalPosition, cardLocalRotation, cardLocalScale);

    // 화면 자세: 카메라(원점, -Z를 봄) 앞에 세운다. 화각이 바뀌어도 화면 비율로 크기가 같다.
    const visibleHeight = 2 * SCREEN_DISTANCE * Math.tan((camera.fov * Math.PI) / 360);
    const scale = ((SCREEN_HERO_HEIGHT * visibleHeight) / MODEL_HEIGHT) * control.zoom;
    screenPosition.set(0, SCREEN_FEET_Y * visibleHeight, -SCREEN_DISTANCE);
    screenRotation.setFromAxisAngle(yawAxis, control.yaw);
    screenScale.setScalar(scale);

    if (stage !== lastStage.current) {
      if (stage === "summoning") {
        // 지금 카드 위에 선 그대로에서 출발한다
        hero.matrix.decompose(from.current.position, from.current.rotation, from.current.scale);
        summonTime.current = 0;
      }
      if (stage === "card") popTime.current = 0;
      lastStage.current = stage;
    }

    if (stage === "card") {
      hero.visible = tracking.visible;
      if (!tracking.visible) {
        popTime.current = 0;
        return;
      }
      popTime.current = Math.min(POP_SECONDS, popTime.current + step);
      hero.matrix.multiplyMatrices(tracking.matrix, cardLocal);
      return;
    }

    hero.visible = true;
    if (stage === "summoning") {
      summonTime.current = Math.min(summonSeconds.current, summonTime.current + step);
      const t = summonTime.current / summonSeconds.current;
      const eased = easeInOut(t);
      blendPosition.lerpVectors(from.current.position, screenPosition, eased);
      if (summonSeconds.current === SUMMON_SECONDS) {
        blendPosition.y += Math.sin(Math.PI * t) * SUMMON_ARC * visibleHeight;
      }
      blendRotation.slerpQuaternions(from.current.rotation, screenRotation, eased);
      blendScale.lerpVectors(from.current.scale, screenScale, eased);
      hero.matrix.compose(blendPosition, blendRotation, blendScale);
      return;
    }
    hero.matrix.compose(screenPosition, screenRotation, screenScale);
  });

  return (
    <group ref={heroRef} matrixAutoUpdate={false} visible={false}>
      <Suspense fallback={null}>
        <ArHero action={action} active={stage !== "card" || tracking.visible} />
      </Suspense>
      {/* 발밑 그림자. 없으면 카드 위에 떠 있는 것처럼 보인다 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <circleGeometry args={[0.42, 32]} />
        <meshBasicMaterial color="black" transparent opacity={0.28} depthWrite={false} />
      </mesh>
    </group>
  );
}

/**
 * 화면에 선 도해를 손으로 만진다: 한 손가락 가로 드래그는 돌리기, 두 손가락 핀치는 크기.
 * 값은 ref에 바로 쓴다. 프레임 루프가 읽는다.
 */
function ScreenGestures({ control }: { control: ScreenControl }) {
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = useRef<{ distance: number; zoom: number } | null>(null);

  const distance = () => {
    const [a, b] = [...pointers.current.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  return (
    <div
      aria-hidden
      className="absolute inset-0 touch-none"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (pointers.current.size === 2)
          pinchStart.current = { distance: distance(), zoom: control.zoom };
      }}
      onPointerMove={(event) => {
        const previous = pointers.current.get(event.pointerId);
        if (!previous) return;
        const next = { x: event.clientX, y: event.clientY };
        pointers.current.set(event.pointerId, next);
        if (pointers.current.size === 1) {
          control.yaw += ((next.x - previous.x) / window.innerWidth) * DRAG_TURN;
        } else if (pointers.current.size === 2 && pinchStart.current) {
          const zoom = (pinchStart.current.zoom * distance()) / pinchStart.current.distance;
          control.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom));
        }
      }}
      onPointerUp={(event) => {
        pointers.current.delete(event.pointerId);
        if (pointers.current.size < 2) pinchStart.current = null;
      }}
      onPointerCancel={(event) => {
        pointers.current.delete(event.pointerId);
        if (pointers.current.size < 2) pinchStart.current = null;
      }}
      onWheel={(event) => {
        // 데스크톱 확인용: 휠이 핀치를 대신한다
        control.zoom = Math.min(
          ZOOM_MAX,
          Math.max(ZOOM_MIN, control.zoom * (1 - event.deltaY * 0.001)),
        );
      }}
    />
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
  const [stage, setStage] = useState<Stage>("card");
  /**
   * 이번 소환에서 카드를 한 번이라도 찾았는지. 뛰어나오는 타이머는 여기에 건다: 카드가 작게 잡히면
   * 인식이 순간순간 끊기는데, found에 걸면 끊길 때마다 타이머가 처음부터 다시 돌아 영영 안 뛴다.
   */
  const [seenCard, setSeenCard] = useState(false);
  const controlRef = useRef<ScreenControl>({ yaw: 0, zoom: 1 });

  // 카드를 찾으면 잠깐 카드 위에 세웠다가 뛰어나오게 하고, 다 뛰면 인식을 멈춘다.
  // 타이머로 단계를 넘긴다: 프레임 루프 안에서 상태를 바꾸지 않는다 (.claude/rules/r3f.md).
  useEffect(() => {
    if (stage === "card" && seenCard) {
      const timer = window.setTimeout(() => setStage("summoning"), SUMMON_DELAY_SECONDS * 1000);
      return () => window.clearTimeout(timer);
    }
    if (stage === "summoning") {
      const seconds = reducedMotion() ? SUMMON_SECONDS_REDUCED : SUMMON_SECONDS;
      const timer = window.setTimeout(() => {
        controllerRef.current?.stopProcessVideo();
        setStage("summoned");
      }, seconds * 1000);
      return () => window.clearTimeout(timer);
    }
  }, [seenCard, stage]);

  function sendBack() {
    const video = videoRef.current;
    const controller = controllerRef.current;
    if (!video || !controller) return;
    trackingRef.current.visible = false;
    controlRef.current.yaw = 0;
    controlRef.current.zoom = 1;
    setStage("card");
    setSeenCard(false);
    setPhase("scanning");
    controller.processVideo(video);
  }

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
            if (found) setSeenCard(true);
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
        <HeroStage
          tracking={trackingRef.current}
          mount={mount}
          action={action}
          stage={stage}
          control={controlRef.current}
        />
      </Canvas>
      {stage === "summoned" ? <ScreenGestures control={controlRef.current} /> : null}

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
          {/* 언어는 시작 화면에서만 고른다. 카메라가 켜진 뒤 화면을 덮는 버튼은 적을수록 좋다 */}
          <div className="absolute top-[max(1rem,env(safe-area-inset-top))] left-4">
            <LanguageToggle tone="dark" />
          </div>
        </div>
      ) : (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
            {/* 찾은 뒤에는 말하지 않는다: 튀어나온 도해가 곧 신호다 */}
            {stage === "card" && phase !== "found" ? (
              <p className="rounded-sm border border-line bg-surface px-3 py-2 text-ivory shadow-panel">
                {t(phase === "starting" ? "status.starting" : "status.scanning")}
              </p>
            ) : null}
            {stage === "summoned" ? (
              <p className="rounded-sm border border-line bg-surface px-3 py-2 text-fog shadow-panel">
                {t("summon.hint")}
              </p>
            ) : null}
            <button
              type="button"
              onClick={
                stage === "summoned"
                  ? sendBack
                  : () => setMount((current) => (current === "flat" ? "upright" : "flat"))
              }
              disabled={stage === "summoning"}
              className="pointer-events-auto rounded-sm border border-line bg-surface px-3 py-2 text-fog shadow-panel transition-colors duration-150 hover:text-ivory active:bg-surface-strong disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-memory"
            >
              {stage === "summoned"
                ? t("summon.back")
                : t(mount === "flat" ? "mount.toUpright" : "mount.toFlat")}
            </button>
          </div>
          {stage !== "card" || phase === "found" ? (
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
        {t("toGame")}
      </a>
    </main>
  );
}
