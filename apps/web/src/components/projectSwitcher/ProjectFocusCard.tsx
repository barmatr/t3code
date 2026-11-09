import { ArrowLeftIcon, CrosshairIcon } from "lucide-react";
import { useId, useState } from "react";

import type { SidebarProjectSnapshot } from "../../sidebarProjectGrouping";
import { ProjectFavicon } from "../ProjectFavicon";
import styles from "./projectFocusCard.module.css";

/** One burst of flames along the card's border; it removes itself once burned out. */
function FocusFlames() {
  const filterId = useId();
  const [burning, setBurning] = useState(true);
  if (!burning) return null;
  return (
    <svg
      aria-hidden
      className={styles["t4-focus-flames"]}
      data-focus-flames
      onAnimationEnd={(event) => {
        // The layers' own animations bubble up here; only the svg's marks the end of the burst.
        if (event.target === event.currentTarget) setBurning(false);
      }}
    >
      <defs>
        <filter
          id={filterId}
          colorInterpolationFilters="sRGB"
          filterUnits="userSpaceOnUse"
          height="100%"
          width="100%"
          x="0"
          y="0"
        >
          <feGaussianBlur in="SourceGraphic" result="soft" stdDeviation="0.7" />
          <feTurbulence
            baseFrequency="0.026 0.042"
            numOctaves={2}
            result="noise"
            seed={1}
            type="fractalNoise"
          >
            <animate
              attributeName="baseFrequency"
              dur="0.9s"
              repeatCount="indefinite"
              values="0.026 0.042;0.034 0.058;0.024 0.05;0.03 0.038;0.026 0.042"
            />
          </feTurbulence>
          <feDisplacementMap
            in="soft"
            in2="noise"
            result="licked"
            scale={13}
            xChannelSelector="R"
            yChannelSelector="G"
          />
          <feGaussianBlur in="licked" result="glow" stdDeviation="3.2" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="licked" />
          </feMerge>
        </filter>
      </defs>
      <g filter={`url(#${filterId})`}>
        <rect className={styles["t4-flame-ignition"]} pathLength={100} />
        <rect className={styles["t4-flame-tail"]} pathLength={100} />
        <rect className={styles["t4-flame-body"]} pathLength={100} />
        <rect className={styles["t4-flame-outer"]} pathLength={100} />
        <rect className={styles["t4-flame-hot"]} pathLength={100} />
        <rect className={styles["t4-flame-core"]} pathLength={100} />
      </g>
    </svg>
  );
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
      <FocusFlames key={project.projectKey} />
    </section>
  );
}
