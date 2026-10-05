"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import type { InspectCapture, InspectObject } from "@/components/canvas/InspectTurntable";
import { pitchFromDrag, UNFOLD_PX } from "@/components/canvas/inspect-math";
import {
  ampouleObject,
  ID_CARD_SPOT,
  idCardObject,
  tableNoteObject,
  workbookObject,
} from "@/components/canvas/inspect-objects";
import { i18n, type Locale, SUPPORTED_LOCALES } from "@/i18n/config";

const InspectTurntable = dynamic(() => import("@/components/canvas/InspectTurntable"), {
  ssr: false,
});

/** 게임 안 판(34rem × 20rem)의 두 배. 찍은 한 장이 그 판 자리에 그대로 선다. */
const STAGE = { width: 1088, height: 640 } as const;
/** 글꼴·모델이 오고 확대·펼침이 자리 잡을 때까지 기다리는 시간(ms). */
const SETTLE_MS = 5000;

interface Shot {
  /** `public/assets/images/` 아래 파일 이름. */
  name: string;
  object: InspectObject;
  /** 찾을 것을 본 자세. */
  yaw: number;
  dragY: number;
}

/** 물건의 찾는 각도. 상자·모델만 가진다. */
const foundYawOf = (object: InspectObject) => ("foundYaw" in object ? object.foundYaw : 0);

/** 언어마다 글자가 다른 물건은 언어별로, 글자 없는 앰플은 한 장만 찍는다. */
function shotsFor(locale: Locale): Shot[] {
  const t = i18n.getFixedT(locale, "common");
  const tRoom = i18n.getFixedT(locale, "memoryRoom");
  const note = tableNoteObject(t("minigame.cardFlip.memo"));
  const idCard = idCardObject({
    org: t("minigame.idCardFlip.org"),
    mom: {
      department: t("minigame.idCardFlip.mom.department"),
      name: t("minigame.idCardFlip.mom.name"),
      role: t("minigame.idCardFlip.mom.role"),
    },
    dad: {
      department: t("minigame.idCardFlip.dad.department"),
      name: t("minigame.idCardFlip.dad.name"),
      role: t("minigame.idCardFlip.dad.role"),
    },
  });
  const workbook = workbookObject({
    name: tRoom("characters.hero.name"),
    tagLabel: t("clue.workbook.tagLabel"),
  });
  return [
    { name: `still-cards-${locale}.webp`, object: note, yaw: 0, dragY: -UNFOLD_PX },
    {
      name: `still-id-card-${locale}.webp`,
      object: idCard,
      yaw: ID_CARD_SPOT.yaw,
      // pitchFromDrag는 한계 안에서 선형이다: 1px의 기울기로 나눠 되돌린다
      dragY: ID_CARD_SPOT.pitch / pitchFromDrag(1),
    },
    {
      name: `still-workbook-${locale}.webp`,
      object: workbook,
      yaw: foundYawOf(workbook),
      dragY: 0,
    },
  ];
}

function allShots(): Shot[] {
  const ampoule = ampouleObject();
  return [
    ...SUPPORTED_LOCALES.flatMap(shotsFor),
    { name: "still-ampoule-vial.webp", object: ampoule, yaw: foundYawOf(ampoule), dragY: 0 },
  ];
}

/** 한 장을 세우고, 자리 잡으면 찍어 넘긴다. */
function ShotStage({ shot, onDone }: { shot: Shot; onDone: (message: string) => void }) {
  const yawRef = useRef(shot.yaw);
  const zoomRef = useRef(1);
  const dragYRef = useRef(shot.dragY);
  const captureRef = useRef<InspectCapture | null>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      const dataUrl = captureRef.current?.();
      if (!dataUrl) {
        onDoneRef.current(`${shot.name}: 찍지 못했다`);
        return;
      }
      const response = await fetch("/admin/stills/api", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: shot.name, dataUrl }),
      });
      const result = (await response.json()) as { bytes?: number; error?: string };
      onDoneRef.current(
        response.ok ? `${shot.name}: ${result.bytes} bytes` : `${shot.name}: ${result.error}`,
      );
    }, SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [shot]);

  return (
    <div className="inspect-stage" style={STAGE}>
      <InspectTurntable
        object={shot.object}
        yawRef={yawRef}
        zoomRef={zoomRef}
        dragYRef={dragYRef}
        onFound={() => {}}
        captureRef={captureRef}
      />
    </div>
  );
}

export function StillCapture() {
  const shots = useMemo(allShots, []);
  const [index, setIndex] = useState(-1);
  const [log, setLog] = useState<string[]>([]);
  const shot = shots[index];

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => {
          setLog([]);
          setIndex(0);
        }}
        disabled={shot !== undefined}
        className="w-fit cursor-pointer rounded border border-[var(--admin-line)] px-4 py-2 disabled:opacity-50"
      >
        {shots.length}장 찍기
      </button>
      {shot && (
        <ShotStage
          key={shot.name}
          shot={shot}
          onDone={(message) => {
            setLog((lines) => [...lines, message]);
            setIndex((value) => value + 1);
          }}
        />
      )}
      <ol data-testid="still-log" className="text-sm">
        {log.map((line) => (
          <li key={line}>{line}</li>
        ))}
        {index >= shots.length && <li>끝</li>}
      </ol>
    </div>
  );
}
