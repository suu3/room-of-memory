import {
  BatteryHigh,
  CaretLeft,
  CellSignalFull,
  ChatCircleDots,
  PhoneDisconnect,
  WifiHigh,
} from "@phosphor-icons/react";
import type { ReactNode } from "react";
import type { PhoneTab } from "./thread";

/**
 * 실제 스마트폰 목업 껍데기.
 *
 * 기기 테두리 → 노치 → 상태바 → 앱 헤더 → 본문 → 하단 탭바 → 홈 인디케이터 순으로
 * 쌓는다. 알맹이(대화/통화 기록)는 children으로 받아 이 파일은 "기기"만 책임진다.
 *
 * 화면 비율은 실제 폰에 가깝게 9:19.5 근처로 잡았다. 미니게임 패널 안에 들어가야
 * 하므로 폭을 17.5rem으로 묶고, 본문 높이는 그에 맞춰 고정한다.
 */
export function PhoneShell({
  tab,
  onTab,
  title,
  subtitle,
  clock,
  badge,
  tabLabels,
  children,
}: {
  tab: PhoneTab;
  onTab: (tab: PhoneTab) => void;
  title: string;
  subtitle: string;
  clock: string;
  /** 통화 탭에 띄울 부재중 개수. 0이면 안 띄운다. */
  badge: number;
  tabLabels: Record<PhoneTab, string>;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-[17.5rem] max-w-full">
      {/* 기기 테두리 — 얇은 베젤과 둥근 모서리가 "물건"이라는 인상을 만든다 */}
      <div className="rounded-[2.25rem] bg-ink p-[3px] shadow-panel ring-1 ring-night/80">
        <div className="relative overflow-hidden rounded-[2.05rem] bg-scene-void">
          {/* 노치 */}
          <div className="absolute left-1/2 top-0 z-10 h-[1.05rem] w-[5.5rem] -translate-x-1/2 rounded-b-xl bg-ink" />

          {/* 상태바 */}
          <div className="flex items-center justify-between px-4 pb-1 pt-1.5 text-bone/85">
            <span className="w-14 text-[0.625rem] font-bold tabular-nums">{clock}</span>
            <span className="w-[5.5rem]" aria-hidden />
            <span className="flex w-14 items-center justify-end gap-0.5" aria-hidden>
              <CellSignalFull size={11} weight="fill" />
              <WifiHigh size={11} weight="fill" />
              <BatteryHigh size={13} weight="fill" />
            </span>
          </div>

          {/* 앱 헤더 */}
          <div className="flex items-center gap-2 border-b border-bone/10 px-3 pb-2.5 pt-1">
            <CaretLeft size={15} weight="bold" className="shrink-0 text-bone/45" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.8125rem] font-bold text-paper">{title}</p>
              <p className="truncate text-[0.625rem] text-bone/45">{subtitle}</p>
            </div>
          </div>

          {children}

          {/* 하단 탭바 — 앱을 오가는 자리 */}
          <div className="flex border-t border-bone/10 bg-scene-coal">
            {(
              [
                { id: "chat" as const, Icon: ChatCircleDots },
                { id: "calls" as const, Icon: PhoneDisconnect },
              ] satisfies { id: PhoneTab; Icon: typeof ChatCircleDots }[]
            ).map(({ id, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => onTab(id)}
                aria-pressed={tab === id}
                className={`relative flex flex-1 cursor-pointer flex-col items-center gap-0.5 py-2 transition-colors ${
                  tab === id ? "text-memory" : "text-bone/40 hover:text-bone/70"
                }`}
              >
                <Icon size={17} weight={tab === id ? "fill" : "regular"} />
                <span className="text-[0.5625rem] font-bold tracking-wider">{tabLabels[id]}</span>
                {id === "calls" && badge > 0 ? (
                  <span className="absolute right-[24%] top-1 min-w-[1rem] rounded-full bg-ember px-1 text-[0.5625rem] font-bold leading-4 text-paper">
                    {badge}
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          {/* 홈 인디케이터 */}
          <div className="flex justify-center bg-scene-coal pb-1.5 pt-0.5">
            <span aria-hidden className="h-1 w-24 rounded-full bg-bone/30" />
          </div>
        </div>
      </div>
    </div>
  );
}
