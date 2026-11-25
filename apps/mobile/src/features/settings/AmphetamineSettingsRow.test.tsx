import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vite-plus/test";

const native = vi.hoisted(() => ({
  route: "Home",
  appState: "active",
  listeners: new Set<(state: string) => void>(),
}));

vi.mock("@react-navigation/native", () => ({
  useIsFocused: () => false,
  useNavigationState: (select: (state: { routes: { name: string }[]; index: number }) => unknown) =>
    select({ routes: [{ name: native.route }], index: 0 }),
}));
vi.mock("expo-constants", () => ({
  default: {
    expoConfig: {
      extra: {
        amphetamineStatusOrigin: "https://mac.test.ts.net:18443",
        amphetamineEnvironmentId: "mac",
      },
    },
  },
}));
vi.mock("react-native", () => ({
  AppState: {
    get currentState() {
      return native.appState;
    },
    addEventListener: (_event: string, callback: (state: string) => void) => {
      native.listeners.add(callback);
      return { remove: () => native.listeners.delete(callback) };
    },
  },
}));
vi.mock("../../components/ui/ListRowLayout", () => ({
  ListRowLayout: ({ description }: { description: string }) => <div>{description}</div>,
}));

it("reads on the iOS Settings route and stops when backgrounded or covered", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(10_000);
  const fetchStatus = vi.fn(async () =>
    Response.json({ version: 1, environmentId: "mac", status: "timed", remainingSeconds: 120 }),
  );
  vi.stubGlobal("fetch", fetchStatus);
  const { AmphetamineSettingsRow } = await import("./AmphetamineSettingsRow");
  const container = document.createElement("div");
  const root = createRoot(container);
  const render = () => root.render(<AmphetamineSettingsRow label="Amphetamine · Mac" />);
  const setAppState = (state: string) => {
    native.appState = state;
    for (const callback of native.listeners) callback(state);
  };

  try {
    await act(render);
    expect(fetchStatus).not.toHaveBeenCalled();

    native.route = "Settings";
    await act(render);
    expect(fetchStatus).toHaveBeenCalledTimes(1);
    expect(container.textContent).toBe("2 min remaining");

    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(container.textContent).toBe("1 min remaining");
    expect(fetchStatus).toHaveBeenCalledTimes(1);

    await act(() => setAppState("background"));
    await act(() => vi.advanceTimersByTimeAsync(600_000));
    expect(fetchStatus).toHaveBeenCalledTimes(1);
    await act(() => setAppState("active"));
    expect(fetchStatus).toHaveBeenCalledTimes(2);

    native.route = "SettingsAppearance";
    await act(render);
    await act(() => vi.advanceTimersByTimeAsync(600_000));
    expect(fetchStatus).toHaveBeenCalledTimes(2);
  } finally {
    await act(() => root.unmount());
    vi.unstubAllGlobals();
    vi.useRealTimers();
  }
});
