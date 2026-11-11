import { ThreadListFilters, HotFilterButton } from "./ThreadListFilters";
import { View } from "react-native";
import type { MenuAction } from "@react-native-menu/menu";
import { NativeStackScreenOptions } from "../../native/StackHeader";
import { ThreadListToolbar } from "./ThreadListToolbar";
import type { HomeHeaderProps } from "./HomeHeader.types";
import { isThreadAge, THREAD_AGE_OPTIONS } from "../../lib/thread-age";

export type { HomeHeaderEnvironment } from "./HomeHeader.types";

function checkedMenuState(checked: boolean) {
  return checked ? ("on" as const) : undefined;
}

export function HomeHeader(props: HomeHeaderProps) {
  const hasCustomListOptions =
    props.selectedEnvironmentId !== null ||
    props.selectedProjectKey !== null ||
    props.selectedAge !== "all";
  const menuActions: MenuAction[] = [
    {
      id: "environment",
      title: "Environment",
      subactions: [
        {
          id: "environment:all",
          title: "All env",
          state: checkedMenuState(props.selectedEnvironmentId === null),
        },
        ...props.environments.map((environment) => ({
          id: `environment:${environment.environmentId}`,
          title: environment.label,
          state: checkedMenuState(props.selectedEnvironmentId === environment.environmentId),
        })),
      ],
    },
    ...(props.projects.length === 0
      ? []
      : ([
          {
            id: "project",
            title: "Project",
            subactions: [
              {
                id: "project:all",
                title: "All projects",
                state: checkedMenuState(props.selectedProjectKey === null),
              },
              ...props.projects.map((project) => ({
                id: `project:${project.key}`,
                title: project.label,
                state: checkedMenuState(props.selectedProjectKey === project.key),
              })),
            ],
          },
        ] satisfies MenuAction[])),
    {
      id: "age",
      title: props.hot ? "Age ignored while hot" : "Age",
      attributes: props.hot ? { disabled: true } : undefined,
      subactions: THREAD_AGE_OPTIONS.map((option) => ({
        id: `age:${option.id}`,
        title: option.label,
        state: checkedMenuState(props.selectedAge === option.id),
      })),
    },
  ];
  const handleMenuAction = (event: { nativeEvent: { event: string } }) => {
    const id = event.nativeEvent.event;
    if (id.startsWith("age:")) {
      const age = id.slice("age:".length);
      if (!props.hot && isThreadAge(age)) props.onAgeChange(age);
      return;
    }
    if (id === "environment:all") {
      props.onEnvironmentChange(null);
      return;
    }

    if (id.startsWith("environment:")) {
      const environmentId = id.slice("environment:".length);
      const environment = props.environments.find(
        (candidate) => candidate.environmentId === environmentId,
      );
      if (environment) {
        props.onEnvironmentChange(environment.environmentId);
      }
      return;
    }

    if (id === "project:all") {
      props.onProjectChange(null);
      return;
    }

    if (id.startsWith("project:")) {
      const projectKey = id.slice("project:".length);
      if (props.projects.some((project) => project.key === projectKey)) {
        props.onProjectChange(projectKey);
      }
      return;
    }
  };

  return (
    <>
      <NativeStackScreenOptions options={{ headerShown: false }} />
      <ThreadListToolbar
        searchQuery={props.searchQuery}
        onSearchQueryChange={props.onSearchQueryChange}
        workspaceTab={props.workspaceTab}
        hot={props.hot}
        filterActions={props.fixedScope ? [] : menuActions}
        filterCustomized={hasCustomListOptions}
        onFilterSelect={(event) => handleMenuAction({ nativeEvent: { event } })}
        onOpenEnvironments={props.onOpenEnvironments}
      />
      {props.fixedScope ? (
        props.onHotChange ? (
          <View className="items-end px-4">
            <HotFilterButton hot={props.hot ?? false} onChange={props.onHotChange} />
          </View>
        ) : null
      ) : (
        <ThreadListFilters {...props} gutter={0} />
      )}
    </>
  );
}
