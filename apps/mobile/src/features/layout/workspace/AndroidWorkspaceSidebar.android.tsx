import { useAndroidFloatingTabs } from "../../settings/appearance/AppearancePreferencesProvider";
import { WorkspaceNoTabs } from "./WorkspaceNoTabs";
import { useEnabledNavigationTabs } from "./navigation-tabs";
import { NAVIGATION_TAB_ORDER } from "./navigation-tab-order";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAndroidControlSizing } from "../../../components/ui/useAndroidControlSizing";
import { FLOATING_TABS } from "./floating-workspace-tabs";
import { View } from "react-native";
import { useNavigationState } from "@react-navigation/native";
import { HomeRouteScreen } from "../../home/HomeRouteScreen";
import { ScreenContent } from "../../../components/ui/ScreenContent";
import { ListSearchToolbar } from "./ListSearchToolbar.android";
import { IssuesScreen } from "../../issues/IssuesScreen";
import { selectedIssueKey } from "../../issues/issueParams";
import { AndroidHomeFabLayout } from "../../home/AndroidHomeFab";
import { useAdaptiveWorkspaceLayout } from "../adaptive-workspace-context";
import { useAndroidWorkspaceRoot } from "./AndroidWorkspaceTabsProvider";
import { WorkspaceTabsContext, useWorkspaceTabs } from "./WorkspaceTabsContext";
import { WorkspaceTabPanes } from "./WorkspaceTabPanes";
import { WorkspaceThreadSidebar } from "./WorkspaceThreadSidebar";
import { WorkspaceAppBarScope } from "../../../components/ui/WorkspaceAppBar.android";

/** The Home route in the sidebar column: the selected tab's list. */
export function AndroidWorkspaceSidebar() {
  const floatingTabsEnabled = useAndroidFloatingTabs();
  const workspace = useWorkspaceTabs()!;
  const enabled = useEnabledNavigationTabs();
  const insets = useSafeAreaInsets();
  const { fabSize } = useAndroidControlSizing();
  const { revealPrimarySidebar, startNewTask } = useAdaptiveWorkspaceLayout();
  const selectedIssue = useNavigationState(selectedIssueKey);
  // Settings and Usage cover the sidebar.
  const coveredByPage =
    (useAndroidWorkspaceRoot()?.settingsOpen ?? false) || workspace.state.selectedTab === "usage";
  const bottomClearance = floatingTabsEnabled
    ? insets.bottom + FLOATING_TABS.bottom + FLOATING_TABS.edge + fabSize
    : 16;
  const context = { ...workspace, bottomClearance };
  if (enabled.length === 0) return <WorkspaceNoTabs />;
  return (
    <WorkspaceAppBarScope>
      <WorkspaceTabPanes
        tabs={NAVIGATION_TAB_ORDER}
        selected={workspace.state.selectedTab}
        renderTab={(tab) =>
          tab === "threads" ? (
            <AndroidHomeFabLayout sidebar disabled={coveredByPage} onStartNewTask={startNewTask}>
              <WorkspaceThreadSidebar />
            </AndroidHomeFabLayout>
          ) : tab === "usage" ? (
            <View className="flex-1 bg-screen" />
          ) : tab === "issues" ? (
            <WorkspaceTabsContext value={context}>
              <IssuesScreen
                sidebar
                selectedIssueKey={selectedIssue}
                renderFrame={(filters, list) => (
                  <View className="flex-1 bg-header">
                    <ListSearchToolbar
                      tab="issues"
                      filters={filters}
                      onRequestVisibility={revealPrimarySidebar}
                    />
                    <ScreenContent insetHorizontal>{list}</ScreenContent>
                  </View>
                )}
              />
            </WorkspaceTabsContext>
          ) : (
            <WorkspaceTabsContext value={context}>
              <HomeRouteScreen agents sidebar />
            </WorkspaceTabsContext>
          )
        }
      />
    </WorkspaceAppBarScope>
  );
}
