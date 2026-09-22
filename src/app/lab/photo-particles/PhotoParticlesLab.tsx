"use client";

import { LabFrame } from "@/app/lab/LabFrame";
import { ASSETS } from "@/lib/assets";
import { PhotoParticles } from "@/minigames/photo-particles/PhotoParticles";
import { PARTICLE_TARGET } from "@/minigames/photo-particles/particles";
import { PhotoFrame } from "@/minigames/photo-wipe/frame";

/**
 * 액자 입자의 단독 데모 (docs/visual-experiments.md 4장 · 10장 7번).
 *
 * photo-wipe의 `revealed` 화면과 같은 액자에 같은 사진을 입자로 얹는다. 1차는 얼굴이
 * 끝까지 안 모이는 사진, 2차는 퍼즐을 맞춘 뒤처럼 얼굴까지 모인다(`gathered`).
 * `intensity`는 커서가 미는 반경. `enabled`를 끄면 사진 한 장이 그대로 선다.
 * 페이즈를 바꾸면 처음부터 다시 날아온다 (key로 다시 마운트).
 */
const PHOTOS = {
  1: { src: ASSETS.images.mgPhotoWipePhase1, width: 560, height: 511 },
  2: { src: ASSETS.images.mgPhotoWipePhase2, width: 620, height: 496 },
} as const;

export function PhotoParticlesLab() {
  return (
    <LabFrame
      title="가족사진 액자 · 입자로 풀리고 모이는 사진"
      note="사진 위로 커서를 지나면 그 자리가 풀리고 멈추면 모인다. 1차는 부모 얼굴 자리가 안 모이고, 2차는 얼굴까지 모인다. intensity가 커서 반경."
    >
      {({ intensity, gamePhase, enabled }) => {
        const photo = PHOTOS[gamePhase];
        return (
          <div className="space-y-3">
            <PhotoFrame>
              <PhotoParticles
                key={gamePhase}
                src={photo.src}
                width={photo.width}
                height={photo.height}
                gamePhase={gamePhase}
                enabled={enabled}
                gathered={gamePhase === 2}
                intensity={intensity}
                className="block max-h-[58vh] w-auto max-w-[86vw]"
              />
            </PhotoFrame>
            <p className="text-sm text-fog">
              입자 약 {PARTICLE_TARGET.toLocaleString()}개 · Canvas 2D fillRect · 얼굴 스프링{" "}
              {gamePhase === 2 ? "= 본체 스프링 (모인다)" : "0 (떠돈다)"}
            </p>
          </div>
        );
      }}
    </LabFrame>
  );
}
