import { describe, expect, it } from "vitest";
import {
  BRACKET_EDGE,
  BRACKET_MAX,
  BRACKET_MIN,
  BRACKET_PAD,
  BRACKET_PRESS_INSET,
  bracketGoal,
  damp,
} from "./cursor-brackets";

const pointer = { x: 100, y: 200 };
const viewport = { width: 1280, height: 900 };

describe("bracketGoal", () => {
  it("얹힌 물건이 없으면 손 자리의 한 점으로 모인다", () => {
    expect(bracketGoal(pointer, null, false, viewport)).toEqual({
      left: 100,
      top: 200,
      right: 100,
      bottom: 200,
    });
  });

  it("물건을 숨만큼 띄워 감싼다. 손이 물건 안 어디에 있든 같은 자리다", () => {
    const target = { left: 60, top: 150, right: 160, bottom: 230 };
    const wrapped = {
      left: 60 - BRACKET_PAD,
      top: 150 - BRACKET_PAD,
      right: 160 + BRACKET_PAD,
      bottom: 230 + BRACKET_PAD,
    };
    expect(bracketGoal(pointer, target, false, viewport)).toEqual(wrapped);
    expect(bracketGoal({ x: 65, y: 225 }, target, false, viewport)).toEqual(wrapped);
  });

  it("아주 작은 물건은 가장 작은 틀로 가운데를 감싼다", () => {
    const goal = bracketGoal(
      pointer,
      { left: 98, top: 198, right: 102, bottom: 202 },
      false,
      viewport,
    );
    expect(goal.right - goal.left).toBe(BRACKET_MIN);
    expect(goal.bottom - goal.top).toBe(BRACKET_MIN);
    expect((goal.left + goal.right) / 2).toBe(100);
    expect((goal.top + goal.bottom) / 2).toBe(200);
  });

  it("큰 물건은 상한까지만 벌어지고, 틀이 물건 안에서 손을 따라간다", () => {
    const target = { left: 0, top: 0, right: 1000, bottom: 800 };
    const goal = bracketGoal({ x: 500, y: 400 }, target, false, viewport);
    expect(goal.right - goal.left).toBe(BRACKET_MAX);
    expect(goal.bottom - goal.top).toBe(BRACKET_MAX);
    expect((goal.left + goal.right) / 2).toBe(500);
    expect((goal.top + goal.bottom) / 2).toBe(400);

    // 물건 가장자리에서는 틀이 물건 밖으로 숨 이상 나가지 않는다
    const edge = bracketGoal({ x: 998, y: 799 }, target, false, viewport);
    expect(edge.right).toBe(1000 + BRACKET_PAD);
    expect(edge.bottom).toBe(800 + BRACKET_PAD);
  });

  it("화면 끝에 걸친 물건은 꺾쇠가 가장자리 안쪽에 선다", () => {
    const goal = bracketGoal(
      { x: 10, y: 890 },
      { left: 0, top: 700, right: 60, bottom: 900 },
      false,
      viewport,
    );
    expect(goal.left).toBe(BRACKET_EDGE);
    expect(goal.bottom).toBe(900 - BRACKET_EDGE);
    expect(goal.right).toBe(60 + BRACKET_PAD);
  });

  it("누르는 동안 사방에서 조여든다", () => {
    const target = { left: 60, top: 150, right: 160, bottom: 230 };
    const rest = bracketGoal(pointer, target, false, viewport);
    const pressed = bracketGoal(pointer, target, true, viewport);
    expect(pressed.left - rest.left).toBe(BRACKET_PRESS_INSET);
    expect(rest.right - pressed.right).toBe(BRACKET_PRESS_INSET);
    expect(pressed.top - rest.top).toBe(BRACKET_PRESS_INSET);
    expect(rest.bottom - pressed.bottom).toBe(BRACKET_PRESS_INSET);
  });
});

describe("damp", () => {
  it("목표 쪽으로 다가가고 dt가 0이면 그대로다", () => {
    expect(damp(0, 10, 10, 0)).toBe(0);
    const step = damp(0, 10, 10, 0.1);
    expect(step).toBeGreaterThan(5);
    expect(step).toBeLessThan(10);
    expect(damp(10, 10, 10, 1)).toBe(10);
  });
});
