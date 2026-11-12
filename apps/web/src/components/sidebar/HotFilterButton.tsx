import { useEffect, useRef, useState } from "react";

import { cn } from "~/lib/utils";
import { burnFire, type FireOptions } from "../projectSwitcher/focusFire";
import { SidebarHeaderIconButton } from "./SidebarThreadHeader";

/** Small enough to stay inside the sidebar header, round like the button it wraps. */
const HOT_BUTTON_FIRE: FireOptions = {
  radius: 12,
  reach: { side: 5, top: 10, bottom: 3 },
  border: 0,
  continuous: true,
};

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => window.matchMedia(REDUCED_MOTION_QUERY).matches);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- follows the system setting while hot burns
  useEffect(() => {
    const query = window.matchMedia(REDUCED_MOTION_QUERY);
    const onChange = () => setReduced(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/** The blue fire around the active hot button; it burns until hot goes off. */
function HotFire() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- drives the canvas frames while the fire is mounted
  useEffect(() => {
    if (!canvasRef.current) return;
    return burnFire(canvasRef.current, HOT_BUTTON_FIRE);
  }, []);
  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute z-[1]"
      data-hot-fire
    />
  );
}

/** T4's hot filter: greyed when off, filled and burning while it filters the sidebar. */
export function HotFilterButton({ hot, onToggle }: { hot: boolean; onToggle: () => void }) {
  const reducedMotion = usePrefersReducedMotion();
  return (
    <span className="relative inline-flex size-7 shrink-0">
      <SidebarHeaderIconButton
        label={
          hot ? "Hot: show all threads" : "Hot: show actions, unread replies and work in progress"
        }
        aria-pressed={hot}
        onClick={onToggle}
      >
        <span
          className={cn(
            "flex size-6 items-center justify-center rounded-full text-3xs leading-none font-bold tracking-tight",
            hot ? "bg-primary text-primary-foreground" : "text-sidebar-muted-foreground/70",
          )}
        >
          hot
        </span>
      </SidebarHeaderIconButton>
      {hot && !reducedMotion ? <HotFire /> : null}
    </span>
  );
}

const SIDEBAR_HOT_STORAGE_KEY = "t4:sidebar-hot";

/** Hot state kept across restarts; storage failures fall back to off. */
export function readSidebarHot(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_HOT_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeSidebarHot(hot: boolean): void {
  try {
    if (hot) window.localStorage.setItem(SIDEBAR_HOT_STORAGE_KEY, "1");
    else window.localStorage.removeItem(SIDEBAR_HOT_STORAGE_KEY);
  } catch {
    // The toggle still works for this session.
  }
}
