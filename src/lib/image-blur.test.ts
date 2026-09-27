// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { IMAGE_BLUR, IMAGE_BLUR_SOURCES } from "@/data/generated/image-blur";
import { BLUR_TARGETS, hashOf } from "../../scripts/build-image-blur.mjs";
import { blurBackdrop, blurDataUrlOf } from "./image-blur";

const IMAGES = path.resolve(__dirname, "../../public/assets/images");

describe("image blur placeholders", () => {
  it("matches the images on disk (run `pnpm images:blur` after adding or replacing one)", () => {
    const onDisk = Object.fromEntries(
      readdirSync(IMAGES)
        .filter((name) => BLUR_TARGETS.some((pattern) => pattern.test(name)))
        .map((name) => [`/assets/images/${name}`, hashOf(readFileSync(path.join(IMAGES, name)))]),
    );
    expect(IMAGE_BLUR_SOURCES).toEqual(onDisk);
  });

  it("looks up by path regardless of the cache-busting query", () => {
    const [key] = Object.keys(IMAGE_BLUR);
    expect(blurDataUrlOf(`${key}?v=9`)).toBe(IMAGE_BLUR[key]);
    expect(blurDataUrlOf("data:image/png;base64,AAAA")).toBeUndefined();
    expect(blurBackdrop("/assets/images/unknown.webp")).toBeUndefined();
  });
});
