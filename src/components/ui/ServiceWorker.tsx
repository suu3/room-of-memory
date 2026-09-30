"use client";

import { useEffect } from "react";

/**
 * 서비스 워커 등록.
 *
 * dev에서는 등록하지 않는다. 캐시 우선 규칙이 HMR과 정면으로 부딪혀서,
 * 코드를 고쳐도 옛 파일이 나오는 걸 한참 뒤에야 알아차리게 된다.
 *
 * 등록은 load 이후로 미룬다. 첫 화면에 3D 씬과 폰트가 한꺼번에 몰리는데
 * 서비스 워커 설치까지 같은 구간에 겹치면 그만큼 첫 프레임이 늦어진다.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") {
      // 같은 주소에서 프로덕션(pnpm start)을 돌린 뒤라면 그 워커가 남아 dev 파일을
      // 캐시 우선으로 내준다. dev에서는 남은 워커를 걷어 낸다
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) void registration.unregister();
      });
      return;
    }

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch((error) => {
        // 등록 실패는 게임을 막지 않는다. 오프라인만 안 되는 상태로 그냥 돈다
        console.warn("Service worker registration failed.", error);
      });
    };

    if (document.readyState === "complete") {
      register();
      return;
    }
    window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
