import { describe, expect, it, vi } from "vite-plus/test";
import { createProjectSwitcherShortcuts } from "./ProjectSwitcherShortcuts.ts";

function setup(failKey?: string) {
  const callbacks = new Map<string, () => void>();
  const notify = vi.fn();
  const focusContents = vi.fn();
  const unregister = vi.fn((key: string) => {
    callbacks.delete(key);
  });
  const controller = createProjectSwitcherShortcuts({
    register: (key, callback) => {
      if (key === failKey) return false;
      callbacks.set(key, callback);
      return true;
    },
    unregister,
    notify,
    focusContents,
  });
  return { controller, callbacks, notify, unregister, focusContents };
}

describe("T4 option-tab ownership", () => {
  it("owns Option+Tab only while a ready client has focus", () => {
    const h = setup();
    h.controller.setFocused(true);
    expect(h.callbacks.size).toBe(0);
    h.controller.setEnabled(true);
    expect([...h.callbacks.keys()]).toEqual(["Alt+Tab", "Alt+Shift+Tab"]);
    h.callbacks.get("Alt+Tab")!();
    expect(h.focusContents).toHaveBeenCalledOnce();
    expect(h.notify).toHaveBeenLastCalledWith("t4.project-switcher.next");
    h.controller.setFocused(false);
    expect(h.callbacks.size).toBe(0);
    expect(h.notify).toHaveBeenLastCalledWith("t4.project-switcher.cancel");
    h.controller.setFocused(true);
    expect(h.callbacks.size).toBe(2);
    h.controller.dispose();
    expect(h.callbacks.size).toBe(0);
  });
  it("commits a quick option release once, but Escape cancels without committing", () => {
    const h = setup();
    const event = { preventDefault: vi.fn() };
    h.controller.setEnabled(true);
    h.controller.setFocused(true);
    h.callbacks.get("Alt+Shift+Tab")!();
    h.controller.onInput(event, { type: "keyUp", key: "Tab", alt: true });
    expect(h.notify).toHaveBeenCalledTimes(1);
    h.controller.onInput(event, { type: "keyUp", key: "Alt", alt: false });
    h.controller.onInput(event, { type: "keyUp", key: "Tab", alt: false });
    expect(h.notify.mock.calls.map(([action]) => action)).toEqual([
      "t4.project-switcher.previous",
      "t4.project-switcher.commit",
    ]);
    h.notify.mockClear();
    h.callbacks.get("Alt+Tab")!();
    h.controller.onInput(event, { type: "keyDown", key: "Escape", alt: true });
    h.controller.onInput(event, { type: "keyUp", key: "Alt", alt: false });
    expect(h.notify.mock.calls.map(([action]) => action)).toEqual([
      "t4.project-switcher.next",
      "t4.project-switcher.cancel",
    ]);
    expect(event.preventDefault).toHaveBeenCalledOnce();
  });
  it("releases a partial registration without unregistering somebody else's shortcut", () => {
    const h = setup("Alt+Shift+Tab");
    h.controller.setEnabled(true);
    h.controller.setFocused(true);
    expect(h.callbacks.size).toBe(0);
    expect(h.unregister.mock.calls).toEqual([["Alt+Tab"]]);
    expect(h.notify).toHaveBeenLastCalledWith("t4.project-switcher.unavailable");
  });
  it("stops intercepting when the renderer reloads or the user disables the feature", () => {
    const h = setup();
    h.controller.setEnabled(true);
    h.controller.setFocused(true);
    h.callbacks.get("Alt+Tab")!();
    h.controller.setEnabled(false);
    expect(h.callbacks.size).toBe(0);
    expect(h.notify).toHaveBeenLastCalledWith("t4.project-switcher.cancel");
  });
});
