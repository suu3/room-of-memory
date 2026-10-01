"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { RisingDust } from "@/components/ui/boot/RisingDust";
import { BUTTON_PRIMARY, BUTTON_QUIET } from "@/components/ui/shared/ui-classes";

function subscribeOnline(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

const onlineNow = () => navigator.onLine;
/** 서버는 연결을 모른다. 끊겼다고 단정하면 첫 그림이 틀린 말을 한다 */
const onlineOnServer = () => true;

/**
 * 페이지를 못 불러왔을 때: Next 기본 "This page couldn't load" 대신 404와 같은 문법
 * (어두운 바탕, 떠오르는 먼지, 픽셀 서체 제목)으로 선다.
 *
 * 폰에서 가장 흔한 원인은 연결 끊김이라 그 경우를 따로 말한다. 끊긴 동안은 다시 시도해도
 * 같은 화면이 돌아올 뿐이라 버튼을 잠그고, 연결이 돌아오는 순간 스스로 다시 시도한다.
 * 방으로 돌아가기는 `<Link>`가 아니라 문서 이동이다: 클라이언트 이동은 방금 실패한
 * 그 요청을 다시 밟는다.
 */
export function LoadError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const { t } = useTranslation();
  const online = useSyncExternalStore(subscribeOnline, onlineNow, onlineOnServer);

  useEffect(() => {
    console.error(error);
  }, [error]);

  useEffect(() => {
    const onOnline = () => retry();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [retry]);

  return (
    <main className="relative grid min-h-dvh w-full place-items-center overflow-hidden bg-night px-6 py-16">
      <RisingDust count={18} />
      <div role="alert" className="relative flex max-w-md flex-col items-center gap-3 text-center">
        <h1 className="title-logo break-ko font-pixel text-4xl leading-tight text-ivory md:text-5xl">
          {online ? t("loadError.title") : t("loadError.offlineTitle")}
        </h1>
        <p className="mt-1 break-ko text-pretty text-sm leading-normal text-fog">
          {online ? t("loadError.body") : t("loadError.offlineBody")}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" className={BUTTON_PRIMARY} disabled={!online} onClick={retry}>
            {online ? t("loadError.retry") : t("loadError.waiting")}
          </button>
          <a href="/" className={BUTTON_QUIET}>
            {t("contact.back")}
          </a>
        </div>
      </div>
    </main>
  );
}
