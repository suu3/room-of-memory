"use client";

import type { ParseKeys } from "i18next";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

export type PointerKind = "keys" | "touch";

/**
 * 마우스·키보드로 노는 기기인지, 손가락으로 노는 기기인지.
 *
 * 서버 렌더와 첫 클라이언트 렌더는 항상 "keys"다. 미디어 쿼리는 브라우저에만
 * 있어서 첫 렌더부터 갈라놓으면 hydration이 어긋난다. 터치 기기에서는 마운트
 * 직후 한 번 더 렌더되며 문구가 바뀐다.
 */
export function usePointerKind(): PointerKind {
  const [kind, setKind] = useState<PointerKind>("keys");

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    // 마우스가 붙은 태블릿까지 터치로 몰지 않는다. 가리킬 수 없고(hover: none)
    // 손가락처럼 뭉툭한(pointer: coarse) 기기만.
    const query = window.matchMedia("(hover: none) and (pointer: coarse)");
    const sync = () => setKind(query.matches ? "touch" : "keys");
    sync();
    // iOS 14 미만의 Safari는 MediaQueryList에 addEventListener가 없다. 그 기기에서는
    // 첫 판정만 쓰고 넘어간다 (게임 중에 입력 방식이 바뀌는 일은 드물다).
    if (typeof query.addEventListener !== "function") return;
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return kind;
}

/**
 * 조작 안내 문구 전용 t.
 *
 * 키 이름을 나열한 문구는 폰에서 전부 거짓말이 된다. 터치 기기에서 `<키>_touch` 변형이
 * 있으면 그걸 쓰고, 없으면 원래 문구를 그대로 쓴다. 그래서 안내 문구를 갈라야 하는
 * 키에만 `_touch`를 넣어 두면 되고, 나머지 호출부는 손댈 게 없다.
 */
export function useControlHint() {
  const { t, i18n } = useTranslation();
  const kind = usePointerKind();

  return useCallback(
    (key: ParseKeys, options?: Record<string, unknown>): string => {
      // `${key}_touch`가 실제 키인지는 리소스만 안다. 없으면 원래 문구로 떨어진다.
      const touchKey = `${key}_touch` as ParseKeys;
      const useTouch = kind === "touch" && i18n.exists(touchKey);
      return t(useTouch ? touchKey : key, options);
    },
    [t, i18n, kind],
  );
}
