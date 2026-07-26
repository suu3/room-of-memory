import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";
import { i18n } from "../../i18n/config";
import { ASSETS } from "../../lib/assets";
import { BallCatchMinigame } from "./index";

describe("BallCatchMinigame", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  it("connects the batting field to the initial round HUD", () => {
    const html = renderToStaticMarkup(<BallCatchMinigame onComplete={() => {}} />);

    expect(html).toContain(`src="${ASSETS.images.mgBallCatchSunsetField}"`);
    expect(html).toContain(`src="${ASSETS.images.mgBallCatchPitcher}"`);
    expect(html).toContain("HITS 0 / 3");
    expect(html).toContain("Chances left");
    expect(html).toContain("5 / 5");
    expect(html).toContain("SPACE / CLICK TO SWING");
  });

  it("renders the localized hit progress only once", () => {
    const html = renderToStaticMarkup(<BallCatchMinigame onComplete={() => {}} />);

    expect(html.match(/0 \/ 3/g)).toHaveLength(1);
  });
});
