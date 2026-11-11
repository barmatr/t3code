import { ScreenScrollView as ScrollView } from "../../components/ui/ScreenScrollView";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import type { SidebarProjectGroupingMode } from "@t3tools/contracts";
import { AsyncResult } from "effect/reactivity";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SettingsScreen } from "./components/SettingsScreen";
import {
  mobileProjectGroupingModePatch,
  resolveMobileProjectGroupingSettings,
} from "../../state/project-grouping";
import { mobilePreferencesAtom, updateMobilePreferencesAtom } from "../../state/preferences";
import { ListChoiceRow as SettingsChoiceRow } from "../../components/ui/ListChoiceRow";
import { SettingsSection } from "./components/SettingsSection";
import { NewThreadSettingsSection, WorkingSectionSettings } from "./ThreadSettingsSections";
import type { ThreadAgeBasis } from "../../lib/thread-age";

const GROUPING_OPTIONS: ReadonlyArray<{
  readonly mode: SidebarProjectGroupingMode;
  readonly label: string;
  readonly description: string;
}> = [
  {
    mode: "repository",
    label: "Group by repository",
    description: "Matching repositories appear as one project.",
  },
  {
    mode: "repository_path",
    label: "Group by repository path",
    description: "Keep monorepo paths separate.",
  },
  {
    mode: "separate",
    label: "Keep separate",
    description: "Show every workspace as its own project.",
  },
];

export function SettingsProjectGroupingRouteScreen() {
  const insets = useSafeAreaInsets();
  const preferencesResult = useAtomValue(mobilePreferencesAtom);
  const savePreferences = useAtomSet(updateMobilePreferencesAtom);
  const preferencesReady = AsyncResult.isSuccess(preferencesResult) && !preferencesResult.waiting;
  const selectedMode = AsyncResult.isSuccess(preferencesResult)
    ? resolveMobileProjectGroupingSettings(preferencesResult.value).sidebarProjectGroupingMode
    : null;
  const ageBasis: ThreadAgeBasis = AsyncResult.isSuccess(preferencesResult)
    ? (preferencesResult.value.threadAgeBasis ?? "assistant_reply")
    : "assistant_reply";

  return (
    <SettingsScreen title="General">
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        className="flex-1"
        contentContainerClassName="gap-3 px-5 pt-4"
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 18) + 18 }}
      >
        <SettingsSection title="Project grouping">
          {GROUPING_OPTIONS.map((option, index) => (
            <SettingsChoiceRow
              key={option.mode}
              label={option.label}
              description={option.description}
              selected={selectedMode === option.mode}
              separated={index > 0}
              disabled={!preferencesReady}
              onPress={() => savePreferences(mobileProjectGroupingModePatch(option.mode))}
            />
          ))}
        </SettingsSection>
        <WorkingSectionSettings />
        <SettingsSection title="Age filter">
          <SettingsChoiceRow
            label="Last agent reply"
            description="Count from the agent’s last response. Your messages do not reset the age."
            selected={ageBasis === "assistant_reply"}
            disabled={!preferencesReady}
            onPress={() => savePreferences({ threadAgeBasis: "assistant_reply" })}
          />
          <SettingsChoiceRow
            label="Last conversation activity"
            description="Count from the latest message, including your own."
            selected={ageBasis === "conversation_activity"}
            separated
            disabled={!preferencesReady}
            onPress={() => savePreferences({ threadAgeBasis: "conversation_activity" })}
          />
        </SettingsSection>
        <NewThreadSettingsSection />
      </ScrollView>
    </SettingsScreen>
  );
}
