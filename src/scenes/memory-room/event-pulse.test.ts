import { beforeEach, describe, expect, it } from "vitest";
import { MEMORIES, PHASE1_MEMORIES } from "@/data/memory-room";
import { useMemoryRoomStore } from "@/store/memory-room";
import { EVENT_PULSE, subscribeEventPulse } from "./event-pulse";

describe("subscribeEventPulse", () => {
  beforeEach(() => {
    useMemoryRoomStore.getState().reset();
  });

  it("기억을 주우면 collect 세기로 울린다", () => {
    const pulses: number[] = [];
    const unsubscribe = subscribeEventPulse((strength) => pulses.push(strength));
    useMemoryRoomStore.setState({ collected: [MEMORIES[0].id] });
    expect(pulses).toEqual([EVENT_PULSE.collect]);
    unsubscribe();
    useMemoryRoomStore.setState({ collected: [MEMORIES[0].id, MEMORIES[1].id] });
    expect(pulses).toHaveLength(1);
  });

  it("라디오가 깨어나는 순간에만 radioWake 세기로 울린다", () => {
    const pulses: number[] = [];
    const unsubscribe = subscribeEventPulse((strength) => pulses.push(strength));
    // 1바퀴를 다 모으면 분기점: 정적 뒤 라디오가 저 혼자 살아난다 (selectRadioSignaling)
    useMemoryRoomStore.setState({ collected: PHASE1_MEMORIES.map((memory) => memory.id) });
    // 곧장이 아니라 정적 끝에 신호가 잡히는 순간이다
    expect(pulses).not.toContain(EVENT_PULSE.radioWake);
    useMemoryRoomStore.getState().catchSignal();
    expect(pulses).toContain(EVENT_PULSE.radioWake);
    const count = pulses.length;
    // 같은 상태가 이어지는 동안에는 다시 울리지 않는다
    useMemoryRoomStore.setState({ lightsOn: false });
    expect(pulses).toHaveLength(count);
    unsubscribe();
  });
});
