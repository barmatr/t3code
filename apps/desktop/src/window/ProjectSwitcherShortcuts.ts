import * as Electron from "electron";
import { MENU_ACTION_CHANNEL, PROJECT_SWITCHER_ENABLED_CHANNEL } from "../ipc/channels.ts";

const NEXT = "Alt+Tab";
const PREVIOUS = "Alt+Shift+Tab";
const PREFIX = "t4.project-switcher.";

export function createProjectSwitcherShortcuts(input: {
  register: (accelerator: string, callback: () => void) => boolean;
  unregister: (accelerator: string) => void;
  notify: (action: string) => void;
  focusContents: () => void;
}) {
  let focused = false;
  let enabled = false;
  let active = false;
  const registered = new Set<string>();
  const finish = (action: "commit" | "cancel") => {
    if (!active) return;
    active = false;
    input.notify(PREFIX + action);
  };
  const release = () => {
    for (const accelerator of registered) input.unregister(accelerator);
    registered.clear();
    finish("cancel");
  };
  const sync = () => {
    if (!focused || !enabled) return release();
    if (registered.size > 0) return;
    for (const [accelerator, action] of [
      [NEXT, "next"],
      [PREVIOUS, "previous"],
    ] as const) {
      const ok = input.register(accelerator, () => {
        if (!focused || !enabled) return;
        active = true;
        // A preview guest may own keyboard focus; option release must reach the main client.
        input.focusContents();
        input.notify(PREFIX + action);
      });
      if (!ok) {
        release();
        input.notify(PREFIX + "unavailable");
        return;
      }
      registered.add(accelerator);
    }
  };
  return {
    setFocused(value: boolean) {
      focused = value;
      sync();
    },
    setEnabled(value: boolean) {
      enabled = value;
      sync();
    },
    onInput(
      event: { preventDefault: () => void },
      key: Pick<Electron.Input, "type" | "key" | "alt">,
    ) {
      if (!active) return;
      if (!key.alt) {
        finish("commit");
        return;
      }
      if (key.type !== "keyDown") return;
      if (key.key === "Escape") {
        event.preventDefault();
        finish("cancel");
      } else if (key.key === "ArrowLeft" || key.key === "ArrowRight") {
        event.preventDefault();
        input.notify(PREFIX + (key.key === "ArrowLeft" ? "previous" : "next"));
      }
    },
    dispose() {
      enabled = false;
      release();
    },
  };
}

export function installProjectSwitcherShortcuts(window: Electron.BrowserWindow): void {
  const controller = createProjectSwitcherShortcuts({
    register: (key, callback) => Electron.globalShortcut.register(key, callback),
    unregister: (key) => Electron.globalShortcut.unregister(key),
    notify: (action) => {
      if (!window.isDestroyed()) window.webContents.send(MENU_ACTION_CHANNEL, action);
    },
    focusContents: () => window.webContents.focus(),
  });
  const onEnabled = (event: Electron.IpcMainEvent, value: unknown) => {
    if (event.sender !== window.webContents || typeof value !== "boolean") return;
    controller.setEnabled(value);
  };
  const onFocus = () => controller.setFocused(true);
  const onBlur = () => controller.setFocused(false);
  const onLoading = () => controller.setEnabled(false);
  Electron.ipcMain.on(PROJECT_SWITCHER_ENABLED_CHANNEL, onEnabled);
  window.on("focus", onFocus);
  window.on("blur", onBlur);
  window.webContents.on("before-input-event", controller.onInput);
  // Hash routing also emits did-start-loading, without remounting the client that enables us.
  window.webContents.on("did-start-navigation", (event) => {
    if (event.isMainFrame && !event.isSameDocument) onLoading();
  });
  window.webContents.on("render-process-gone", onLoading);
  window.once("closed", () => {
    controller.dispose();
    Electron.ipcMain.removeListener(PROJECT_SWITCHER_ENABLED_CHANNEL, onEnabled);
  });
  controller.setFocused(window.isFocused());
}
