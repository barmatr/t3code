export const RECENT_PROJECT_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

export interface ProjectActivity {
  readonly environmentId: string;
  readonly projectId: string;
  readonly activityMs: number;
}

interface ActivityThread {
  readonly environmentId: string;
  readonly projectId: string;
  readonly latestUserMessageAt: string | null;
  readonly latestUserAuthoredMessageAt?: string | null | undefined;
  readonly archivedAt: string | null;
  readonly deletedAt: string | null;
  readonly lineage: { readonly relationshipToParent: string | null };
}

/**
 * Only the last message a human wrote dates a thread: snoozes, wakes, agent replies and settling do
 * not. `latestUserMessageAt` stands in only for servers that predate the authored timestamp.
 */
export function threadActivity(thread: ActivityThread): ProjectActivity | null {
  const at =
    thread.latestUserAuthoredMessageAt === undefined
      ? thread.latestUserMessageAt
      : thread.latestUserAuthoredMessageAt;
  if (
    at === null ||
    thread.archivedAt !== null ||
    thread.deletedAt !== null ||
    thread.lineage.relationshipToParent === "subagent"
  ) {
    return null;
  }
  return {
    environmentId: thread.environmentId,
    projectId: thread.projectId,
    activityMs: Date.parse(at),
  };
}

interface RecencyProject {
  readonly projectKey: string;
  readonly memberProjects: ReadonlyArray<{
    readonly environmentId: string;
    readonly id: string;
    readonly createdAt: string;
  }>;
}

/** Projects with a thread the user wrote in since `sinceMs`, or added since then. */
export function recentProjectKeys(
  projects: ReadonlyArray<RecencyProject>,
  activities: Iterable<ProjectActivity | null>,
  sinceMs: number,
): ReadonlySet<string> {
  const active = new Set<string>();
  for (const activity of activities) {
    if (activity !== null && activity.activityMs >= sinceMs) {
      active.add(`${activity.environmentId}:${activity.projectId}`);
    }
  }
  return new Set(
    projects
      .filter((project) =>
        project.memberProjects.some(
          (member) =>
            active.has(`${member.environmentId}:${member.id}`) ||
            Date.parse(member.createdAt) >= sinceMs,
        ),
      )
      .map((project) => project.projectKey),
  );
}

/**
 * What an empty project filter shows: the recent projects plus the open thread's, so opening an
 * older thread never hides it. Every project when none is recent, so the list is never empty.
 */
export function defaultScopeProjects<T extends { readonly projectKey: string }>(
  projects: ReadonlyArray<T>,
  recentKeys: ReadonlySet<string>,
  routeProjectKey: string | null,
): ReadonlyArray<T> {
  if (recentKeys.size === 0) return projects;
  return projects.filter(
    (project) => recentKeys.has(project.projectKey) || project.projectKey === routeProjectKey,
  );
}

export function projectKeyOf(
  projects: ReadonlyArray<{
    readonly projectKey: string;
    readonly memberProjectRefs: ReadonlyArray<{
      readonly environmentId: string;
      readonly projectId: string;
    }>;
  }>,
  ref: { readonly environmentId: string; readonly projectId: string } | null,
): string | null {
  if (ref === null) return null;
  return (
    projects.find((project) =>
      project.memberProjectRefs.some(
        (member) =>
          member.environmentId === ref.environmentId && member.projectId === ref.projectId,
      ),
    )?.projectKey ?? null
  );
}

export const OLDER_PROJECTS_SCOPE_VALUE = "older";

interface ProjectScopeItem {
  readonly value: string;
  readonly label: string;
}

export function orderProjectScopeItems(
  items: ReadonlyArray<ProjectScopeItem>,
  recentKeys: ReadonlySet<string>,
  olderProjectsExpanded = false,
): ReadonlyArray<ProjectScopeItem> {
  if (recentKeys.size === 0) return items;
  const isLeading = (item: ProjectScopeItem) => item.value === "all" || recentKeys.has(item.value);
  const older = items.filter((item) => !isLeading(item));
  return [
    ...items.filter(isLeading),
    ...(older.length > 0 ? [{ value: OLDER_PROJECTS_SCOPE_VALUE, label: "Older projects" }] : []),
    ...(olderProjectsExpanded ? older : []),
  ];
}

export function resolveProjectScopeSelection(
  currentKeys: ReadonlyArray<string>,
  nextValues: ReadonlyArray<string>,
  olderProjectKeys: ReadonlyArray<string>,
  additive: boolean,
): { readonly keys: ReadonlyArray<string>; readonly close: boolean } | null {
  if (nextValues.includes("all")) return { keys: [], close: true };
  if (nextValues.includes(OLDER_PROJECTS_SCOPE_VALUE)) {
    return { keys: olderProjectKeys, close: true };
  }
  if (additive) return { keys: nextValues, close: false };
  // Base UI toggles checked items too; a plain click must instead select that project alone.
  const pressedKey =
    nextValues.find((key) => !currentKeys.includes(key)) ??
    currentKeys.find((key) => !nextValues.includes(key));
  return pressedKey === undefined ? null : { keys: [pressedKey], close: true };
}
