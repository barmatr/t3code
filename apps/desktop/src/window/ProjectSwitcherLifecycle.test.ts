import { expect, it, vi } from "vite-plus/test";
import * as Electron from "electron";
import { MENU_ACTION_CHANNEL, PROJECT_SWITCHER_ENABLED_CHANNEL } from "../ipc/channels.ts";
import { installProjectSwitcherShortcuts } from "./ProjectSwitcherShortcuts.ts";

vi.mock("electron", async () => {
  const { EventEmitter } = await import("node:events");
  return {
    ipcMain: new EventEmitter(),
    globalShortcut: { register: vi.fn(), unregister: vi.fn() },
    BrowserWindow: class extends EventEmitter {
      webContents = Object.assign(new EventEmitter(), { send: vi.fn(), focus: vi.fn() });
      isFocused = () => true;
      isDestroyed = () => false;
    },
  };
});

it("keeps project switching across hash routes, but releases it for a document reload", () => {
  const callbacks = new Map<string, () => void>();
  vi.mocked(Electron.globalShortcut.register)
    .mockReset()
    .mockImplementation((key, callback) => {
      callbacks.set(key, callback);
      return true;
    });
  vi.mocked(Electron.globalShortcut.unregister)
    .mockReset()
    .mockImplementation((key) => {
      callbacks.delete(key);
    });
  const window = new Electron.BrowserWindow();
  installProjectSwitcherShortcuts(window);
  const ready = () =>
    Electron.ipcMain.emit(PROJECT_SWITCHER_ENABLED_CHANNEL, { sender: window.webContents }, true);
  try {
    ready();
    expect(callbacks.size).toBe(2);
    // Chromium starts loading even when T4 only changes its hash route.
    window.webContents.emit("did-start-loading");
    window.webContents.emit("did-start-navigation", { isSameDocument: true, isMainFrame: true });
    expect(callbacks.size).toBe(2);
    callbacks.get("Alt+Tab")!();
    expect(window.webContents.send).toHaveBeenLastCalledWith(
      MENU_ACTION_CHANNEL,
      "t4.project-switcher.next",
    );
    window.webContents.emit("did-start-navigation", { isSameDocument: false, isMainFrame: false });
    expect(callbacks.size).toBe(2);
    window.webContents.emit("did-start-navigation", { isSameDocument: false, isMainFrame: true });
    expect(callbacks.size).toBe(0);
    ready();
    expect(callbacks.size).toBe(2);
    window.webContents.emit("render-process-gone");
    expect(callbacks.size).toBe(0);
  } finally {
    window.emit("closed");
  }
});
