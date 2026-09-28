import { RoomEntry } from "@/components/ui/RoomEntry";
import { localeMetadata } from "@/i18n/site-meta";

export const metadata = localeMetadata("ko");

export default function Home() {
  return <RoomEntry locale={null} />;
}
