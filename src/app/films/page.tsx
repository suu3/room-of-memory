"use client";

import Link from "next/link";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { BUTTON_QUIET } from "@/components/ui/shared/ui-classes";
import { DEFAULT_LOCALE, type Locale, SUPPORTED_LOCALES } from "@/i18n/config";
import { ASSETS } from "@/lib/assets";

type Film = { id: "ending" | "thatSummer"; src: string; subtitles?: Record<Locale, string> };

/**
 * 모아 보는 영상. 순서가 곧 화면의 순서다. 글은 `films.<id>.*`에 있다.
 * 음성 대사가 있는 영상은 언어별 자막을 단다 (엔딩은 대사가 그림 안에 있어 없다).
 */
const FILMS: readonly Film[] = [
  { id: "ending", src: ASSETS.video.endingFilm },
  {
    id: "thatSummer",
    src: ASSETS.video.sideStoryThatSummer,
    subtitles: ASSETS.video.sideStoryThatSummerSubtitles,
  },
];

const LOCALE_LABEL: Record<Locale, string> = { ko: "한국어", en: "English", ja: "日本語" };

const localeOf = (language: string | undefined): Locale =>
  SUPPORTED_LOCALES.find((locale) => locale === language) ?? DEFAULT_LOCALE;

/**
 * 자막 트랙을 켠다. `default` 속성은 영상이 처음 설 때만 읽혀서, 저장된 언어가 뒤늦게 들어와
 * 트랙이 바뀌면 꺼진 채로 남는다.
 */
const showTrack = (node: HTMLTrackElement | null) => {
  if (node) node.track.mode = "showing";
};

/**
 * 영상 모아보기. 엔딩 영상과 외전을 한 자리에서 다시 본다. 엔딩 카드의 버튼이 새 탭으로
 * 연다: 같은 탭에서 라우트를 타면 3D 캔버스가 통째로 다시 마운트되고, 돌아왔을 때 엔딩이
 * 문턱부터 다시 돈다.
 *
 * 받기는 메타데이터까지만 해 둔다 (두 편을 합치면 36MB라 누르기 전에 통째로 받지 않는다).
 */
export default function FilmsPage() {
  const { t, i18n } = useTranslation();
  const locale = localeOf(i18n.resolvedLanguage);
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
            {/* biome-ignore lint/a11y/useMediaCaption: 엔딩은 대사가 그림 안에 있어 트랙이 없고, 외전은 아래에서 자막을 단다 */}
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
            >
              {film.subtitles && (
                <track
                  key={locale}
                  ref={showTrack}
                  kind="subtitles"
                  src={film.subtitles[locale]}
                  srcLang={locale}
                  label={LOCALE_LABEL[locale]}
                  default
                />
              )}
            </video>
          </section>
        ))}

        <Link href="/" className={`${BUTTON_QUIET} self-start`}>
          ← {t("contact.back")}
        </Link>
      </div>
    </main>
  );
}
