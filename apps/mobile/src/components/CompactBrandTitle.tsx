import { NATIVE_WORKSPACE_COLUMNS_SUPPORTED } from "../native/NativeWorkspaceColumns";
import Constants from "expo-constants";
import { useState } from "react";
import { Platform, View } from "react-native";

import { AppText as Text } from "./ui/AppText";
import { T3Wordmark } from "./T3Wordmark";
import { BrandForegroundFire } from "./BrandForegroundFire";
import { IPAD_HOME_TITLE_OFFSET } from "../lib/layoutMetrics";
import { resolveMobileStageLabel } from "../lib/mobileBranding";
import { useAndroidControlSizing } from "./ui/useAndroidControlSizing";

const BRAND_MAX_FONT_SCALE = 1.4;

export function brandTitleOffset(): number {
  if (Platform.OS !== "ios") return 0;
  return Platform.isPad && !NATIVE_WORKSPACE_COLUMNS_SUPPORTED ? IPAD_HOME_TITLE_OFFSET : 0;
}

export function CompactBrandTitle(
  props: {
    readonly allowFontScaling?: boolean;
    readonly accessibilityLabel?: string;
    /** Fills the row and hides the stage badge when the full title does not fit. */
    readonly fit?: boolean;
    readonly continuousFire?: boolean | undefined;
  } = {},
) {
  const stageLabel = resolveMobileStageLabel(Constants.expoConfig?.extra?.appVariant);
  const titleOffset = brandTitleOffset();
  const { scale } = useAndroidControlSizing();
  const [availableWidth, setAvailableWidth] = useState<number | null>(null);
  // Measured only while the badge shows, so hiding it does not make it look like it fits.
  const [fullWidth, setFullWidth] = useState<number | null>(null);
  const [brandSize, setBrandSize] = useState({ width: 0, height: 0 });
  const showStage =
    !props.fit || availableWidth === null || fullWidth === null || fullWidth <= availableWidth;

  const title = (
    <View
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setBrandSize((previous) =>
          previous.width === width && previous.height === height ? previous : { width, height },
        );
        if (props.fit && showStage) setFullWidth(width);
      }}
      aria-level={1}
      accessibilityLabel={`${props.accessibilityLabel ?? "T4 Mobile, Threads"}${props.continuousFire ? ", hot" : ""}`}
      accessible
      role="heading"
      className="flex-row items-center gap-1.5"
      style={[
        { marginLeft: titleOffset },
        Platform.OS === "android" && { gap: 5.25 * scale },
        props.fit && { flexShrink: 0 },
      ]}
    >
      <T3Wordmark colorClassName="accent-icon" height={Math.round(15 * scale)} />
      {/* A logo beside a fixed-size wordmark: it may grow with Dynamic Type, not crowd the bar. */}
      <Text
        allowFontScaling={props.allowFontScaling}
        maxFontSizeMultiplier={BRAND_MAX_FONT_SCALE}
        className="font-t3-medium text-foreground-muted"
        style={{ fontSize: 21 * scale, letterSpacing: -0.5 * scale }}
      >
        Code
      </Text>
      {showStage ? (
        <View
          className={
            props.continuousFire
              ? "rounded-full bg-primary px-1.5 py-0.5"
              : "rounded-full bg-subtle px-1.5 py-0.5"
          }
          style={
            Platform.OS === "android"
              ? { paddingHorizontal: 5.25 * scale, paddingVertical: 1.75 * scale }
              : undefined
          }
        >
          <Text
            allowFontScaling={props.allowFontScaling}
            maxFontSizeMultiplier={BRAND_MAX_FONT_SCALE}
            className={
              props.continuousFire
                ? "font-t3-bold text-primary-foreground uppercase"
                : "font-t3-bold text-foreground-muted uppercase"
            }
            style={{ fontSize: 9 * scale, letterSpacing: 0.9 * scale }}
          >
            {props.continuousFire ? "hot" : stageLabel}
          </Text>
        </View>
      ) : null}
      {props.continuousFire ? (
        <View
          pointerEvents="none"
          accessible={false}
          className="absolute inset-0 rounded-lg border border-primary"
        />
      ) : null}
      <BrandForegroundFire
        width={brandSize.width}
        height={brandSize.height}
        continuous={props.continuousFire}
      />
    </View>
  );

  return props.fit ? (
    <View
      className="min-w-0 flex-1 flex-row items-center"
      onLayout={(event) => setAvailableWidth(event.nativeEvent.layout.width)}
    >
      {title}
    </View>
  ) : (
    title
  );
}
