"use client";

import { useEffect, useState } from "react";

/**
 * CSS 미디어 쿼리 하나를 리액트 값으로 읽는다.
 *
 * 서버 렌더와 첫 클라이언트 렌더는 항상 false다. 미디어 쿼리는 브라우저에만 있어서
 * 첫 렌더부터 갈라놓으면 hydration이 어긋난다 (i18n/control-hint의 usePointerKind와
 * 같은 규칙). 마운트 직후 한 번 더 렌더되며 진짜 값으로 바뀐다.
 *
 * CSS로 숨기고 보이는 것으로 충분하면 이 훅을 쓰지 않는다. 같은 것을 **두 자리 중 한 곳에만**
 * 마운트해야 할 때(둘 다 그리면 role="status"가 두 번 읽히는 HUD 안내 줄)만 쓴다.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const list = window.matchMedia(query);
    const sync = () => setMatches(list.matches);
    sync();
    // iOS 14 미만의 Safari는 MediaQueryList에 addEventListener가 없다. 첫 판정만 쓴다
    if (typeof list.addEventListener !== "function") return;
    list.addEventListener("change", sync);
    return () => list.removeEventListener("change", sync);
  }, [query]);

  return matches;
}
