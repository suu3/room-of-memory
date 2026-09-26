import { BatteryHigh, CaretLeft, CellSignalFull, type Icon, WifiHigh } from "@phosphor-icons/react";
import type { ReactNode } from "react";

/** 하단 탭바의 한 칸. 탭이 없는 화면(엄마 대화방 하나만 여는 폰 2차)은 탭바를 안 그린다. */
export interface PhoneTabItem<Id extends string> {
  id: Id;
  label: string;
  Icon: Icon;
  /** 빨간 배지 숫자. 0이면 안 띄운다. */
  badge?: number;
}

/**
 * 실제 스마트폰 목업 껍데기.
 *
 * 기기 테두리 → 노치 → 상태바 → 앱 헤더 → 본문 → 하단 탭바 → 홈 인디케이터 순으로
 * 쌓는다. 알맹이(대화/통화 기록)는 children으로 받아 이 파일은 "기기"만 책임진다.
 *
 * 화면 비율은 실제 폰에 가깝게 9:19.5 근처로 잡았다. 폭은 실제로 손에 쥔 폰만 하게
 * 잡되(22rem ≈ 352px), 좁은 화면에서는 뷰포트를 넘지 않도록 줄인다.
 *
 * 본문 높이는 이 파일이 정한다. 대화 탭과 통화 탭이 각자 높이를 들고 있으면
 * 탭을 옮길 때 기기가 늘었다 줄었다 한다. 자식은 h-full로 이 칸을 채운다.
 * dvh를 섞는 이유: 모바일 세로 화면에서 폰 목업이 화면보다 길어지면
 * 하단 탭바와 닫기 버튼이 잘린다.
 */
export const PHONE_BODY_CLASS = "h-[min(24rem,48dvh)]";

export function PhoneShell<Id extends string>({
  tab,
  onTab,
  tabs,
  title,
  subtitle,
  clock,
  onBack,
  backLabel,
  children,
}: {
  tab?: Id;
  onTab?: (tab: Id) => void;
  /** 하단 탭바. 비우면 탭바 없이 본문만 선다. */
  tabs?: readonly PhoneTabItem<Id>[];
  title: string;
  subtitle: string;
  clock: string;
  /** 있으면 헤더의 왼쪽 화살표가 눌리는 뒤로 가기 버튼이 된다 (대화방 → 목록). */
  onBack?: () => void;
  backLabel?: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-[22rem] max-w-[92vw]">
      {/* 기기 테두리: 얇은 베젤과 둥근 모서리가 "물건"이라는 인상을 만든다 */}
      <div className="rounded-[2.5rem] bg-ink p-[3px] shadow-panel ring-1 ring-night/80">
        <div className="relative overflow-hidden rounded-[2.3rem] bg-scene-void">
          {/* 노치 */}
          <div className="absolute left-1/2 top-0 z-10 h-[1.2rem] w-[6.5rem] -translate-x-1/2 rounded-b-xl bg-ink" />

          {/* 상태바 */}
          <div className="flex items-center justify-between px-5 pb-1 pt-2 text-bone/85">
            <span className="w-16 text-[0.75rem] font-bold tabular-nums">{clock}</span>
            <span className="w-[6.5rem]" aria-hidden />
            <span className="flex w-16 items-center justify-end gap-1" aria-hidden>
              <CellSignalFull size={13} weight="fill" />
              <WifiHigh size={13} weight="fill" />
              <BatteryHigh size={15} weight="fill" />
            </span>
          </div>

          {/* 앱 헤더 */}
          <div className="flex items-center gap-2.5 border-b border-bone/10 px-3.5 pb-3 pt-1.5">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                aria-label={backLabel}
                className="-m-1 shrink-0 cursor-pointer rounded-full p-1 text-bone/70 transition-colors hover:text-paper"
              >
                <CaretLeft size={18} weight="bold" />
              </button>
            ) : (
              <CaretLeft size={18} weight="bold" className="shrink-0 text-bone/45" aria-hidden />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.9375rem] font-bold text-paper">{title}</p>
              <p className="truncate text-[0.75rem] text-bone/45">{subtitle}</p>
            </div>
          </div>

          <div className={PHONE_BODY_CLASS}>{children}</div>

          {/* 하단 탭바: 앱을 오가는 자리 */}
          {tabs && tabs.length > 0 ? (
            <div className="flex border-t border-bone/10 bg-scene-coal">
              {tabs.map(({ id, label, Icon: TabIcon, badge = 0 }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => onTab?.(id)}
                  aria-pressed={tab === id}
                  className={`relative flex flex-1 cursor-pointer flex-col items-center gap-0.5 py-2.5 transition-colors ${
                    tab === id ? "text-memory" : "text-bone/40 hover:text-bone/70"
                  }`}
                >
                  <TabIcon size={20} weight={tab === id ? "fill" : "regular"} />
                  <span className="text-[0.6875rem] font-bold tracking-wider">{label}</span>
                  {badge > 0 ? (
                    <span className="absolute right-[18%] top-1.5 min-w-[1.15rem] rounded-full bg-ember px-1 text-[0.6875rem] font-bold leading-[1.15rem] text-paper">
                      {badge}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}

          {/* 홈 인디케이터 */}
          <div className="flex justify-center bg-scene-coal pb-1.5 pt-0.5">
            <span aria-hidden className="h-1 w-24 rounded-full bg-bone/30" />
          </div>
        </div>
      </div>
    </div>
  );
}
