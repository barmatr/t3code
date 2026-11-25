// T4 : bandeau d'alerte en haut de l'écran, au-dessus de tout (feuilles natives comprises).
import { useAtomValue } from "@effect/atom-react";
import * as Haptics from "expo-haptics";
import { AsyncResult } from "effect/reactivity";
import { useGT } from "gt-react-native";
import { useCallback, useEffect, useState } from "react";
import { AccessibilityInfo, Platform, Pressable, useWindowDimensions, View } from "react-native";
import {
  GestureDetector,
  GestureHandlerRootView,
  usePanGesture,
} from "react-native-gesture-handler";
import Animated, {
  Easing,
  type EntryAnimationsValues,
  FadeOut,
  ReduceMotion,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FullWindowOverlay } from "react-native-screens";

import { type AppSymbolName, SymbolView } from "../../components/ui/AppSymbol";
import { AppText } from "../../components/ui/AppText";
import { GlassSurface } from "../../components/ui/GlassSurface";
import { MOBILE_MOTION } from "../../lib/designTokens";
import { appAtomRegistry } from "../../state/atom-registry";
import { mobilePreferencesAtom } from "../../state/preferences";
import { dismissInAppAlert, inAppAlertsAtom, openInAppAlert } from "./inAppAlerts";
import {
  alertFamily,
  type InAppAlertBanner as Banner,
  type InAppAlertFamily,
  type InAppAlertKind,
  resolveInAppAlertSettings,
} from "./inAppAlertModel";

type Translate = ReturnType<typeof useGT>;

/** What waits on the user stays longer than a finished turn. */
const DURATION_MS: Record<InAppAlertFamily, number> = {
  attention: 8_000,
  failure: 8_000,
  completion: 5_000,
};
const MAX_WIDTH = 520;
const SWIPE_TIMING = { duration: 160, reduceMotion: ReduceMotion.System };
const ENTER_TIMING = {
  duration: MOBILE_MOTION.enter + 80,
  easing: Easing.out(Easing.cubic),
  reduceMotion: ReduceMotion.System,
};
const EXITING = FadeOut.duration(MOBILE_MOTION.exit).reduceMotion(ReduceMotion.System);

const KIND_STYLE: Record<InAppAlertKind, { readonly icon: AppSymbolName; readonly tint: string }> =
  {
    approval: { icon: "exclamationmark.shield", tint: "accent-warning-foreground" },
    input: { icon: "questionmark.bubble", tint: "accent-adaptive-indigo-600-300" },
    request: { icon: "person.crop.circle", tint: "accent-adaptive-fuchsia-600-300" },
    failed: { icon: "exclamationmark.circle", tint: "accent-danger-foreground" },
    limited: { icon: "exclamationmark.circle", tint: "accent-warning-foreground" },
    completion: { icon: "checkmark.circle", tint: "accent-adaptive-emerald-700-300" },
  };

const FAMILY_STYLE: Record<
  InAppAlertFamily,
  { readonly icon: AppSymbolName; readonly tint: string }
> = {
  attention: { icon: "bell.badge", tint: "accent-warning-foreground" },
  failure: { icon: "exclamationmark.circle", tint: "accent-danger-foreground" },
  completion: { icon: "checkmark.circle", tint: "accent-adaptive-emerald-700-300" },
};

function kindTitle(kind: InAppAlertKind, gt: Translate): string {
  switch (kind) {
    case "approval":
      return gt("Approval needed", { $context: "in-app banner title" });
    case "input":
      return gt("Answer needed", { $context: "in-app banner title, the agent asked a question" });
    case "request":
      return gt("Guest request", { $context: "in-app banner title" });
    case "failed":
      return gt("Thread failed", { $context: "in-app banner title" });
    case "limited":
      return gt("Usage limit reached", { $context: "in-app banner title" });
    case "completion":
      return gt("Thread finished", { $context: "in-app banner title, the agent's turn ended" });
  }
}

function groupTitle(family: InAppAlertFamily, count: number, gt: Translate): string {
  switch (family) {
    case "attention":
      return gt(
        "{count, plural, one {# thread is waiting for you} other {# threads are waiting for you}}",
        {
          count,
        },
      );
    case "failure":
      return gt("{count, plural, one {# thread failed} other {# threads failed}}", { count });
    case "completion":
      return gt("{count, plural, one {# thread finished} other {# threads finished}}", { count });
  }
}

interface BannerText {
  readonly icon: AppSymbolName;
  readonly tint: string;
  readonly title: string;
  readonly body: string;
  readonly detail: string | null;
  readonly action: string;
  readonly hint: string;
}

function bannerText(banner: Banner, gt: Translate): BannerText {
  if (banner.type === "single") {
    const { alert } = banner;
    return {
      ...KIND_STYLE[alert.kind],
      title: kindTitle(alert.kind, gt),
      body: alert.threadTitle,
      detail: alert.detail,
      action: gt("Open", { $context: "in-app banner button, opens the thread" }),
      hint: gt("Opens the thread"),
    };
  }
  return {
    ...FAMILY_STYLE[banner.family],
    title: groupTitle(banner.family, banner.alerts.length, gt),
    body: banner.alerts.map((alert) => alert.threadTitle).join(" · "),
    detail: null,
    action: gt("View", { $context: "in-app banner button, shows the waiting threads" }),
    hint: gt("Shows Chats"),
  };
}

