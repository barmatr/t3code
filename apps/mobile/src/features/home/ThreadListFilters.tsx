import { Pressable, ScrollView, View } from "react-native";
import { AppText as Text } from "../../components/ui/AppText";
import { cn } from "../../lib/cn";
import { SymbolView } from "../../components/ui/AppSymbol";
import { ListFilterMenu } from "../layout/workspace/ListFilterMenu";
import type { EnvironmentId } from "@t3tools/contracts";
import type {
  HomeListFilterMenuEnvironment,
  HomeListFilterMenuProject,
} from "./home-list-filter-menu";
import {
  isThreadAge,
  threadAgeOption,
  THREAD_AGE_OPTIONS,
  type ThreadAge,
} from "../../lib/thread-age";

export function ThreadListFilters(props: {
  readonly environments: ReadonlyArray<HomeListFilterMenuEnvironment>;
  readonly projects: ReadonlyArray<HomeListFilterMenuProject>;
  readonly selectedEnvironmentId: EnvironmentId | null;
  readonly selectedProjectKey: string | null;
  readonly selectedAge: ThreadAge;
  readonly hot?: boolean | undefined;
  readonly onHotChange?: ((hot: boolean) => void) | undefined;
  readonly onEnvironmentChange: (environmentId: EnvironmentId | null) => void;
  readonly onProjectChange: (projectKey: string | null) => void;
  readonly onAgeChange: (age: ThreadAge) => void;
  /** List padding the scroller bleeds through so pills start where row content does. */
  readonly gutter: number;
}) {
  const selectedEnvironment = props.environments.find(
    (environment) => environment.environmentId === props.selectedEnvironmentId,
  );
  const selectedProject = props.projects.find(
    (project) => project.key === props.selectedProjectKey,
  );
  return (
    <View className="flex-row items-start" style={{ marginHorizontal: -props.gutter }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flex: 1, overflow: "visible" }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 2, paddingBottom: 10, gap: 8 }}
      >
        <ListFilterMenu
          label={selectedEnvironment?.label ?? "All env"}
          accessibilityLabel="Filter threads by environment"
          active={selectedEnvironment !== undefined}
          actions={[
            {
              id: "all",
              title: "All env",
              state: props.selectedEnvironmentId === null ? "on" : "off",
            },
            ...props.environments.map((environment) => ({
              id: JSON.stringify(environment.environmentId),
              title: environment.label,
              state:
                environment.environmentId === props.selectedEnvironmentId
                  ? ("on" as const)
                  : ("off" as const),
            })),
          ]}
          onSelect={(id) => {
            if (id === "all") props.onEnvironmentChange(null);
            else {
              const environment = props.environments.find(
                (candidate) => JSON.stringify(candidate.environmentId) === id,
              );
              if (environment) props.onEnvironmentChange(environment.environmentId);
            }
          }}
        />
        <ListFilterMenu
          label={selectedProject?.label ?? "All projects"}
          accessibilityLabel="Filter threads by project"
          active={selectedProject !== undefined}
          actions={[
            {
              id: "all",
              title: "All projects",
              state: props.selectedProjectKey === null ? "on" : "off",
            },
            ...props.projects.map((project) => ({
              id: JSON.stringify(project.key),
              title: project.label,
              state: project.key === props.selectedProjectKey ? ("on" as const) : ("off" as const),
            })),
          ]}
          onSelect={(id) => {
            if (id === "all") props.onProjectChange(null);
            else {
              const project = props.projects.find(
                (candidate) => JSON.stringify(candidate.key) === id,
              );
              if (project) props.onProjectChange(project.key);
            }
          }}
        />
        <ListFilterMenu
          label={props.hot ? "All Ages · hot" : threadAgeOption(props.selectedAge).label}
          disabled={props.hot}
          accessibilityHint={
            props.hot
              ? `Hot ignores age. ${threadAgeOption(props.selectedAge).label} will return when hot is off.`
              : undefined
          }
          accessibilityLabel="Filter threads by age"
          active={!props.hot && props.selectedAge !== "all"}
          actions={THREAD_AGE_OPTIONS.map((option) => ({
            id: option.id,
            title: option.label,
            state: option.id === props.selectedAge ? "on" : "off",
          }))}
          onSelect={(id) => {
            if (!props.hot && isThreadAge(id)) props.onAgeChange(id);
          }}
        />
        {props.selectedEnvironmentId !== null ||
        props.selectedProjectKey !== null ||
        (!props.hot && props.selectedAge !== "all") ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              props.hot ? "Reset environment and project filters" : "Reset thread filters"
            }
            className="h-8 w-8 items-center justify-center"
            onPress={() => {
              props.onEnvironmentChange(null);
              props.onProjectChange(null);
              if (!props.hot) props.onAgeChange("all");
            }}
          >
            <SymbolView name="xmark.circle.fill" size={18} tintColorClassName="accent-icon-muted" />
          </Pressable>
        ) : null}
      </ScrollView>
      {props.onHotChange ? (
        <View className="pl-1 pr-4 pb-2">
          <HotFilterButton hot={props.hot ?? false} onChange={props.onHotChange} />
        </View>
      ) : null}
    </View>
  );
}

export function HotFilterButton(props: {
  readonly hot: boolean;
  readonly onChange: (hot: boolean) => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Hot conversations"
      accessibilityHint="Shows actions, unread replies and agents at work, at any age"
      accessibilityState={{ selected: props.hot }}
      onPress={() => props.onChange(!props.hot)}
      className={cn(
        "h-11 w-11 shrink-0 rounded-full items-center justify-center border",
        props.hot ? "bg-primary border-primary" : "bg-subtle border-border",
      )}
      style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}
    >
      <Text
        maxFontSizeMultiplier={1.4}
        className={cn(
          "text-xs font-t3-bold",
          props.hot ? "text-primary-foreground" : "text-foreground-muted",
        )}
      >
        hot
      </Text>
    </Pressable>
  );
}
