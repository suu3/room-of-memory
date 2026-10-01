"use client";

import { LoadError } from "@/components/ui/boot/LoadError";

/** 레이아웃 안쪽에서 난 오류. 서체·i18n은 루트 레이아웃이 이미 세워 두었다. */
export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return <LoadError error={error} retry={unstable_retry} />;
}
