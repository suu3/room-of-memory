import { type RefObject, useEffect } from "react";
import { useMemoryRoomStore } from "@/store/memory-room";

/** 제 키를 스스로 받는 컨트롤. 여기에 포커스가 있으면 그쪽이 Enter·Space의 주인이다. */
const CONTROL_SELECTOR = "button, a[href], input, textarea, select, [role=button]";

/**
 * 결과 카드의 으뜸 버튼(계속·다시 해보기)을 Enter와 Space로 누른다.
 *
 * 버튼에 포커스를 주는 것만으로는 Space가 안 먹었다. 카드 아래에는 끝난 판이 그대로
 * 살아 있고, Space를 조작 키로 쓰는 판들은 창 전역에서 그 키의 기본 동작을 막는다.
 * 버튼의 Space 클릭이 그 기본 동작이라 Enter만 듣고 Space는 삼켜졌다. 대사창과 같이
 * 캡처 단계에서 먼저 받아 버튼을 누르고, 아래 판까지 흘려보내지 않는다.
 *
 * 다른 컨트롤에 포커스가 가 있으면 비켜 준다 (실패 카드의 "나중에 하기").
 */
export function usePrimaryKey(button: RefObject<HTMLButtonElement | null>, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent) => {
      if ((event.key !== "Enter" && event.code !== "Space") || event.repeat) return;
      const primary = button.current;
      if (!primary) return;
      // 위에 뜬 모달(수첩·메뉴)이 화면의 주인이면 카드는 건드리지 않는다
      if (useMemoryRoomStore.getState().uiLocks.length > 0) return;
      const target = event.target;
      const elsewhere =
        target !== primary && target instanceof Element && target.closest(CONTROL_SELECTOR);
      if (elsewhere) return;
      event.preventDefault();
      event.stopPropagation();
      primary.click();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [button, enabled]);
}
