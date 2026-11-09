import { useState } from "react";

export type SidebarShelf = "settled" | "snoozed" | "working";

const DEFAULT_SHELVES: Readonly<Record<SidebarShelf, boolean>> = {
  settled: false,
  snoozed: false,
  working: true,
};

/**
 * A shelf's expansion lasts for the current screen only: each new `screenKey`
 * restores the defaults, so an open shelf never follows the user to the next view.
 */
export function useSidebarShelves(screenKey: string) {
  const [state, setState] = useState({ screenKey, shelves: DEFAULT_SHELVES });
  if (state.screenKey !== screenKey) setState({ screenKey, shelves: DEFAULT_SHELVES });
  const shelves = state.screenKey === screenKey ? state.shelves : DEFAULT_SHELVES;
  const toggleShelf = (shelf: SidebarShelf) =>
    setState((current) => ({
      screenKey: current.screenKey,
      shelves: { ...current.shelves, [shelf]: !current.shelves[shelf] },
    }));
  return { shelves, toggleShelf };
}
