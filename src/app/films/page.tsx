"use client";

import Link from "next/link";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { BUTTON_QUIET } from "@/components/ui/shared/ui-classes";
import { ASSETS } from "@/lib/assets";

/** 모아 보는 영상. 순서가 곧 화면의 순서다. 글은 `films.<id>.*`에 있다. */
const FILMS = [
  { id: "ending", src: ASSETS.video.endingFilm },
  { id: "thatSummer", src: ASSETS.video.sideStoryThatSummer },
] as const;

/**
 * 영상 모아보기. 엔딩 영상과 외전을 한 자리에서 다시 본다. 엔딩 카드의 버튼이 새 탭으로
 * 연다: 같은 탭에서 라우트를 타면 3D 캔버스가 통째로 다시 마운트되고, 돌아왔을 때 엔딩이
 * 문턱부터 다시 돈다.
 *
 * 받기는 메타데이터까지만 해 둔다 (두 편을 합치면 36MB라 누르기 전에 통째로 받지 않는다).
 */
export default function FilmsPage() {
  const { t } = useTranslation();
  const videos = useRef(new Map<string, HTMLVideoElement>());

  /** 한 번에 한 편만 튼다: 다른 영상을 틀면 보던 것은 멈춘다. */
  const pauseOthers = (playing: string) => {
    for (const [id, video] of videos.current) {
      if (id !== playing) video.pause();
    }
  };

  return (
    <main className="min-h-dvh bg-night px-6 py-16">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-12">
        <header className="flex flex-col gap-3">
          <p className="font-pixel text-xs tracking-[0.3em] text-memory">{t("films.eyebrow")}</p>
          <h1 className="break-ko font-pixel text-3xl leading-snug text-ivory md:text-4xl">
            {t("films.title")}
          </h1>
          <p className="break-ko text-pretty text-sm leading-normal text-fog">
            {t("films.spoiler")}
          </p>
        </header>

        {FILMS.map((film) => (
          <section key={film.id} className="flex flex-col gap-3">
            <h2 className="break-ko text-lg font-medium leading-snug text-ivory">
              {t(`films.${film.id}.title`)}
            </h2>
            <p className="break-ko text-pretty text-sm leading-normal text-fog">
              {t(`films.${film.id}.caption`)}
            </p>
            {/* biome-ignore lint/a11y/useMediaCaption: 자막 트랙이 없는 영상이다 (대사는 그림 안에 있다) */}
            <video
              ref={(node) => {
                if (node) videos.current.set(film.id, node);
                else videos.current.delete(film.id);
              }}
              src={film.src}
              controls
              playsInline
              preload="metadata"
              aria-label={t(`films.${film.id}.title`)}
              onPlay={() => pauseOthers(film.id)}
              className="aspect-video w-full rounded-md border border-line bg-scene-void shadow-panel"
            />
          </section>
        ))}

        <Link href="/" className={`${BUTTON_QUIET} self-start`}>
          ← {t("contact.back")}
        </Link>
      </div>
    </main>
  );
}
