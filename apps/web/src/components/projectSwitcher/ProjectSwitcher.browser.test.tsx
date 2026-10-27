import { describe, expect, it, vi } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { act, render } from "../../../test/render";

vi.mock("../../hooks/useSidebarProjectGroups", () => ({
  useSidebarProjectGroups: () =>
    ["a", "b", "c"].map((key) => ({
      id: key,
      environmentId: "env",
      projectKey: key,
      displayName: key.toUpperCase(),
      memberProjectRefs: [{ environmentId: "env", projectId: key }],
    })),
}));
vi.mock("../../hooks/useThreadRouteTarget", () => ({ useThreadRouteTarget: () => null }));
vi.mock("../../state/entities", () => ({
  useQuietThreadShell: () => null,
  readThreadShells: () =>
    [
      { id: "b-old", environmentId: "env", projectId: "b", updatedAt: "2026-10-26T10:00:00Z" },
      { id: "a-latest", environmentId: "env", projectId: "a", updatedAt: "2026-10-26T11:00:00Z" },
      { id: "b-latest", environmentId: "env", projectId: "b", updatedAt: "2026-10-26T12:00:00Z" },
    ].map((thread) => ({
      ...thread,
      archivedAt: null,
      deletedAt: null,
      lineage: { relationshipToParent: null },
    })),
}));
vi.mock("../ui/sidebar", () => ({ useSidebar: () => ({ setOpen: () => {} }) }));
vi.mock("../ProjectFavicon", () => ({ ProjectFavicon: () => null }));
vi.mock("../SidebarStageBackdrop", () => ({ StageBackdropArt: () => null }));
vi.mock("../../hooks/useHandleNewThread", () => ({ useNewThreadHandler: () => async () => null }));

import { ProjectSwitcher } from "./ProjectSwitcher";
import { useUiStateStore } from "../../uiStateStore";

function setup() {
  const previousState = useUiStateStore.getState();
  const bridge = Object.getOwnPropertyDescriptor(window, "desktopBridge");
  let onAction: (value: string) => void = () => {};
  Object.defineProperty(window, "desktopBridge", {
    configurable: true,
    value: {
      onMenuAction: (callback: (value: string) => void) => {
        onAction = callback;
        return () => {};
      },
      setProjectSwitcherEnabled: () => {},
    },
  });
  previousState.setSidebarProjectScopeKeys(["a", "b", "c"]);
  previousState.setSidebarFocusedProjectKey("a");
  return {
    send: (...actions: string[]) =>
      act(() => {
        actions.forEach((action) => onAction(`t4.project-switcher.${action}`));
      }),
    [Symbol.dispose]() {
      useUiStateStore.setState(previousState);
      if (bridge) Object.defineProperty(window, "desktopBridge", bridge);
      else Reflect.deleteProperty(window, "desktopBridge");
    },
  };
}

describe("project switcher navigation", () => {
  it("opens the newest conversation and alternates projects across complete shortcut invocations", async () => {
    using harness = setup();
    await using screen = await render(<ProjectSwitcher />, { router: "/env/a-latest" });
    await harness.send("next");
    await expect
      .element(page.getByRole("option", { name: "B", exact: true }))
      .toHaveAttribute("aria-selected", "true");
    await harness.send("commit");
    await vi.waitFor(() => expect(screen.router?.state.location.pathname).toBe("/env/b-latest"));
    expect(useUiStateStore.getState().sidebarProjectScopeKeys).toEqual(["a", "b", "c"]);
    await harness.send("next", "commit");
    await vi.waitFor(() => expect(screen.router?.state.location.pathname).toBe("/env/a-latest"));
    expect(useUiStateStore.getState().sidebarFocusedProjectKey).toBe("a");
    await harness.send("next", "commit");
    await vi.waitFor(() => expect(screen.router?.state.location.pathname).toBe("/env/b-latest"));
  });

  it("keeps the order stable while cycling and leaves navigation/history intact on cancel", async () => {
    using harness = setup();
    await using screen = await render(<ProjectSwitcher />, { router: "/env/a-latest" });
    await harness.send("next", "next");
    await expect
      .element(page.getByRole("option", { name: "C", exact: true }))
      .toHaveAttribute("aria-selected", "true");
    await harness.send("previous");
    await expect
      .element(page.getByRole("option", { name: "B", exact: true }))
      .toHaveAttribute("aria-selected", "true");
    await harness.send("cancel");
    expect(screen.router?.state.location.pathname).toBe("/env/a-latest");
    expect(useUiStateStore.getState().sidebarFocusedProjectKey).toBe("a");
    await harness.send("next");
    await expect
      .element(page.getByRole("option", { name: "B", exact: true }))
      .toHaveAttribute("aria-selected", "true");
    await page.getByRole("option", { name: "Tous les projets sélectionnés", exact: true }).click();
    expect(useUiStateStore.getState().sidebarFocusedProjectKey).toBeNull();
    expect(screen.router?.state.location.pathname).toBe("/env/a-latest");
  });
});
