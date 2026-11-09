import { ArrowLeftIcon, CrosshairIcon } from "lucide-react";

import type { SidebarProjectSnapshot } from "../../sidebarProjectGrouping";
import { ProjectFavicon } from "../ProjectFavicon";
import styles from "./projectFocusCard.module.css";

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
    </section>
  );
}
