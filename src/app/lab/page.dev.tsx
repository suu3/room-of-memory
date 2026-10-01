import Link from "next/link";
import { LAB_ENTRIES } from "./lab-index";

export default function LabIndexPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-6 bg-night p-6 text-ivory">
      <header className="space-y-2">
        <p className="text-sm text-memory">기억의 방 · 시각 실험실</p>
        <h1 className="text-2xl font-semibold">실험 목록</h1>
        <p className="text-sm text-fog">
          docs/direction/visual-experiments.md의 효과들을 하나씩 돌려 본다. 개발 서버에서만 열린다.
        </p>
      </header>
      <ul className="flex flex-col divide-y divide-line">
        {LAB_ENTRIES.map((entry) => (
          <li key={entry.slug} className="py-3">
            <Link href={`/lab/${entry.slug}`} className="text-base text-ivory hover:text-memory">
              {entry.title}
            </Link>
            <p className="text-sm text-fog">{entry.note}</p>
          </li>
        ))}
        {LAB_ENTRIES.length === 0 && <li className="py-3 text-sm text-fog">아직 없다.</li>}
      </ul>
    </main>
  );
}
