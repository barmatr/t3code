// T4 : pastille de l'onglet Discussions, tenue à jour par l'état des fils déjà chargé.
import { useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/reactivity";
import { Platform } from "react-native";

import { useNowMinuteMs } from "../../lib/clock";
import { mobilePreferencesAtom } from "../../state/preferences";
import { environmentThreadShells } from "../../state/threads";
import { discussionsBadgeValue, resolveInAppAlertSettings } from "./inAppAlertModel";

/** The tab item's badge: a count, a dot, or undefined for none. */
export function useDiscussionsBadge(): string | undefined {
  const preferences = useAtomValue(mobilePreferencesAtom);
  const threads = useAtomValue(environmentThreadShells.navigationThreadShellsAtom);
  // Snoozes end on the minute; the badge follows without a finer clock.
  const nowMs = useNowMinuteMs();
  const enabled = AsyncResult.isSuccess(preferences)
    ? resolveInAppAlertSettings(preferences.value.inAppAlerts).badge
    : true;
  if (!enabled) return undefined;
  const value = discussionsBadgeValue(threads, new Date(nowMs).toISOString());
  // react-native-screens drops an empty iOS badge; a space keeps UIKit's dot-like empty badge.
  return value === "" && Platform.OS === "ios" ? " " : value;
}
