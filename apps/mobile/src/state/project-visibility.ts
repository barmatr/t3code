import { useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/reactivity";
import { useMemo } from "react";
import { pickableProjectGroups } from "@t3tools/client-runtime/state/project-grouping";
import type { HomeProjectScope } from "../features/home/homeThreadList";
import { orderProjectScopes } from "./project-visibility.logic";

import { mobilePreferencesAtom } from "./preferences";

const NO_HIDDEN_PROJECTS: readonly string[] = [];

export function useHiddenProjectKeys(): ReadonlySet<string> {
  const preferences = useAtomValue(mobilePreferencesAtom);
  const keys = AsyncResult.isSuccess(preferences)
    ? (preferences.value.hiddenProjectKeys ?? NO_HIDDEN_PROJECTS)
    : NO_HIDDEN_PROJECTS;
  return useMemo(() => new Set(keys), [keys]);
}

export function useProjectPickerOrder(): readonly string[] {
  const preferences = useAtomValue(mobilePreferencesAtom);
  return AsyncResult.isSuccess(preferences)
    ? (preferences.value.projectPickerOrder ?? NO_HIDDEN_PROJECTS)
    : NO_HIDDEN_PROJECTS;
}

export function useProjectPickerScopes(scopes: ReadonlyArray<HomeProjectScope>) {
  const order = useProjectPickerOrder();
  return useMemo(() => orderProjectScopes(pickableProjectGroups(scopes), order), [scopes, order]);
}
