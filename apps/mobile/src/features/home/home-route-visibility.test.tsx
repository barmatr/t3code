import { RegistryContext } from "@effect/atom-react";
import { Atom, AtomRegistry } from "effect/reactivity";
import { act, useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vite-plus/test";

const focus = vi.hoisted(() => ({ current: true }));
vi.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ isFocused: () => focus.current }),
  useIsFocused: () => focus.current,
}));

import {
  recordHomeFocus,
  recordHomeTransitionEnd,
  useHomeRouteVisible,
  useAtomValueWhileVisible,
} from "./home-route-visibility";

it("keeps a focused home subscribed after a native closing event from a tab change", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  focus.current = true;
  const registry = AtomRegistry.make();
  const threads = Atom.make<readonly string[]>([]).pipe(Atom.keepAlive);
  const root = createRoot(document.createElement("div"));
  let current: readonly string[] = [];
  function Probe() {
    const value = useAtomValueWhileVisible(threads, useHomeRouteVisible());
    useLayoutEffect(() => {
      current = value;
    });
    return null;
  }
  const render = () =>
    act(async () =>
      root.render(
        <RegistryContext value={registry}>
          <Probe />
        </RegistryContext>,
      ),
    );
  try {
    await render();
    await act(async () => recordHomeFocus());
    await act(async () => recordHomeTransitionEnd(true));
    await act(async () => registry.set(threads, ["created-while-home-focused"]));
    expect(current).toEqual(["created-while-home-focused"]);
    focus.current = false;
    await render();
    await act(async () => registry.set(threads, ["created-while-covered"]));
    expect(current).toEqual(["created-while-home-focused"]);
    focus.current = true;
    await render();
    expect(current).toEqual(["created-while-covered"]);
  } finally {
    await act(async () => root.unmount());
    registry.dispose();
    focus.current = true;
    vi.unstubAllGlobals();
  }
});

it("receives new threads while visible and catches up after a hidden interval", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const registry = AtomRegistry.make();
  const threads = Atom.make<readonly string[]>([]).pipe(Atom.keepAlive);
  const root = createRoot(document.createElement("div"));
  const commits: (readonly string[])[] = [];
  function Probe({ visible }: { visible: boolean }) {
    const value = useAtomValueWhileVisible(threads, visible);
    useLayoutEffect(() => {
      commits.push(value);
    });
    return null;
  }
  const render = (visible: boolean) =>
    act(async () =>
      root.render(
        <RegistryContext value={registry}>
          <Probe visible={visible} />
        </RegistryContext>,
      ),
    );
  try {
    await render(true);
    await act(async () => registry.set(threads, ["first"]));
    expect(commits.at(-1)).toEqual(["first"]);
    await act(async () => registry.set(threads, ["first", "second"]));
    expect(commits.at(-1)).toEqual(["first", "second"]);
    await render(false);
    await act(async () => registry.set(threads, ["first", "second", "third"]));
    expect(commits.at(-1)).toEqual(["first", "second"]);
    await render(true);
    expect(commits.at(-1)).toEqual(["first", "second", "third"]);
  } finally {
    await act(async () => root.unmount());
    registry.dispose();
    vi.unstubAllGlobals();
  }
});
