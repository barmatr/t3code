import { useIsFocused, useNavigationState } from "@react-navigation/native";
import Constants from "expo-constants";
import { useGT } from "gt-react-native";
import { use, useEffect, useState } from "react";
import { AppState } from "react-native";

import { ListRowLayout } from "../../components/ui/ListRowLayout";
import {
  NativePrimaryColumnContext,
  NativeWorkspaceTabActivityContext,
} from "../../native/v5-workspace-context";
import {
  amphetamineRefreshIntervalMs,
  createAmphetamineReader,
  readAmphetamineConfig,
  remainingAmphetamineSeconds,
  type AmphetamineSample,
} from "./amphetamine-status";

export const amphetamineSettingsConfig = readAmphetamineConfig(
  Constants.expoConfig?.extra?.amphetamineStatusOrigin,
  Constants.expoConfig?.extra?.amphetamineEnvironmentId,
);
const readStatus = amphetamineSettingsConfig
  ? createAmphetamineReader(amphetamineSettingsConfig)
  : null;

export function AmphetamineSettingsRow({ label }: { readonly label: string }) {
  const focused = useIsFocused();
  const settingsListOnTop = useNavigationState(
    (state) => state.routes[state.index]?.name === "Settings",
  );
  const primary = use(NativePrimaryColumnContext);
  const tabActive = use(NativeWorkspaceTabActivityContext)?.active ?? true;
  // On iOS Home can draw the list while the Settings route or its detail owns focus.
  const visible = tabActive && (focused || settingsListOnTop || primary?.presented === true);
  const gt = useGT();
  const [sample, setSample] = useState<AmphetamineSample | null>(null);
  const [now, setNow] = useState(Date.now);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- keeps the status timers and AppState listener tied to the visible list
  useEffect(() => {
    if (!visible || !readStatus) return;
    const read = readStatus;
    let cancelUpdates: (() => void) | undefined;
    const start = () => {
      if (cancelUpdates) return;
      let stopped = false;
      let refreshTimer: ReturnType<typeof setTimeout> | undefined;
      const clock = setInterval(() => setNow(Date.now()), 60_000);
      const refresh = () => {
        void read().then((next) => {
          if (stopped) return;
          setSample(next);
          setNow(Date.now());
          refreshTimer = setTimeout(
            refresh,
            Math.max(0, next.receivedAt + amphetamineRefreshIntervalMs - Date.now()),
          );
        });
      };
      cancelUpdates = () => {
        stopped = true;
        clearInterval(clock);
        clearTimeout(refreshTimer);
        cancelUpdates = undefined;
      };
      refresh();
    };
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") start();
      else cancelUpdates?.();
    });
    if (AppState.currentState === "active") start();

    return () => {
      listener.remove();
      cancelUpdates?.();
    };
  }, [visible]);

  const seconds = sample ? remainingAmphetamineSeconds(sample, now) : null;
  let value: string;
  switch (sample?.status.status) {
    case "timed": {
      const minutes = Math.ceil((seconds ?? 0) / 60);
      const hours = Math.floor(minutes / 60);
      value =
        seconds === 0
          ? gt("Estimated end reached")
          : hours > 0
            ? gt("{hours} h {minutes} min remaining", { hours, minutes: minutes % 60 })
            : gt("{minutes} min remaining", { minutes });
      break;
    }
    case "unlimited":
      value = gt("No time limit");
      break;
    case "trigger":
      value = gt("Started by a trigger");
      break;
    case "conditional":
      value = gt("Ends when its condition is met");
      break;
    case "inactive":
      value = gt("No active session");
      break;
    case "closed":
      value = gt("App closed");
      break;
    case "unavailable":
      value = gt("Status unavailable");
      break;
    default:
      value = gt("Checking…");
  }

  return <ListRowLayout icon="desktopcomputer" label={label} description={value} />;
}
