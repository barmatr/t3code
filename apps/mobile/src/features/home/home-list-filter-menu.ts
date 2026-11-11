import type { EnvironmentId } from "@t3tools/contracts";

import type { AppBarMenuItem } from "../../components/ui/AppBar.types";
import { THREAD_AGE_OPTIONS, type ThreadAge } from "../../lib/thread-age";

export interface HomeListFilterMenuEnvironment {
  readonly environmentId: EnvironmentId;
  readonly label: string;
}

export interface HomeListFilterMenuProject {
  readonly key: string;
  readonly label: string;
}

export function buildHomeListFilterMenuItems(props: {
  readonly environments: ReadonlyArray<HomeListFilterMenuEnvironment>;
  readonly projects: ReadonlyArray<HomeListFilterMenuProject>;
  readonly selectedEnvironmentId: EnvironmentId | null;
  readonly selectedProjectKey: string | null;
  /** T4: the age filter; omitted where the list has no age (the Agents tab). */
  readonly selectedAge?: ThreadAge;
  /** T4: hot ignores the age filter, so the age submenu is disabled meanwhile. */
  readonly hot?: boolean;
  readonly onEnvironmentChange: (environmentId: EnvironmentId | null) => void;
  readonly onProjectChange: (projectKey: string | null) => void;
  readonly onAgeChange?: (age: ThreadAge) => void;
}): AppBarMenuItem[] {
  const items: AppBarMenuItem[] = [
    {
      id: "environment",
      title: "Environment",
      items: [
        {
          id: "environment:all",
          title: "All env",
          subtitle: "Show threads from every environment",
          selected: props.selectedEnvironmentId === null,
          onPress: () => props.onEnvironmentChange(null),
        },
        ...props.environments.map((environment) => ({
          id: `environment:${environment.environmentId}`,
          title: environment.label,
          selected: props.selectedEnvironmentId === environment.environmentId,
          onPress: () => props.onEnvironmentChange(environment.environmentId),
        })),
      ],
    },
  ];

  if (props.projects.length > 0) {
    items.push({
      id: "project",
      title: "Project",
      items: [
        {
          id: "project:all",
          title: "All projects",
          subtitle: "Show threads from every project",
          selected: props.selectedProjectKey === null,
          onPress: () => props.onProjectChange(null),
        },
        ...props.projects.map((project) => ({
          id: `project:${project.key}`,
          title: project.label,
          selected: props.selectedProjectKey === project.key,
          onPress: () => props.onProjectChange(project.key),
        })),
      ],
    });
  }

  const { selectedAge, onAgeChange } = props;
  if (selectedAge !== undefined && onAgeChange !== undefined) {
    items.push({
      id: "age",
      title: props.hot ? "Age ignored while hot" : "Age",
      items: THREAD_AGE_OPTIONS.map((option) => ({
        id: `age:${option.id}`,
        title: option.label,
        disabled: props.hot === true,
        selected: selectedAge === option.id,
        onPress: () => onAgeChange(option.id),
      })),
    });
  }

  return items;
}
