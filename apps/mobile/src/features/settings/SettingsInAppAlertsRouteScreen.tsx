// T4 : réglages des alertes dans l'app (bandeau, vibration, pastille de l'onglet Discussions).
import { useAtomValue } from "@effect/atom-react";
import { useGT } from "gt-react-native";
import { AsyncResult } from "effect/reactivity";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText as Text } from "../../components/ui/AppText";
import { ScreenScrollView as ScrollView } from "../../components/ui/ScreenScrollView";
import type { InAppAlertPreferences } from "../../persistence/mobile-preferences";
import { mobilePreferencesAtom, saveMobilePreferences } from "../../state/preferences";
import { useAtomCommand } from "../../state/use-atom-command";
import {
  type InAppAlertSettings,
  resolveInAppAlertSettings,
} from "../in-app-alerts/inAppAlertModel";
import { SettingsScreen } from "./components/SettingsScreen";
import { SettingsSection } from "./components/SettingsSection";
import { SettingsSwitchRow } from "./components/SettingsSwitchRow";

export function SettingsInAppAlertsRouteScreen() {
  const gt = useGT();
  const insets = useSafeAreaInsets();
  const preferencesResult = useAtomValue(mobilePreferencesAtom);
  const savePreferences = useAtomCommand(saveMobilePreferences);
  const ready = AsyncResult.isSuccess(preferencesResult) && !preferencesResult.waiting;
  const settings: InAppAlertSettings | null = AsyncResult.isSuccess(preferencesResult)
    ? resolveInAppAlertSettings(preferencesResult.value.inAppAlerts)
    : null;

  const set = (key: keyof InAppAlertPreferences, value: boolean) => {
    void savePreferences({
      transform: (current) => ({ inAppAlerts: { ...current.inAppAlerts, [key]: value } }),
    });
  };
  const value = (key: keyof InAppAlertSettings) => (settings === null ? false : settings[key]);
  const bannerOff = !ready || !value("enabled");

  return (
    <SettingsScreen title={gt("In-app notifications")}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        className="flex-1"
        contentContainerClassName="gap-3 px-5 pt-4"
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 18) + 18 }}
      >
        <SettingsSection>
          <SettingsSwitchRow
            icon="bell.badge"
            label={gt("Show a banner")}
            subtitle={gt(
              "A banner slides in at the top when a thread needs you, while T4 is open.",
            )}
            value={value("enabled")}
            disabled={!ready}
            onValueChange={(next) => set("enabled", next)}
          />
        </SettingsSection>
        <SettingsSection title={gt("Announce")}>
          <SettingsSwitchRow
            icon="exclamationmark.shield"
            label={gt("Approvals and questions")}
            value={value("attention")}
            disabled={bannerOff}
            onValueChange={(next) => set("attention", next)}
          />
          <SettingsSwitchRow
            icon="checkmark.circle"
            label={gt("Finished turns")}
            value={value("completions")}
            disabled={bannerOff}
            onValueChange={(next) => set("completions", next)}
          />
          <SettingsSwitchRow
            icon="exclamationmark.circle"
            label={gt("Errors")}
            subtitle={gt("Failed threads and usage limits.")}
            value={value("failures")}
            disabled={bannerOff}
            onValueChange={(next) => set("failures", next)}
          />
        </SettingsSection>
        <SettingsSection>
          <SettingsSwitchRow
            icon={{ ios: "iphone.radiowaves.left.and.right", android: "smartphone" }}
            label={gt("Light vibration")}
            value={value("haptics")}
            disabled={bannerOff}
            onValueChange={(next) => set("haptics", next)}
          />
          <SettingsSwitchRow
            icon={{ ios: "app.badge", android: "chat_bubble" }}
            label={gt("Badge on Chats")}
            subtitle={gt(
              "Counts the threads waiting for you. A dot means a finished turn is still unread.",
            )}
            value={value("badge")}
            disabled={!ready}
            onValueChange={(next) => set("badge", next)}
          />
        </SettingsSection>
        <Text className="px-2 text-sm text-foreground-muted">
          {gt(
            "Alerts only show while T4 is open. What happens while it is closed waits at the top of Chats.",
          )}
        </Text>
      </ScrollView>
    </SettingsScreen>
  );
}