function bannerFamily(banner: Banner): InAppAlertFamily {
  return banner.type === "single" ? alertFamily(banner.alert.kind) : banner.family;
}

/** Mounted once at the app's root; shows the alert the coordinator chose, if any. */
export function InAppAlertHost() {
  const state = useAtomValue(inAppAlertsAtom);
  if (state.banner === null) return null;
  const banner = <InAppAlertBannerView key={state.bannerId} banner={state.banner} />;
  return Platform.OS === "ios" ? <FullWindowOverlay>{banner}</FullWindowOverlay> : banner;
}

function InAppAlertBannerView(props: { readonly banner: Banner }) {
  const { banner } = props;
  const gt = useGT();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const preferences = useAtomValue(mobilePreferencesAtom);
  const haptics = AsyncResult.isSuccess(preferences)
    ? resolveInAppAlertSettings(preferences.value.inAppAlerts).haptics
    : true;
  const text = bannerText(banner, gt);
  const family = bannerFamily(banner);
  const translation = useSharedValue(0);

  const dismiss = () => dismissInAppAlert(appAtomRegistry);
  const open = () => openInAppAlert(appAtomRegistry, banner);
  // UIKit can skip glass on a moving host; like Toast, remount the surface once it has landed.
  const [glassReady, setGlassReady] = useState(Platform.OS !== "ios");
  const finishEntering = useCallback(() => setGlassReady(true), []);
  const entering = (values: EntryAnimationsValues) => {
    "worklet";
    return {
      initialValues: { originY: -(values.targetHeight + 12) },
      animations: { originY: withTiming(values.targetOriginY, ENTER_TIMING) },
      callback: (finished: boolean) => {
        if (finished) runOnJS(finishEntering)();
      },
    };
  };

  const announcement = `${text.title}. ${text.body}`;
  // The host keys each banner by its id, so this runs once per banner: the vibration setting is
  // the only input that can change while it shows, and toggling it just replays the cue.
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- each banner announces itself once, by vibration and to VoiceOver, then closes on its own after a while
  useEffect(() => {
    if (haptics) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    AccessibilityInfo.announceForAccessibility(announcement);
    const timer = setTimeout(() => dismissInAppAlert(appAtomRegistry), DURATION_MS[family]);
    return () => clearTimeout(timer);
  }, [announcement, family, haptics]);

  const gesture = usePanGesture({
    activeOffsetY: [-8, 8],
    failOffsetX: [-14, 14],
    onUpdate: (event) => {
      // Upward follows the finger; downward resists, so the banner never leaves its place.
      translation.set(event.translationY < 0 ? event.translationY : event.translationY * 0.15);
    },
    onDeactivate: (event) => {
      if (!event.canceled && (event.translationY < -24 || event.velocityY < -600)) {
        translation.set(
          withTiming(-200, SWIPE_TIMING, (finished) => {
            if (finished) runOnJS(dismiss)();
          }),
        );
      } else {
        translation.set(withTiming(0, SWIPE_TIMING));
      }
    },
  });
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translation.value }],
  }));

  const horizontal = Math.max(12, (width - MAX_WIDTH) / 2);
  return (
    <GestureHandlerRootView
      pointerEvents="box-none"
      style={{ position: "absolute", top: 0, left: 0, right: 0 }}
    >
      <Animated.View
        entering={entering}
        exiting={EXITING}
        pointerEvents="box-none"
        style={{ marginTop: insets.top + 6, marginHorizontal: horizontal }}
      >
        <GestureDetector gesture={gesture}>
          <Animated.View collapsable={false} style={animatedStyle}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                text.detail
                  ? `${text.title}. ${text.body}. ${text.detail}`
                  : `${text.title}. ${text.body}`
              }
              accessibilityHint={text.hint}
              accessibilityActions={[{ name: "dismiss", label: gt("Dismiss") }]}
              onAccessibilityAction={({ nativeEvent }) => {
                if (nativeEvent.actionName === "dismiss") dismiss();
              }}
              onAccessibilityEscape={dismiss}
              onPress={open}
              className="active:opacity-80"
            >
              <GlassSurface
                key={glassReady ? "settled" : "entering"}
                className="px-3.5 py-3"
                style={{ borderRadius: 24 }}
              >
                <View className="flex-row items-center gap-3">
                  <View className="size-9 items-center justify-center rounded-full bg-subtle">
                    <SymbolView name={text.icon} size={20} tintColorClassName={text.tint} />
                  </View>
                  <View className="min-w-0 flex-1">
                    <AppText
                      textRole="label"
                      className="font-t3-semibold text-foreground-muted"
                      numberOfLines={1}
                    >
                      {text.title}
                    </AppText>
                    <AppText textRole="footnote" className="font-t3-semibold" numberOfLines={1}>
                      {text.body}
                    </AppText>
                    {text.detail ? (
                      <AppText textRole="label" className="text-foreground-muted" numberOfLines={1}>
                        {text.detail}
                      </AppText>
                    ) : null}
                  </View>
                  <View className="rounded-full bg-subtle px-3 py-1.5">
                    <AppText textRole="label" className="font-t3-semibold text-foreground">
                      {text.action}
                    </AppText>
                  </View>
                </View>
              </GlassSurface>
            </Pressable>
          </Animated.View>
        </GestureDetector>
      </Animated.View>
    </GestureHandlerRootView>
  );
}
