import { createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ASSETS } from "../../lib/assets";
import { BallCatchField } from "./field";

describe("BallCatchField", () => {
  it("renders the image-led batting interaction with its contextual HUD", () => {
    const html = renderToStaticMarkup(
      <BallCatchField
        ballRef={createRef<HTMLDivElement>()}
        shadowRef={createRef<HTMLDivElement>()}
        nowRef={createRef<HTMLSpanElement>()}
        remainingMisses={2}
        maxMisses={5}
        feedback="hit"
        swingId={1}
        showPrompt
        onSwing={() => {}}
        labels={{
          aria: "Swing the bat",
          hits: "Hits 2 / 3",
          chances: "Chances",
          prompt: "Press Space",
          now: "Now!",
          hit: "Perfect hit",
          early: "Too early",
          late: "Too late",
        }}
      />,
    );

    expect(html.match(/<button/g)).toHaveLength(1);
    expect(html).toContain('<button type="button"');
    expect(html).toContain('aria-label="Swing the bat"');
    expect(html).toContain(`src="${ASSETS.images.mgBallCatchSunsetField}"`);
    expect(html).toContain(`src="${ASSETS.images.mgBallCatchPitcher}"`);
    expect(html).toContain(`src="${ASSETS.images.mgBallCatchBat}"`);
    expect(html).toContain(`src="${ASSETS.images.mgBallCatchImpact}"`);
    expect(html).toContain("Hits");
    expect(html).toContain("2 / 3");
    expect(html).toContain("Chances");
    expect(html).toContain("Press Space");
    expect(html).toContain("Perfect hit");
  });
});
