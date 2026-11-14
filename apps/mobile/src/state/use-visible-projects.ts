import { useMemo } from "react";
import type { EnvironmentProject } from "@t3tools/client-runtime/state/shell";
import { useProjects } from "./entities";
import { useHiddenProjectKeys } from "./project-visibility";
import { scopedProjectKey } from "../lib/scopedEntities";

export function useVisibleProjects(): ReadonlyArray<EnvironmentProject> {
  const projects = useProjects();
  const hidden = useHiddenProjectKeys();
  return useMemo(
    () =>
      hidden.size === 0
        ? projects
        : projects.filter(
            (project) => !hidden.has(scopedProjectKey(project.environmentId, project.id)),
          ),
    [projects, hidden],
  );
}
