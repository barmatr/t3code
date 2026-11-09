import { describe, expect, it, vi } from "vite-plus/test";

import { act, fakeTimers, render, stubGlobal } from "../../../test/render";
import type { SidebarProjectSnapshot } from "../../sidebarProjectGrouping";
import { ProjectFocusCard } from "./ProjectFocusCard";

vi.mock("../ProjectFavicon", () => ({ ProjectFavicon: () => null }));

const project = { displayName: "reno-obsid", projectKey: "reno" } as SidebarProjectSnapshot;
const otherProject = { displayName: "t4code", projectKey: "t4" } as SidebarProjectSnapshot;

const fireIn = (container: HTMLElement) =>
  container.querySelector<HTMLCanvasElement>("[data-focus-fire]");

const advance = (milliseconds: number) => act(() => vi.advanceTimersByTime(milliseconds));

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

  it("burns for 1.4 seconds, then removes its canvas", async () => {
    using _timers = fakeTimers();
    await using screen = await render(
      <ProjectFocusCard project={project} exitLabel="All selected projects" onExit={vi.fn()} />,
      { router: false },
    );
    await advance(1350);
    expect(fireIn(screen.container)).not.toBeNull();

    await advance(100);
    expect(fireIn(screen.container)).toBeNull();
  });

  it("draws flames around the card and leaves its inside untouched", async () => {
    using _timers = fakeTimers();
    await using screen = await render(
      <ProjectFocusCard project={project} exitLabel="All selected projects" onExit={vi.fn()} />,
      { router: false },
    );
    await advance(500);
    const canvas = fireIn(screen.container)!;
    const context = canvas.getContext("2d")!;
    const center = context.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data;
    expect(center[3]).toBe(0);

    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    expect(data.some((value, index) => index % 4 === 3 && value > 0)).toBe(true);
  });

  it("relights when focus moves to another project, not when the same one re-renders", async () => {
    using _timers = fakeTimers();
    await using screen = await render(
      <ProjectFocusCard project={project} exitLabel="All selected projects" onExit={vi.fn()} />,
      { router: false },
    );
    await advance(1500);
    expect(fireIn(screen.container)).toBeNull();

    await screen.rerender(
      <ProjectFocusCard project={project} exitLabel="All recent projects" onExit={vi.fn()} />,
    );
    expect(fireIn(screen.container)).toBeNull();

    await screen.rerender(
      <ProjectFocusCard
        project={otherProject}
        exitLabel="All selected projects"
        onExit={vi.fn()}
      />,
    );
    expect(fireIn(screen.container)).not.toBeNull();
  });

  it("stays unlit when the system asks for reduced motion", async () => {
    using _motion = stubGlobal("matchMedia", () => ({ matches: true }));
    await using screen = await render(
      <ProjectFocusCard project={project} exitLabel="All selected projects" onExit={vi.fn()} />,
      { router: false },
    );
    expect(fireIn(screen.container)).toBeNull();
    await expect.element(screen.getByText("reno-obsid")).toBeVisible();
  });
});
