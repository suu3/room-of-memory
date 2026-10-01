import { RoomEntry } from "@/components/ui/shell/RoomEntry";
import { localeMetadata } from "@/i18n/site-meta";

/** 처음부터 일본어로 여는 주소 (i18n/locale-routes.ts). */
export const metadata = localeMetadata("ja");

export default function JaHome() {
  return <RoomEntry locale="ja" />;
}
