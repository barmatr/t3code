import { uuidv4 } from "../../lib/uuid";
import { ThreadUndoNotice } from "./ThreadUndoNotice";
import { use } from "react";
import { NativePrimaryColumnContext } from "../../native/v5-workspace-context";
import * as Arr from "effect/Array";
import * as Order from "effect/Order";
import { useNavigation } from "@react-navigation/native";
import { useMemo, useState } from "react";
import { Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import {
  pickableProjectGroups,
  resolveScratchProjectScopeKey,
} from "@t3tools/client-runtime/state/project-grouping";

import { useProjects } from "../../state/entities";
import { environmentThreadShells } from "../../state/threads";
import { useLaunchingThreads, usePendingNewTasks } from "../../state/use-pending-new-tasks";
import { useWorkspaceState } from "../../state/workspace";
import { useSavedRemoteConnections } from "../../state/use-remote-environment-registry";
import {
  useAdaptiveWorkspaceLayout,
  useWorkspacePaneState,
} from "../layout/AdaptiveWorkspaceLayout";
import { AndroidHomeFabLayout } from "./AndroidHomeFab";
import { HomeScreen } from "./HomeScreen";
import { useHomeListOptions } from "./home-list-options";
import { useAtomValueWhileVisible, useHomeRouteVisible } from "./home-route-visibility";
import { buildHomeProjectScopes } from "./homeThreadList";
import { usePendingTaskListActions } from "./usePendingTaskListActions";
import { useThreadListActions } from "./useThreadListActions";
import { useWorkspaceTabs } from "../layout/workspace/WorkspaceTabsContext";
import { openSettings } from "../settings/settings-navigation";
import { useSelectWorkspaceTab } from "../layout/workspace/useSelectWorkspaceTab";
import { useSelectWorkspaceDetail } from "../layout/workspace/useSelectWorkspaceDetail";
import { WorkspaceListEmptyDetail } from "../layout/workspace/WorkspaceListEmptyDetail";
import { WorkspaceListHeader } from "../layout/workspace/WorkspaceListHeader";
import { buildHomeListFilterMenuItems } from "./home-list-filter-menu";
import { HotFilterButton } from "./ThreadListFilters";
import { AGENTS_PROJECT, isHomeTabProject, resolveAgentsProject } from "./agents-project";
import { scopedProjectKey } from "../../lib/scopedEntities";
import { EmptyState } from "../../components/ui/EmptyState";
import { ScreenContent } from "../../components/ui/ScreenContent";
import { NATIVE_LIQUID_GLASS_SUPPORTED } from "../../native/native-glass";

/** T4: `agents` renders the Agents tab, a fixed list of Direction agentique threads. */
export function HomeRouteScreen(props: { readonly agents?: boolean; readonly sidebar?: boolean }) {
  const insets = useSafeAreaInsets();
  const nativePrimaryColumn = use(NativePrimaryColumnContext);
  const { layout, setPrimarySidebarSearchQuery, startNewTask } = useAdaptiveWorkspaceLayout();
  const { primarySidebarSearchQuery } = useWorkspacePaneState();
  const selectDetail = useSelectWorkspaceDetail();
  const allProjects = useProjects();
  const agentsProject = resolveAgentsProject(allProjects);
  const projects = allProjects.filter((project) =>
    isHomeTabProject({ environmentId: project.environmentId, projectId: project.id }, props.agents),
  );
  // Stop rebuilding the streaming thread list while Thread covers Home.
  const visible = useHomeRouteVisible();
  const threads = useLaunchingThreads(
    useAtomValueWhileVisible(environmentThreadShells.navigationThreadShellsAtom, visible),
  ).filter((thread) => isHomeTabProject(thread, props.agents));
  const { environments: workspaceEnvironments, state: catalogState } = useWorkspaceState();
  const { savedConnectionsById } = useSavedRemoteConnections();
  const navigation = useNavigation();
  const selectTab = useSelectWorkspaceTab();
  const workspace = useWorkspaceTabs();
  const workspaceTab = props.agents ? "pullRequests" : "threads";
  const [localSearchQuery, setLocalSearchQuery] = useState("");
  const searchQuery =
    Platform.OS === "android" && !props.agents
      ? primarySidebarSearchQuery
      : (workspace?.state.tabs[workspaceTab].query ?? localSearchQuery);
  const setSearchQuery = (query: string) => {
    if (Platform.OS === "android" && !props.agents) setPrimarySidebarSearchQuery(query);
    else if (workspace) workspace.dispatch({ type: "query", query, tab: workspaceTab });
    else setLocalSearchQuery(query);
  };
  const handleSelectThread = (thread: EnvironmentThreadShell) =>
    selectDetail({
      name: "Thread",
      params: { environmentId: String(thread.environmentId), threadId: String(thread.id) },
    });
  const selectThreadRoute = (params: ReactNavigation.RootParamList["Thread"]) =>
    selectDetail({ name: "Thread", params });
  const handleNewThreadOnBranch = (thread: EnvironmentThreadShell) => {
    selectThreadRoute({
      draft: {
        requestId: uuidv4(),
        environmentId: String(thread.environmentId),
        projectId: String(thread.projectId),
        branch: thread.branch,
        worktreePath: thread.worktreePath,
      },
    });
  };

  const {
    archiveThread,
    confirmDeleteThread,
    settleThread,
    snoozeThread,
    unsnoozeThread,
    pinThread,
    unpinThread,
    setThreadAutoSettle,
    moveThread,
    renameThread,
    regenerateThreadTitle,
    unsettleThread,
  } = useThreadListActions();
  const pendingTasks = usePendingNewTasks().filter((task) => isHomeTabProject(task, props.agents));
  const { openPendingTask, confirmDeletePendingTask } =
    usePendingTaskListActions(selectThreadRoute);
  const connectionStateByEnvironmentId = new Map(
    workspaceEnvironments.map(
      (environment) => [environment.environmentId, environment.connectionState] as const,
    ),
  );
  const environments = Arr.sort(
    Object.values(savedConnectionsById)
      .filter(
        (connection) => !props.agents || connection.environmentId === AGENTS_PROJECT.environmentId,
      )
      .map((connection) => ({
        environmentId: connection.environmentId,
        label: connection.environmentLabel,
        connectionState:
          connectionStateByEnvironmentId.get(connection.environmentId) ?? "available",
      })),
    Order.mapInput(Order.String, (environment: { readonly label: string }) => environment.label),
  );
  const availableEnvironmentIds = useMemo(
    () => new Set(environments.map((environment) => environment.environmentId)),
    [environments],
  );
  const {
    options: listOptions,
    setSelectedEnvironmentId,
    setSelectedProjectKey,
    setSelectedAge,
    setHot,
    setAgentsHot,
  } = useHomeListOptions(availableEnvironmentIds);
  const hot = props.agents ? listOptions.agentsHot : listOptions.hot;
  const onHotChange = props.agents ? setAgentsHot : setHot;
  const selectedEnvironmentId = props.agents
    ? AGENTS_PROJECT.environmentId
    : listOptions.selectedEnvironmentId;
  const projectGroupingMode = props.agents ? "separate" : listOptions.projectGroupingMode;
  const selectedAge = props.agents ? "all" : listOptions.selectedAge;
  // A legacy per-environment scratch key resolves here on every render; the stored
  // value is only rewritten when the user picks a filter.
  const resolvedProjectKey = resolveScratchProjectScopeKey(
    listOptions.selectedProjectKey,
    projects,
    {
      sidebarProjectGroupingMode: listOptions.projectGroupingMode,
      sidebarProjectGroupingOverrides: {},
    },
  );
  const projectFilterOptions = pickableProjectGroups(
    buildHomeProjectScopes({
      projects,
      environmentId: selectedEnvironmentId,
      projectGroupingMode,
    }),
  ).map((scope) => ({
    key: scope.key,
    label: scope.title,
  }));
  const selectedProjectKey = props.agents
    ? scopedProjectKey(AGENTS_PROJECT.environmentId, AGENTS_PROJECT.projectId)
    : projectFilterOptions.some((project) => project.key === resolvedProjectKey)
      ? resolvedProjectKey
      : null;

  if (layout.usesSplitView && !nativePrimaryColumn && !props.sidebar) {
    return (
      <WorkspaceListEmptyDetail
        tab={workspaceTab}
        hasConnections={catalogState.hasConnections}
        onAddConnection={() => openSettings(navigation, "SettingsEnvironmentNew")}
        onStartNewTask={startNewTask}
      />
    );
  }

  return (
    <AndroidHomeFabLayout onStartNewTask={startNewTask}>
      <>
        <WorkspaceListHeader
          accessibilityLabel={props.agents ? "T4 Mobile, Agents" : "T4 Mobile, Threads"}
          workspaceTab={workspaceTab}
          hot={hot}
          onOpenEnvironments={() => openSettings(navigation, "SettingsEnvironments")}
          search={{
            value: searchQuery,
            onChangeText: setSearchQuery,
            placeholder: props.agents ? "Rechercher un agent" : "Search",
            accessibilityLabel: props.agents ? "Rechercher un agent" : "Search threads",
          }}
          filter={{
            customized:
              !props.agents &&
              (selectedEnvironmentId !== null ||
                selectedProjectKey !== null ||
                selectedAge !== "all"),
            // The Agents list has a fixed scope: no environment, project or age filter.
            items: props.agents
              ? []
              : buildHomeListFilterMenuItems({
                  environments,
                  projects: projectFilterOptions,
                  selectedEnvironmentId,
                  selectedProjectKey,
                  selectedAge,
                  hot,
                  onEnvironmentChange: setSelectedEnvironmentId,
                  onProjectChange: setSelectedProjectKey,
                  onAgeChange: setSelectedAge,
                }),
          }}
        />

        {props.agents && !agentsProject ? (
          <ScreenContent>
            {Platform.OS === "ios" ? (
              <View
                className="items-end px-5"
                style={{ paddingTop: (NATIVE_LIQUID_GLASS_SUPPORTED ? insets.top + 72 : 0) + 8 }}
              >
                <HotFilterButton hot={hot} onChange={onHotChange} />
              </View>
            ) : null}
            <View className="flex-1 justify-center px-8">
              <EmptyState
                title="Direction agentique indisponible"
                detail="Connecte le MacBook qui héberge Direction agentique pour retrouver tes agents."
                actionLabel="Connexions"
                onAction={() => openSettings(navigation, "SettingsEnvironments")}
              />
            </View>
          </ScreenContent>
        ) : (
          <HomeScreen
            fixedScope={props.agents ? AGENTS_PROJECT.title : undefined}
            workspaceTab={workspaceTab}
            catalogState={catalogState}
            environments={environments}
            onAddConnection={() => openSettings(navigation, "SettingsEnvironmentNew")}
            onArchiveThread={archiveThread}
            onDeleteThread={confirmDeleteThread}
            onSettleThread={settleThread}
            onSnoozeThread={snoozeThread}
            onUnsnoozeThread={unsnoozeThread}
            onUnsettleThread={unsettleThread}
            onPinThread={pinThread}
            onUnpinThread={unpinThread}
            onSetThreadAutoSettle={setThreadAutoSettle}
            onMoveThread={moveThread}
            onRenameThread={renameThread}
            onRegenerateThreadTitle={regenerateThreadTitle}
            onEnvironmentChange={setSelectedEnvironmentId}
            onProjectChange={setSelectedProjectKey}
            onAgeChange={setSelectedAge}
            onOpenSettings={() => selectTab("settings")}
            onSearchQueryChange={setSearchQuery}
            onSelectThread={handleSelectThread}
            onSelectPendingTask={openPendingTask}
            onDeletePendingTask={confirmDeletePendingTask}
            onNewThreadOnBranch={handleNewThreadOnBranch}
            onNewThreadInProject={(project) => {
              selectThreadRoute({
                draft: {
                  requestId: uuidv4(),
                  environmentId: String(project.environmentId),
                  projectId: String(project.id),
                  title: project.title,
                },
              });
            }}
            onStartNewTask={startNewTask}
            pendingTasks={pendingTasks}
            projectGroupingMode={projectGroupingMode}
            projects={projects}
            projectSortOrder={listOptions.projectSortOrder}
            savedConnectionsById={savedConnectionsById}
            searchQuery={searchQuery}
            selectedEnvironmentId={selectedEnvironmentId}
            selectedProjectKey={selectedProjectKey}
            hot={hot}
            onHotChange={onHotChange}
            selectedAge={selectedAge}
            threads={threads}
          />
        )}
        <ThreadUndoNotice visible={visible} />
      </>
    </AndroidHomeFabLayout>
  );
}
