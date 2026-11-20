import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { AppActivityIndicator } from "../../components/ui/AppActivityIndicator";
import { SymbolView } from "../../components/ui/AppSymbol";
import { AppText } from "../../components/ui/AppText";
import { cn } from "../../lib/cn";

// Both states share one height so the heading keeps its size when selection opens.
const CONTROL_ROW_STYLE = { height: 28 } as const;

/**
 * T4 : a project heading's selection control. At rest, a round check beside the
 * project name; while that project is selecting, "Settle selection (N)" and a cancel cross.
 */
export function ProjectSettleSelectionControl(props: {
  readonly projectTitle: string;
  readonly selecting: boolean;
  /** Another project is selecting: this one waits. */
  readonly disabled: boolean;
  readonly checkedCount: number;
  readonly settling: boolean;
  readonly onStart: () => void;
  readonly onCancel: () => void;
  readonly onSettle: () => void;
}) {
  if (!props.selecting) {
    return (
      <View style={CONTROL_ROW_STYLE} className="justify-center">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Select threads to settle in ${props.projectTitle}`}
          accessibilityState={{ disabled: props.disabled }}
          disabled={props.disabled}
          hitSlop={10}
          onPress={props.onStart}
          className="active:opacity-60"
        >
          <SymbolView name="checkmark.circle" size={22} tintColorClassName="accent-icon-muted" />
        </Pressable>
      </View>
    );
  }
  const settleDisabled = props.checkedCount === 0 || props.settling;
  return (
    <View style={CONTROL_ROW_STYLE} className="flex-row items-center gap-1">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Settle selection (${props.checkedCount})`}
        accessibilityState={{ disabled: settleDisabled, busy: props.settling }}
        disabled={settleDisabled}
        hitSlop={8}
        onPress={props.onSettle}
        style={CONTROL_ROW_STYLE}
        className={cn(
          "flex-row items-center gap-1.5 rounded-full px-3 active:opacity-70",
          settleDisabled && !props.settling ? "bg-subtle-strong" : "bg-primary",
        )}
      >
        {props.settling ? (
          <AppActivityIndicator colorClassName="accent-primary-foreground" />
        ) : null}
        <AppText
          numberOfLines={1}
          className={cn(
            "text-xs font-t3-bold",
            settleDisabled && !props.settling ? "text-foreground-muted" : "text-primary-foreground",
          )}
        >
          {`Settle selection (${props.checkedCount})`}
        </AppText>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Cancel selection"
        disabled={props.settling}
        hitSlop={10}
        onPress={props.onCancel}
        className="p-1 active:opacity-60"
      >
        <SymbolView name="xmark" size={16} tintColorClassName="accent-icon-muted" />
      </Pressable>
    </View>
  );
}

/** T4 : a row in selection mode; a tap toggles its check instead of opening it. */
export function ThreadSettleSelectionRow(props: {
  readonly checked: boolean;
  readonly title: string;
  readonly onToggle: () => void;
  readonly children: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={props.title}
      accessibilityState={{ checked: props.checked }}
      onPress={props.onToggle}
      className="flex-row items-center"
    >
      <View className="items-center justify-center pl-3" style={{ width: 40 }}>
        <SymbolView
          name={props.checked ? "checkmark.circle.fill" : "circle"}
          size={22}
          tintColorClassName={props.checked ? "accent-primary" : "accent-icon-muted"}
        />
      </View>
      <View className="min-w-0 flex-1" pointerEvents="none">
        {props.children}
      </View>
    </Pressable>
  );
}

/** T4 : a row of another project while one project is selecting: dimmed and inert. */
export function ThreadSettleInactiveRow(props: { readonly children: ReactNode }) {
  return (
    <View style={{ opacity: 0.4 }} pointerEvents="none">
      {props.children}
    </View>
  );
}
