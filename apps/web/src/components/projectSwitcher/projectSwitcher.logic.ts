export function projectSwitcherCandidates<T extends { projectKey: string }>(
  projects: readonly T[],
  filterKeys: readonly string[],
): readonly T[] {
  return filterKeys.length === 0
    ? projects
    : projects.filter((project) => filterKeys.includes(project.projectKey));
}

export function advanceProjectSelection(
  keys: readonly string[],
  selected: string | null,
  direction: 1 | -1,
): string | null {
  if (keys.length === 0) return null;
  const index = selected === null ? -1 : keys.indexOf(selected);
  if (index < 0) return keys[direction === 1 ? 0 : keys.length - 1]!;
  return keys[(index + direction + keys.length) % keys.length]!;
}

export function resolveFocusedProject<T extends { projectKey: string }>(
  projects: readonly T[],
  filterKeys: readonly string[],
  focusedKey: string | null,
): T | null {
  return (
    projectSwitcherCandidates(projects, filterKeys).find(
      (project) => project.projectKey === focusedKey,
    ) ?? null
  );
}

export function rememberRecentProject(keys: readonly string[], key: string | null): string[] {
  return key === null ? [...keys] : [key, ...keys.filter((candidate) => candidate !== key)];
}

export function orderRecentProjects<T extends { projectKey: string }>(
  projects: readonly T[],
  recentKeys: readonly string[],
  activeKey: string | null,
): T[] {
  const byKey = new Map(projects.map((project) => [project.projectKey, project]));
  return [...new Set([...rememberRecentProject(recentKeys, activeKey), ...byKey.keys()])].flatMap(
    (key) => {
      const project = byKey.get(key);
      return project ? [project] : [];
    },
  );
}

type ProjectThread = {
  id: string;
  environmentId: string;
  projectId: string;
  updatedAt: string;
  archivedAt: string | null;
  deletedAt: string | null;
  lineage: { relationshipToParent: string | null };
};

export function latestProjectThread<T extends ProjectThread>(
  threads: readonly T[],
  projectRefs: readonly { environmentId: string; projectId: string }[],
): T | null {
  const members = new Set(projectRefs.map((ref) => `${ref.environmentId}:${ref.projectId}`));
  let latest: T | null = null;
  for (const thread of threads) {
    if (
      thread.archivedAt !== null ||
      thread.deletedAt !== null ||
      thread.lineage.relationshipToParent === "subagent" ||
      !members.has(`${thread.environmentId}:${thread.projectId}`)
    )
      continue;
    if (latest === null || Date.parse(thread.updatedAt) > Date.parse(latest.updatedAt)) {
      latest = thread;
    }
  }
  return latest;
}
