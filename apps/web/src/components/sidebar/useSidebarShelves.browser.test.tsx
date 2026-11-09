import { describe, expect, it } from "vite-plus/test";

import { render } from "../../../test/render";
import { type SidebarShelf, useSidebarShelves } from "./useSidebarShelves";

const SHELVES: readonly SidebarShelf[] = ["settled", "snoozed", "working"];

function Shelves({ screenKey }: { screenKey: string }) {
  const { shelves, toggleShelf } = useSidebarShelves(screenKey);
  return SHELVES.map((shelf) => (
    <button
      key={shelf}
      type="button"
      aria-pressed={shelves[shelf]}
      onClick={() => toggleShelf(shelf)}
    >
      {shelf}
    </button>
  ));
}

describe("useSidebarShelves", () => {
  it("opens Working and keeps Settled and Snoozed folded by default", async () => {
    await using screen = await render(<Shelves screenKey="a" />, { router: false });
    await expect
      .element(screen.getByRole("button", { name: "settled" }))
      .toHaveAttribute("aria-pressed", "false");
    await expect
      .element(screen.getByRole("button", { name: "snoozed" }))
      .toHaveAttribute("aria-pressed", "false");
    await expect
      .element(screen.getByRole("button", { name: "working" }))
      .toHaveAttribute("aria-pressed", "true");
  });

  it("keeps a manual toggle on the same screen and restores the defaults on the next one", async () => {
    await using screen = await render(<Shelves screenKey="a" />, { router: false });
    const settled = screen.getByRole("button", { name: "settled" });
    const working = screen.getByRole("button", { name: "working" });
    await settled.click();
    await working.click();
    await screen.rerender(<Shelves screenKey="a" />);
    await expect.element(settled).toHaveAttribute("aria-pressed", "true");
    await expect.element(working).toHaveAttribute("aria-pressed", "false");

    await screen.rerender(<Shelves screenKey="b" />);
    await expect.element(settled).toHaveAttribute("aria-pressed", "false");
    await expect.element(working).toHaveAttribute("aria-pressed", "true");
  });
});
