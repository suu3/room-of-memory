import type { Metadata } from "next";
import { ArView } from "./ArView";

export const metadata: Metadata = {
  title: "포토카드 AR",
  // 테스트용 시제품이다. 검색에 걸리지 않게 둔다.
  robots: { index: false, follow: false },
};

export default function ArPage() {
  return <ArView />;
}
