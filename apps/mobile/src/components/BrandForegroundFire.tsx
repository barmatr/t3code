import { useIsFocused } from "@react-navigation/native";
import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";

import {
  subscribeAppForegroundReturn,
  useAppActive,
  useReduceMotionEnabled,
} from "../lib/appState";
import { BRAND_FIRE_BLEED, brandFocusFireHtml } from "./brandFocusFireHtml";

/** Touch-through Canvas, mounted only for a foreground burst or explicit visible hot mode. */
export function BrandForegroundFire(props: {
  readonly width: number;
  readonly height: number;
  readonly continuous?: boolean | undefined;
}) {
  const focused = useIsFocused();
  const active = useAppActive();
  const reduceMotion = useReduceMotionEnabled();
  const [burn, setBurn] = useState(0);
  const [failed, setFailed] = useState(false);
  const continuous = props.continuous === true;
  const [wasContinuous, setWasContinuous] = useState(continuous);
  const enabled = focused && active && !reduceMotion;
  const [wasEnabled, setWasEnabled] = useState(enabled);
  if (wasEnabled !== enabled || wasContinuous !== continuous) {
    if (!enabled || wasContinuous !== continuous) setBurn(0);
    setWasContinuous(continuous);
    setFailed(false);
    setWasEnabled(enabled);
    // A blurred or interrupted header must never replay an unfinished burst.
  }

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- subscribes to native foreground events without resetting their background history during the intermediate inactive state
  useEffect(() => {
    return subscribeAppForegroundReturn(() => {
      if (focused && !reduceMotion && !continuous) {
        setFailed(false);
        setBurn((value) => value + 1);
      }
    });
  }, [focused, reduceMotion, continuous]);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- bounds WebKit startup as well as rendering, including a crashed content process that never posts completion
  useEffect(() => {
    if (!burn || continuous) return;
    const timeout = setTimeout(() => setBurn(0), 3_000);
    return () => clearTimeout(timeout);
  }, [burn, continuous]);

  const source = useMemo(
    () => ({
      html: brandFocusFireHtml(props.width, props.height, continuous ? "continuous" : "burst"),
    }),
    [props.width, props.height, continuous],
  );
  const stop = () => {
    setBurn(0);
    setFailed(true);
  };
  if (!enabled || failed || (!continuous && !burn) || props.width <= 0 || props.height <= 0)
    return null;
  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        position: "absolute",
        left: -BRAND_FIRE_BLEED.side,
        top: -BRAND_FIRE_BLEED.top,
        width: props.width + 2 * BRAND_FIRE_BLEED.side,
        height: props.height + BRAND_FIRE_BLEED.top + BRAND_FIRE_BLEED.bottom,
      }}
    >
      <WebView
        key={continuous ? "continuous" : burn}
        source={source}
        originWhitelist={["about:blank"]}
        onShouldStartLoadWithRequest={(request) => request.url === "about:blank"}
        onMessage={stop}
        onError={stop}
        onContentProcessDidTerminate={stop}
        scrollEnabled={false}
        bounces={false}
        allowsLinkPreview={false}
        automaticallyAdjustContentInsets={false}
        contentInsetAdjustmentBehavior="never"
        style={{ flex: 1, backgroundColor: "transparent" }}
      />
    </View>
  );
}
