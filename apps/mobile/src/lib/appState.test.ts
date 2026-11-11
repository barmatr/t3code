import { describe, expect, it, vi } from "vite-plus/test";

const native = vi.hoisted(() => ({
  enabled: false,
  listeners: new Set<(enabled: boolean) => void>(),
  state: "active",
  stateListeners: new Set<(state: string) => void>(),
}));

vi.mock("react-native", () => ({
  AppState: {
    get currentState() {
      return native.state;
    },
    addEventListener: (_event: string, listener: (state: string) => void) => {
      native.stateListeners.add(listener);
      return { remove: () => native.stateListeners.delete(listener) };
    },
  },
  AccessibilityInfo: {
    addEventListener: (_event: string, listener: (enabled: boolean) => void) => {
      native.listeners.add(listener);
      return { remove: () => native.listeners.delete(listener) };
    },
    isReduceMotionEnabled: () => Promise.resolve(native.enabled),
  },
}));

import {
  readReduceMotionEnabled,
  subscribeAppForegroundReturn,
  subscribeReduceMotion,
} from "./appState";

function changeState(state: string) {
  native.state = state;
  for (const listener of native.stateListeners) listener(state);
}

describe("foreground returns", () => {
  it("fires once per real return, including the intermediate iOS inactive state", () => {
    native.state = "active";
    const onReturn = vi.fn();
    const unsubscribe = subscribeAppForegroundReturn(onReturn);
    try {
      changeState("active");
      changeState("inactive");
      changeState("active");
      expect(onReturn).not.toHaveBeenCalled();

      changeState("background");
      changeState("inactive");
      changeState("active");
      changeState("active");
      expect(onReturn).toHaveBeenCalledTimes(1);

      changeState("background");
      changeState("active");
      expect(onReturn).toHaveBeenCalledTimes(2);
    } finally {
      unsubscribe();
    }
    changeState("background");
    changeState("active");
    expect(onReturn).toHaveBeenCalledTimes(2);
  });

  it("observes a return when mounted while already backgrounded", () => {
    native.state = "background";
    const onReturn = vi.fn();
    const unsubscribe = subscribeAppForegroundReturn(onReturn);
    try {
      changeState("inactive");
      expect(onReturn).not.toHaveBeenCalled();
      changeState("active");
      expect(onReturn).toHaveBeenCalledTimes(1);
    } finally {
      unsubscribe();
    }
  });
});

describe("reduce motion store", () => {
  it("reseeds from native after observation stops and restarts", async () => {
    native.enabled = false;
    const unsubscribe = subscribeReduceMotion(() => undefined);
    await Promise.resolve();
    expect(readReduceMotionEnabled()).toBe(false);
    unsubscribe();

    // Changed while nobody listened: no event reaches the store.
    native.enabled = true;
    const unsubscribeAgain = subscribeReduceMotion(() => undefined);
    // Unknown until the reseed lands, which reads as reduced, not the stale false.
    expect(readReduceMotionEnabled()).toBe(true);
    await Promise.resolve();
    expect(readReduceMotionEnabled()).toBe(true);
    unsubscribeAgain();
  });

  it("ignores a seed that resolves after the last unsubscribe", async () => {
    native.enabled = false;
    subscribeReduceMotion(() => undefined)();
    await Promise.resolve();
    expect(readReduceMotionEnabled()).toBe(true);
  });
});
