import { existsSync, readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ASSETS } from "./assets";

const WEBP_ASSETS = {
  "cutscene-day-1.webp": [1456, 816],
  "cutscene-day-2.webp": [1456, 816],
  "cutscene-day-3.webp": [1456, 816],
  "cutscene-day-4.webp": [1456, 816],
  "cutscene-day-5.webp": [1456, 816],
  "cutscene-day-6.webp": [1456, 816],
  "cutscene-day-7.webp": [1456, 816],
  "cutscene-day-8.webp": [1456, 816],
  "cutscene-survivor-1.webp": [1456, 816],
  "cutscene-survivor-2.webp": [928, 1232],
  "cutscene-survivor-3.webp": [928, 1232],
  "cutscene-survivor-4.webp": [1456, 816],
  "cutscene-survivor-5.webp": [928, 1232],
  "cutscene-survivor-6.webp": [928, 1232],
  "cutscene-survivor-7.webp": [1456, 816],
  "cutscene-survivor-8.webp": [1456, 816],
  "cutscene-survivor-9.webp": [928, 1232],
  "cutscene-survivor-10.webp": [928, 1232],
  "mg-id-card-front.webp": [1024, 640],
  "mg-id-card-back.webp": [1024, 640],
  "mg-ampoule-label.webp": [1024, 256],
  "mg-papers-paper.webp": [768, 1024],
} as const;

function webpDimensions(bytes: Buffer): readonly [number, number] {
  expect(bytes.toString("ascii", 0, 4)).toBe("RIFF");
  expect(bytes.toString("ascii", 8, 12)).toBe("WEBP");

  const chunk = bytes.toString("ascii", 12, 16);
  if (chunk === "VP8X") {
    return [bytes.readUIntLE(24, 3) + 1, bytes.readUIntLE(27, 3) + 1];
  }
  if (chunk === "VP8 ") {
    return [bytes.readUInt16LE(26) & 0x3fff, bytes.readUInt16LE(28) & 0x3fff];
  }
  if (chunk === "VP8L") {
    const packed = bytes.readUInt32LE(21);
    return [(packed & 0x3fff) + 1, ((packed >> 14) & 0x3fff) + 1];
  }
  throw new Error(`Unsupported WebP chunk: ${chunk}`);
}

describe("story image assets", () => {
  it.each(Object.entries(WEBP_ASSETS))("ships %s at its gameplay dimensions", (name, size) => {
    const path = `public/assets/images/${name}`;
    expect(existsSync(path), `${name} is missing`).toBe(true);

    const bytes = readFileSync(path);
    expect(webpDimensions(bytes)).toEqual(size);
    expect(statSync(path).size, `${name} exceeds the 1 MB image budget`).toBeLessThanOrEqual(
      1024 * 1024,
    );
  });

  it("ships the reusable Laon logo as an SVG", () => {
    const path = "public/assets/images/ui-laon-logo.svg";
    expect(existsSync(path)).toBe(true);
    const logo = readFileSync(path, "utf8");
    expect(logo).toContain("<svg");
    expect(logo).toContain('d="M68 151H188" stroke-width="12"');
    expect(logo).toContain('d="M91 151a37 37 0 0 1 74 0" stroke-width="12"');
  });

  it("registers every new image in the shared asset map", () => {
    const paths = Object.values(ASSETS.images);
    for (const name of [...Object.keys(WEBP_ASSETS), "ui-laon-logo.svg"]) {
      expect(
        paths.some(
          (path) => typeof path === "string" && path.split("?")[0] === `/assets/images/${name}`,
        ),
      ).toBe(true);
    }
    expect(ASSETS.images.laonLogo).toBe("/assets/images/ui-laon-logo.svg?v=2");
  });
});
