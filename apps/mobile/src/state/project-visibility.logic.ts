import type { ScopedProjectRef } from "@t3tools/contracts";

import { scopedProjectKey } from "../lib/scopedEntities";
import type { Preferences } from "../persistence/mobile-preferences";

interface ProjectScope {
  readonly key: string;
  readonly projectRefs: ReadonlyArray<ScopedProjectRef>;
}

export function orderProjectScopes<T extends ProjectScope>(
  scopes: ReadonlyArray<T>,
  order: readonly string[],
): ReadonlyArray<T> {
  if (order.length === 0) return scopes;
  const positions = new Map(order.map((key, index) => [key, index]));
  const rank = (scope: T) =>
    Math.min(
      ...scope.projectRefs.map(
        (ref) => positions.get(scopedProjectKey(ref.environmentId, ref.projectId)) ?? Infinity,
      ),
    );
  return scopes
    .map((scope, index) => ({ scope, index, rank: rank(scope) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(({ scope }) => scope);
}

export function projectVisibilityPatch(
  current: Preferences,
  scope: ProjectScope,
  visible: boolean,
): Partial<Preferences> {
  const keys = scope.projectRefs.map((ref) => scopedProjectKey(ref.environmentId, ref.projectId));
  const hidden = new Set(current.hiddenProjectKeys);
  for (const key of keys) {
    if (visible) hidden.delete(key);
    else hidden.add(key);
  }
  const selected = current.threadListFilters?.projectKey;
  return {
    hiddenProjectKeys: [...hidden],
    ...(!visible &&
    selected != null &&
    (selected === scope.key || keys.includes(selected)) &&
    current.threadListFilters
      ? { threadListFilters: { ...current.threadListFilters, projectKey: null } }
      : {}),
  };
}

export function moveProjectScope(
  scopes: ReadonlyArray<ProjectScope>,
  key: string,
  to: number,
  previous: readonly string[],
): readonly string[] {
  const from = scopes.findIndex((scope) => scope.key === key);
  if (from < 0) return previous;
  const next = [...scopes];
  const [moved] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(next.length, to)), 0, moved!);
  const keys = next.flatMap((scope) =>
    scope.projectRefs.map((ref) => scopedProjectKey(ref.environmentId, ref.projectId)),
  );
  const known = new Set(keys);
  return [...keys, ...previous.filter((key) => !known.has(key))];
}
