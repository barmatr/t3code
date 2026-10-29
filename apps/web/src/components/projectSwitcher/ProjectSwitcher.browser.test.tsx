import { describe, expect, it, vi } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { act, render } from "../../../test/render";

const DEFAULT_PROJECT_KEYS = ["a", "b", "c"];
const mockProjectKeys = vi.hoisted(() => ({ current: ["a", "b", "c"] }));

vi.mock("../../hooks/useSidebarProjectGroups", () => ({
  useSidebarProjectGroups: () =>
    mockProjectKeys.current.map((key) => ({
      id: key,
      environmentId: "env",
      projectKey: key,
      displayName: key.toUpperCase(),
      memberProjectRefs: [{ environmentId: "env", projectId: key }],
    })),
}));
vi.mock("../../hooks/useRecentProjectKeys", () => ({ useRecentProjectKeys: () => new Set() }));
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

function setup(projectKeys = DEFAULT_PROJECT_KEYS) {
  mockProjectKeys.current = [...projectKeys];
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
  previousState.setSidebarProjectScopeKeys([...projectKeys]);
  previousState.setSidebarFocusedProjectKey(projectKeys[0]!);
  return {
    send: (...actions: string[]) =>
      act(() => {
        actions.forEach((action) => onAction(`t4.project-switcher.${action}`));
      }),
    [Symbol.dispose]() {
      mockProjectKeys.current = DEFAULT_PROJECT_KEYS;
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

describe("project switcher layout", () => {
  const rowTops = (cards: readonly Element[]) =>
    [...new Set(cards.map((card) => Math.round(card.getBoundingClientRect().top)))].sort(
      (a, b) => a - b,
    );

  async function open(projectCount: number) {
    await page.viewport(1280, 900);
    const keys = Array.from({ length: projectCount }, (_, index) => `p${index + 1}`);
    const harness = setup(keys);
    const screen = await render(<ProjectSwitcher />, { router: "/env/a-latest" });
    await harness.send("next");
    await expect.element(page.getByRole("listbox", { name: "Projets" })).toBeVisible();
    const list = page.getByRole("listbox", { name: "Projets" }).element() as HTMLElement;
    const cards = page.getByRole("option").elements();
    return { harness, screen, list, cards, popup: list.parentElement! };
  }

  it("keeps a short list on one row of compact cards", async () => {
    const { harness, screen, list, cards, popup } = await open(2);
    using _harness = harness;
    await using _screen = screen;
    expect(cards).toHaveLength(3);
    expect(rowTops(cards)).toHaveLength(1);
    expect(list.scrollWidth).toBeLessThanOrEqual(list.clientWidth);
    for (const card of cards) expect(card.getBoundingClientRect().width).toBeLessThanOrEqual(135);
    expect(popup.scrollHeight).toBeLessThanOrEqual(popup.clientHeight);
  });

  it("moves to two rows instead of scrolling sideways", async () => {
    const { harness, screen, list, cards, popup } = await open(8);
    using _harness = harness;
    await using _screen = screen;
    expect(rowTops(cards)).toHaveLength(2);
    expect(list.scrollWidth).toBeLessThanOrEqual(list.clientWidth);
    expect(list.scrollHeight).toBeLessThanOrEqual(list.clientHeight);
    expect(new Set(cards.map((card) => Math.round(card.getBoundingClientRect().width))).size).toBe(
      1,
    );
    expect(popup.scrollHeight).toBeLessThanOrEqual(popup.clientHeight);
  });

  it("shows two rows and scrolls vertically past them", async () => {
    const { harness, screen, list, cards, popup } = await open(21);
    using _harness = harness;
    await using _screen = screen;
    const tops = rowTops(cards);
    expect(tops.length).toBeGreaterThan(2);
    expect(list.scrollWidth).toBeLessThanOrEqual(list.clientWidth);
    expect(list.scrollHeight).toBeGreaterThan(list.clientHeight);
    const visibleBottom = list.getBoundingClientRect().bottom;
    const firstCardInRow = (row: number) =>
      cards.find((card) => Math.round(card.getBoundingClientRect().top) === tops[row])!;
    // The second row is fully shown; the third only peeks, hinting that the list scrolls.
    expect(firstCardInRow(1).getBoundingClientRect().bottom).toBeLessThanOrEqual(visibleBottom);
    expect(firstCardInRow(2).getBoundingClientRect().bottom).toBeGreaterThan(visibleBottom);
    expect(popup.scrollHeight).toBeLessThanOrEqual(popup.clientHeight);
  });
});
