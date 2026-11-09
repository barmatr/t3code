import { describe, expect, it, vi } from "vite-plus/test";

import { render } from "../../../test/render";
import type { SidebarProjectSnapshot } from "../../sidebarProjectGrouping";
import { ProjectFocusCard } from "./ProjectFocusCard";

vi.mock("../ProjectFavicon", () => ({ ProjectFavicon: () => null }));

const project = { displayName: "reno-obsid" } as SidebarProjectSnapshot;

describe("ProjectFocusCard", () => {
  it("names the focus and the project, and leaves focus from its exit button", async () => {
    const onExit = vi.fn();
    await using screen = await render(
      <ProjectFocusCard project={project} exitLabel="All selected projects" onExit={onExit} />,
      { router: false },
    );
    const card = screen.getByRole("region", { name: "Project focus" });
    await expect.element(card.getByText("Project focus")).toBeVisible();
    await expect.element(card.getByText("reno-obsid")).toBeVisible();

    await card.getByRole("button", { name: "All selected projects" }).click();
    expect(onExit).toHaveBeenCalledOnce();
  });
});
