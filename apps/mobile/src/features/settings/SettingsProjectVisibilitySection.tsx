import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/reactivity";
import { useState } from "react";
import { Pressable, View } from "react-native";
import Reanimated, { ReduceMotion, useAnimatedStyle, withTiming } from "react-native-reanimated";

import { AppText as Text } from "../../components/ui/AppText";
import { SymbolView } from "../../components/ui/AppSymbol";
import { Button } from "../../components/ui/Button";
import { scopedProjectKey } from "../../lib/scopedEntities";
import { useProjects } from "../../state/entities";
import { mobilePreferencesAtom, updateMobilePreferencesAtom } from "../../state/preferences";
import { useMobileProjectGroupingSettings } from "../../state/project-grouping";
import { useHiddenProjectKeys, useProjectPickerScopes } from "../../state/project-visibility";
import { moveProjectScope, projectVisibilityPatch } from "../../state/project-visibility.logic";
import { buildHomeProjectScopes } from "../home/homeThreadList";
import { SettingsSection } from "./components/SettingsSection";
import { SettingsDragHandle } from "./components/SettingsDragHandle";

export function SettingsProjectVisibilitySection(props: {
  readonly onDraggingChange: (dragging: boolean) => void;
}) {
  const projects = useProjects();
  const grouping = useMobileProjectGroupingSettings();
  const scopes = useProjectPickerScopes(
    buildHomeProjectScopes({
      projects,
      environmentId: null,
      projectGroupingMode: grouping.sidebarProjectGroupingMode,
    }),
  );
  const hidden = useHiddenProjectKeys();
  const preferences = useAtomValue(mobilePreferencesAtom);
  const ready = AsyncResult.isSuccess(preferences) && !preferences.waiting;
  const save = useAtomSet(updateMobilePreferencesAtom);
  const [drag, setDrag] = useState<{ key: string; translation: number } | null>(null);
  const [heights, setHeights] = useState<ReadonlyMap<string, number>>(() => new Map());
  const [drops, setDrops] = useState(0);
  const move = (key: string, to: number) =>
    save({
      transform: (current) => ({
        projectPickerOrder: moveProjectScope(scopes, key, to, current.projectPickerOrder ?? []),
      }),
    });
  const dropIndex = (from: number, translation: number) => {
    const step = translation > 0 ? 1 : -1;
    let to = from;
    let remaining = Math.abs(translation);
    while (to + step >= 0 && to + step < scopes.length) {
      const height = heights.get(scopes[to + step]!.key) ?? 0;
      if (height === 0 || remaining < height / 2) break;
      remaining -= height;
      to += step;
    }
    return to;
  };
  const from = drag === null ? -1 : scopes.findIndex((scope) => scope.key === drag.key);
  const to = drag === null ? -1 : dropIndex(from, drag.translation);
  return (
    <SettingsSection
      title="Projets visibles et ordre"
      footer="Décochez un projet pour le masquer du menu et des conversations sur ce mobile. Faites glisser sa poignée pour changer l’ordre. Les nouveaux projets restent visibles."
    >
      {scopes.map((scope, index) => {
        const checked = scope.projectRefs.some(
          (ref) => !hidden.has(scopedProjectKey(ref.environmentId, ref.projectId)),
        );
        const height = drag === null ? 0 : (heights.get(drag.key) ?? 0);
        const shift =
          from < 0 || index === from
            ? 0
            : from < to && index > from && index <= to
              ? -height
              : from > to && index < from && index >= to
                ? height
                : 0;
        return (
          <ProjectVisibilityRow
            key={`${scope.key}:${drops}`}
            title={scope.title}
            checked={checked}
            ready={ready}
            lifted={index === from}
            offset={index === from ? (drag?.translation ?? 0) : shift}
            onHeight={(height) =>
              setHeights((current) =>
                current.get(scope.key) === height
                  ? current
                  : new Map(current).set(scope.key, height),
              )
            }
            onToggle={() =>
              save({ transform: (current) => projectVisibilityPatch(current, scope, !checked) })
            }
          >
            {ready ? (
              <SettingsDragHandle
                title={scope.title}
                canMoveUp={index > 0}
                canMoveDown={index < scopes.length - 1}
                onStart={() => {
                  setDrag({ key: scope.key, translation: 0 });
                  props.onDraggingChange(true);
                }}
                onMove={(translation) => setDrag({ key: scope.key, translation })}
                onEnd={(translation, cancelled) => {
                  setDrag(null);
                  props.onDraggingChange(false);
                  setDrops((count) => count + 1);
                  if (!cancelled) move(scope.key, dropIndex(index, translation));
                }}
                onStep={(direction) => move(scope.key, index + (direction === "up" ? -1 : 1))}
              />
            ) : null}
          </ProjectVisibilityRow>
        );
      })}
      {scopes.length === 0 ? (
        <Text className="px-4 py-3 text-foreground-muted">Aucun projet disponible.</Text>
      ) : null}
      <View className="flex-row flex-wrap gap-2 px-3 py-2">
        <Button
          label="Tout afficher"
          tone="text"
          disabled={!ready || hidden.size === 0}
          onPress={() => save({ hiddenProjectKeys: [] })}
        />
        <Button
          label="Ordre par défaut"
          tone="text"
          disabled={!ready}
          onPress={() => save({ projectPickerOrder: [] })}
        />
      </View>
    </SettingsSection>
  );
}

function ProjectVisibilityRow(props: {
  readonly title: string;
  readonly checked: boolean;
  readonly ready: boolean;
  readonly lifted: boolean;
  readonly offset: number;
  readonly onHeight: (height: number) => void;
  readonly onToggle: () => void;
  readonly children: React.ReactNode;
}) {
  const { lifted, offset } = props;
  const style = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: lifted
          ? offset
          : withTiming(offset, { duration: 160, reduceMotion: ReduceMotion.System }),
      },
    ],
    zIndex: lifted ? 1 : 0,
  }));
  return (
    <Reanimated.View
      style={style}
      onLayout={(event) => props.onHeight(event.nativeEvent.layout.height)}
      className="flex-row items-center bg-grouped-card"
    >
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={props.title}
        accessibilityState={{ checked: props.checked, disabled: !props.ready }}
        disabled={!props.ready}
        onPress={props.onToggle}
        className="min-h-14 min-w-0 flex-1 flex-row items-center gap-3 py-4 pl-4"
      >
        <SymbolView
          name={props.checked ? "checkmark.circle.fill" : "circle"}
          size={22}
          tintColorClassName="accent-icon"
        />
        <Text numberOfLines={2} className="min-w-0 flex-1">
          {props.title}
        </Text>
      </Pressable>
      {props.children}
    </Reanimated.View>
  );
}
