"use client";

import { useState } from "react";
import { LabFrame } from "@/app/lab/LabFrame";
import { PhotoMorph } from "@/components/ui/PhotoMorph";
import { morphSeed } from "@/components/ui/photo-morph";
import { REPLAY_MORPH_WITHIN } from "@/data/memory-room";
import { ASSETS } from "@/lib/assets";

const button =
  "rounded-sm border border-fog/30 px-3 py-1.5 text-sm hover:border-memory focus-visible:outline-memory";

/**
 * 사진 밀림의 단독 데모 (액자 다시보기).
 *
 * 본편에서는 2막에 액자를 되짚을 때 한 번 선다. 여기서는 "다시"를 눌러 몇 번이고 본다.
 * `gamePhase` 1은 1막 다시보기가 보는 화면(밀림 없이 1막 사진만)이고, 2가 밀림이다.
 * `intensity`는 미는 거리(0~0.16, 기본값은 0.08이므로 슬라이더 가운데)이고, `enabled`를
 * 끄면 2막 사진이 곧장 선다: 본편에서 모션을 끈 사람이 보는 화면이다.
 *
 * 판의 크기·비율을 PlaybackScene의 다시보기 스틸 자리와 같게 잡는다. 두 사진의 비율이
 * 달라서(1막 560×511, 2막 620×496) 판이 달라지면 앉는 자리가 달라진다.
 */
export function PhotoMorphLab() {
  const [round, setRound] = useState(0);

  return (
    <LabFrame
      title="액자 다시보기 · 사진이 사진으로 밀린다"
      note="1막 사진(부모 얼굴이 틀 밖으로 잘린 것)으로 열렸다가 2막 사진(셋이 다 들어온 것)으로 넘어간다. 틀이 물러나며 잘려 있던 바깥(부모 얼굴)이 들어오고, 두 그림은 늘 겹쳐 세워져 소년이 제자리에 있다. 물 얼룩이 변위장이다. intensity가 미는 거리, 1차 토글은 밀림 없는 1막 화면."
    >
      {({ intensity, gamePhase, enabled }) => {
        const morphing = gamePhase === 2 && enabled;
        const key = `lab:${round}:${intensity.toFixed(2)}`;
        return (
          <div className="space-y-3">
            {/* 다시보기 스틸 자리: 어두운 방 위에 사진 한 장이 통째로 선다 */}
            <div className="grid w-full place-items-center bg-scene-void p-6">
              <div className="relative aspect-[4/3] w-full max-w-[32rem]">
                {/* biome-ignore lint/performance/noImgElement: PlaybackScene의 스틸과 같은 구조를 그대로 세워야 실험실이 본편을 대신한다. */}
                <img
                  src={
                    gamePhase === 1
                      ? ASSETS.images.mgPhotoWipePhase1
                      : ASSETS.images.mgPhotoWipePhase2
                  }
                  alt=""
                  draggable={false}
                  className={`absolute inset-0 size-full select-none object-contain transition-opacity duration-300 ${
                    morphing ? "opacity-0" : "opacity-100"
                  }`}
                />
                {morphing && (
                  <PhotoMorph
                    key={key}
                    from={ASSETS.images.mgPhotoWipePhase1}
                    to={ASSETS.images.mgPhotoWipePhase2}
                    within={REPLAY_MORPH_WITHIN.frame}
                    seed={morphSeed("replay:frame:0:morph")}
                    amplitude={intensity * 0.16}
                  />
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <button type="button" className={button} onClick={() => setRound((n) => n + 1)}>
                다시
              </button>
              <p className="text-sm text-fog">
                미는 거리 {(intensity * 0.16).toFixed(3)} (기본 0.080) · 지연 700ms · 1300ms
              </p>
            </div>
          </div>
        );
      }}
    </LabFrame>
  );
}
