import { MemoryRoom } from "@/components/ui/MemoryRoom";
import { PreloadResources } from "@/components/ui/PreloadResources";

export default function Home() {
  return (
    <>
      {/* 방 진입 페이지에서만 — /contact는 로딩 오버레이를 쓰지 않는다 */}
      <PreloadResources />
      <MemoryRoom />
    </>
  );
}
