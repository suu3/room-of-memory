/** @vitest-environment jsdom */

import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { lazy } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryGlowVisualBoundary } from "./MemoryOutlineGlow";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, reject, resolve };
}

afterEach(cleanup);

describe("memory glow visual boundary", () => {
  it("refreshes the selected visual when suspended content becomes the model", async () => {
    const module = deferred<{ default: () => React.ReactNode }>();
    const LazyModel = lazy(() => module.promise);
    const visibleContent: string[] = [];

    render(
      <MemoryGlowVisualBoundary
        fallback={<span>fallback</span>}
        onVisible={(kind) => visibleContent.push(kind)}
      >
        <LazyModel />
      </MemoryGlowVisualBoundary>,
    );

    expect(screen.getByText("fallback")).toBeTruthy();
    expect(visibleContent).toEqual(["suspense-fallback"]);

    await act(async () => {
      module.resolve({ default: () => <span>model</span> });
      await module.promise;
    });

    await waitFor(() => expect(screen.getByText("model")).toBeTruthy());
    expect(visibleContent).toEqual(["suspense-fallback", "model"]);
  });

  it("refreshes the selected visual when a suspended model becomes the error fallback", async () => {
    const module = deferred<{ default: () => React.ReactNode }>();
    const LazyModel = lazy(() => module.promise);
    const visibleContent: string[] = [];

    render(
      <MemoryGlowVisualBoundary
        fallback={<span>error fallback</span>}
        onVisible={(kind) => visibleContent.push(kind)}
      >
        <LazyModel />
      </MemoryGlowVisualBoundary>,
      { onCaughtError: () => {} },
    );

    expect(screen.getByText("error fallback")).toBeTruthy();
    expect(visibleContent).toEqual(["suspense-fallback"]);

    await act(async () => {
      module.reject(new Error("model failed"));
      await module.promise.catch(() => undefined);
    });

    await waitFor(() => expect(screen.getByText("error fallback")).toBeTruthy());
    expect(visibleContent).toEqual(["suspense-fallback", "error-fallback"]);
  });
});
