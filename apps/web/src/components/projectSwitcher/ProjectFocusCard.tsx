import { ArrowLeftIcon, CrosshairIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { SidebarProjectSnapshot } from "../../sidebarProjectGrouping";
import { ProjectFavicon } from "../ProjectFavicon";
import { burnFocusFire } from "./focusFire";
import styles from "./projectFocusCard.module.css";

/** One burst of fire along the card's border; it removes itself once burned out. */
function FocusFire() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [burning, setBurning] = useState(
    () => !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- drives the canvas frames while the fire is mounted
  useEffect(() => {
    if (!canvasRef.current) return;
    return burnFocusFire(canvasRef.current, () => setBurning(false));
  }, []);
  if (!burning) return null;
  return <canvas ref={canvasRef} aria-hidden className={styles["t4-focus-fire"]} data-focus-fire />;
}

export function ProjectFocusCard({
  project,
  exitLabel,
  onExit,
}: {
  project: SidebarProjectSnapshot;
  exitLabel: string;
  onExit: () => void;
}) {
  return (
    <section className={styles["t4-focus-card"]} aria-label="Project focus">
      <div className={styles["t4-focus-eyebrow"]}>
        <CrosshairIcon aria-hidden size={12} />
        Project focus
      </div>
      <div className={styles["t4-focus-project"]} aria-live="polite">
        <ProjectFavicon project={project} className="size-5 shrink-0" />
        <span className={styles["t4-focus-name"]}>{project.displayName}</span>
      </div>
      <button type="button" className={styles["t4-focus-exit"]} onClick={onExit}>
        <ArrowLeftIcon aria-hidden size={13} />
        <span className={styles["t4-focus-exit-label"]}>{exitLabel}</span>
      </button>
      <FocusFire key={project.projectKey} />
    </section>
  );
}
