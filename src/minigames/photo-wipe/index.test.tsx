/** @vitest-environment jsdom */

import { cleanup, render } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { i18n } from "@/i18n/config";
import { ASSETS } from "@/lib/assets";
import { PhotoWipeMinigame } from ".";

function photoOf(container: HTMLElement): HTMLImageElement {
  const image = container.querySelector("img");
  if (!image) throw new Error("photo not rendered");
  return image;
}

describe("PhotoWipeMinigame", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  afterEach(cleanup);

  afterAll(async () => {
    await i18n.changeLanguage("ko");
  });

  it("shows the shadowed photo on the first pass", () => {
    const { container } = render(<PhotoWipeMinigame onComplete={() => {}} />);

    expect(photoOf(container).getAttribute("src")).toBe(ASSETS.images.mgPhotoWipePhase1);
  });

  it("shows the revealed photo when the frame is investigated again in phase 2", () => {
    const { container } = render(<PhotoWipeMinigame gamePhase={2} onComplete={() => {}} />);

    expect(photoOf(container).getAttribute("src")).toBe(ASSETS.images.mgPhotoWipePhase2);
  });

  it("sizes the wipe canvas to the photo it covers", () => {
    const { container } = render(<PhotoWipeMinigame gamePhase={2} onComplete={() => {}} />);

    const photo = photoOf(container);
    const canvas = container.querySelector("canvas");
    expect(canvas?.getAttribute("width")).toBe(photo.getAttribute("width"));
    expect(canvas?.getAttribute("height")).toBe(photo.getAttribute("height"));
  });
});
