import { act, useEffect, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vite-plus/test";

const native = vi.hoisted(() => ({
  focused: true,
  state: "active",
  reduced: false,
  changes: new Set<(state: string) => void>(),
  motion: new Set<(enabled: boolean) => void>(),
  complete: () => {},
  mounts: 0,
  html: "",
  source: null as { html: string } | null,
}));
vi.mock("@react-navigation/native", () => ({ useIsFocused: () => native.focused }));
vi.mock("react-native", () => ({
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  AppState: {
    get currentState() {
      return native.state;
    },
    addEventListener: (_event: string, callback: (state: string) => void) => {
      native.changes.add(callback);
      return { remove: () => native.changes.delete(callback) };
    },
  },
  AccessibilityInfo: {
    isReduceMotionEnabled: () => Promise.resolve(native.reduced),
    addEventListener: (_event: string, callback: (enabled: boolean) => void) => {
      native.motion.add(callback);
      return { remove: () => native.motion.delete(callback) };
    },
  },
}));
vi.mock("react-native-webview", () => ({
  WebView: ({ onMessage, source }: { onMessage: () => void; source: { html: string } }) => {
    useEffect(() => {
      native.mounts += 1;
    }, []);
    native.html = source.html;
    native.source = source;
    native.complete = onMessage;
    return <div data-fire />;
  },
}));

import { BrandForegroundFire } from "./BrandForegroundFire";

async function mount(reduced = false, continuous = false) {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  native.focused = true;
  native.state = "active";
  native.reduced = reduced;
  native.mounts = 0;
  let hot = continuous;
  const container = document.createElement("div");
  const root = createRoot(container);
  const render = () =>
    root.render(<BrandForegroundFire width={150} height={26} continuous={hot} />);
  await act(render);
  return {
    hot: (value: boolean) =>
      act(() => {
        hot = value;
        render();
      }),
    burning: () => container.querySelector("[data-fire]") !== null,
    state: (state: string) =>
      act(() => {
        native.state = state;
        for (const callback of native.changes) callback(state);
      }),
    focus: (focused: boolean) =>
      act(() => {
        native.focused = focused;
        render();
      }),
    async [Symbol.asyncDispose]() {
      await act(() => root.unmount());
    },
  };
}

it("burns only on a real foreground return and removes the WebView on completion", async () => {
  await using fire = await mount();
  expect(fire.burning()).toBe(false);
  await fire.state("inactive");
  await fire.state("active");
  expect(fire.burning()).toBe(false);
  await fire.state("background");
  await fire.state("inactive");
  await fire.state("active");
  expect(fire.burning()).toBe(true);
  await act(native.complete);
  expect(fire.burning()).toBe(false);
});

it("cancels on navigation and never replays the old fire when the header returns", async () => {
  await using fire = await mount();
  await fire.state("background");
  await fire.state("active");
  expect(fire.burning()).toBe(true);
  await fire.focus(false);
  expect(fire.burning()).toBe(false);
  await fire.focus(true);
  expect(fire.burning()).toBe(false);
});

it("stays idle for Reduce Motion and cancels if the preference changes during a burst", async () => {
  await using fire = await mount(true);
  await fire.state("background");
  await fire.state("active");
  expect(fire.burning()).toBe(false);
  await act(() => {
    for (const callback of native.motion) callback(false);
  });
  await fire.state("background");
  await fire.state("active");
  expect(fire.burning()).toBe(true);
  await act(() => {
    for (const callback of native.motion) callback(true);
  });
  expect(fire.burning()).toBe(false);
});

it("cancels in the background and ignores returns on a hidden header", async () => {
  await using fire = await mount();
  await fire.state("background");
  await fire.state("active");
  expect(fire.burning()).toBe(true);
  await fire.state("background");
  expect(fire.burning()).toBe(false);
  await fire.focus(false);
  await fire.state("active");
  await fire.focus(true);
  expect(fire.burning()).toBe(false);
});

it("removes an unresponsive WebView when its startup or completion never arrives", async () => {
  await using fire = await mount();
  vi.useFakeTimers();
  try {
    await fire.state("background");
    await fire.state("active");
    expect(fire.burning()).toBe(true);
    await act(() => vi.advanceTimersByTime(3_000));
    expect(fire.burning()).toBe(false);
  } finally {
    vi.useRealTimers();
  }
});

it("keeps one continuous WebView until disarmed, blurred, backgrounded or reduced", async () => {
  await using fire = await mount(false, true);
  vi.useFakeTimers();
  using _timers = { [Symbol.dispose]: () => vi.useRealTimers() };
  expect(fire.burning()).toBe(true);
  expect(native.html).toContain("const CONTINUOUS = true");
  const initialHtml = native.html;
  const initialSource = native.source;
  await act(() => vi.advanceTimersByTime(12_000));
  await fire.hot(true);
  await fire.focus(true);
  expect(fire.burning()).toBe(true);
  expect(native.mounts).toBe(1);
  expect(native.html).toBe(initialHtml);
  expect(native.source).toBe(initialSource);
  await fire.state("background");
  expect(fire.burning()).toBe(false);
  await fire.state("active");
  expect(fire.burning()).toBe(true);
  await fire.focus(false);
  expect(fire.burning()).toBe(false);
  await fire.focus(true);
  expect(fire.burning()).toBe(true);
  await act(() => {
    for (const callback of native.motion) callback(true);
  });
  expect(fire.burning()).toBe(false);
  await act(() => {
    for (const callback of native.motion) callback(false);
  });
  expect(fire.burning()).toBe(true);
  await fire.hot(false);
  expect(fire.burning()).toBe(false);
  await fire.state("background");
  await fire.state("active");
  expect(fire.burning()).toBe(true);
  expect(native.html).toContain("const CONTINUOUS = false");
  await act(native.complete);
  expect(fire.burning()).toBe(false);
});

it("does not remount a continuous fire that reports completion or crashes", async () => {
  await using fire = await mount(false, true);
  expect(native.mounts).toBe(1);
  await act(native.complete);
  await fire.hot(true);
  expect(fire.burning()).toBe(false);
  expect(native.mounts).toBe(1);
  await fire.hot(false);
  await fire.hot(true);
  expect(fire.burning()).toBe(true);
  expect(native.mounts).toBe(2);
});

it("starts hot without a WebView when Reduce Motion is enabled", async () => {
  await using fire = await mount(true, true);
  expect(fire.burning()).toBe(false);
  expect(native.mounts).toBe(0);
});
