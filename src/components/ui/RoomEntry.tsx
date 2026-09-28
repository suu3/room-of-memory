import type { Locale } from "@/i18n/config";
import { LocaleRoute } from "./LocaleRoute";
import { MemoryRoom } from "./MemoryRoom";
import { PreloadResources } from "./PreloadResources";

/**
 * 방 진입 페이지의 몸통. 루트(/)와 언어 주소(/en · /ja)가 같이 쓴다.
 *
 * @param locale 이 주소가 여는 언어. 루트는 null: 저장된 선택을 따른다.
 */
export function RoomEntry({ locale }: { locale: Locale | null }) {
  return (
    <>
      <LocaleRoute locale={locale} />
      {/* 방 진입 페이지에서만: /contact는 로딩 오버레이를 쓰지 않는다 */}
      <PreloadResources />
      <MemoryRoom />
    </>
  );
}
