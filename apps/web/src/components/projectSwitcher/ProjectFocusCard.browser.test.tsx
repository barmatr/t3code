import { describe, expect, it, vi } from "vite-plus/test";

import { act, render } from "../../../test/render";
import type { SidebarProjectSnapshot } from "../../sidebarProjectGrouping";
import { ProjectFocusCard } from "./ProjectFocusCard";

vi.mock("../ProjectFavicon", () => ({ ProjectFavicon: () => null }));

const project = { displayName: "reno-obsid", projectKey: "reno" } as SidebarProjectSnapshot;
const otherProject = { displayName: "t4code", projectKey: "t4" } as SidebarProjectSnapshot;

const flamesIn = (container: HTMLElement) =>
  container.querySelector<SVGSVGElement>("[data-focus-flames]");

const endAnimationOn = (target: Element) =>
  act(() => target.dispatchEvent(new AnimationEvent("animationend", { bubbles: true })));

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

  it("burns for five seconds and only stops when the whole burst ends", async () => {
    await using screen = await render(
      <ProjectFocusCard project={project} exitLabel="All selected projects" onExit={vi.fn()} />,
      { router: false },
    );
    const flames = flamesIn(screen.container)!;
    expect(getComputedStyle(flames).animationDuration).toBe("5s");

    await endAnimationOn(flames.querySelector("rect")!);
    expect(flamesIn(screen.container)).not.toBeNull();

    await endAnimationOn(flames);
    expect(flamesIn(screen.container)).toBeNull();
  });

  it("relights when focus moves to another project, not when the same one re-renders", async () => {
    await using screen = await render(
      <ProjectFocusCard project={project} exitLabel="All selected projects" onExit={vi.fn()} />,
      { router: false },
    );
    await endAnimationOn(flamesIn(screen.container)!);
    expect(flamesIn(screen.container)).toBeNull();

    await screen.rerender(
      <ProjectFocusCard project={project} exitLabel="All recent projects" onExit={vi.fn()} />,
    );
    expect(flamesIn(screen.container)).toBeNull();

    await screen.rerender(
      <ProjectFocusCard
        project={otherProject}
        exitLabel="All selected projects"
        onExit={vi.fn()}
      />,
    );
    expect(flamesIn(screen.container)).not.toBeNull();
  });
});
