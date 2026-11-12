import { useState } from "react";
import { describe, expect, it, vi } from "vite-plus/test";

import { act, fakeTimers, render } from "../../../test/render";
import { SidebarProvider } from "../ui/sidebar";
import { HotFilterButton } from "./HotFilterButton";

const fireIn = (container: HTMLElement) =>
  container.querySelector<HTMLCanvasElement>("[data-hot-fire]");

function Harness() {
  const [hot, setHot] = useState(false);
  return (
    <SidebarProvider>
      <HotFilterButton hot={hot} onToggle={() => setHot(!hot)} />
    </SidebarProvider>
  );
}

describe("HotFilterButton", () => {
  it("toggles hot and burns only while it is on", async () => {
    using _timers = fakeTimers();
    await using screen = await render(<Harness />, { router: false });
    const button = screen.getByRole("button", { name: /^Hot:/ });
    await expect.element(button).toHaveAttribute("aria-pressed", "false");
    expect(fireIn(screen.container)).toBeNull();

    await button.click();
    await expect.element(button).toHaveAttribute("aria-pressed", "true");
    // Unlike the focus card's burst, hot keeps burning.
    await act(() => vi.advanceTimersByTime(5_000));
    const canvas = fireIn(screen.container)!;
    expect(canvas).not.toBeNull();
    const context = canvas.getContext("2d")!;
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    expect(data.some((value, index) => index % 4 === 3 && value > 0)).toBe(true);

    await button.click();
    await expect.element(button).toHaveAttribute("aria-pressed", "false");
    expect(fireIn(screen.container)).toBeNull();
  });
});
