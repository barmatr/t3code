import type { SidebarV2TopStatusKind } from "../Sidebar.logic";

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

type ProjectRef = { environmentId: string; projectId: string };

const memberKey = (ref: ProjectRef) => `${ref.environmentId}:${ref.projectId}`;

const isListedThread = (thread: ProjectThread) =>
  thread.archivedAt === null &&
  thread.deletedAt === null &&
  thread.lineage.relationshipToParent !== "subagent";

export function latestProjectThread<T extends ProjectThread>(
  threads: readonly T[],
  projectRefs: readonly ProjectRef[],
): T | null {
  const members = new Set(projectRefs.map(memberKey));
  let latest: T | null = null;
  for (const thread of threads) {
    if (!isListedThread(thread) || !members.has(memberKey(thread))) continue;
    if (latest === null || Date.parse(thread.updatedAt) > Date.parse(latest.updatedAt)) {
      latest = thread;
    }
  }
  return latest;
}

export type ThreadCounts = { input: number; working: number; done: number };

// Grouped as the sidebar rows read: anything waiting on the user, anything still busy, and
// finished turns not yet opened. Failed, limited and woke threads stay out of the counts.
const COUNTED_STATUS: Partial<Record<SidebarV2TopStatusKind, keyof ThreadCounts>> = {
  input: "input",
  approval: "input",
  request: "input",
  working: "working",
  waiting: "working",
  done: "done",
};

export function countProjectThreads<T extends ProjectThread>(
  threads: readonly T[],
  projects: readonly { projectKey: string; memberProjectRefs: readonly ProjectRef[] }[],
  topStatusOf: (thread: T) => SidebarV2TopStatusKind | null,
): ReadonlyMap<string, ThreadCounts> {
  const counts = new Map<string, ThreadCounts>();
  const projectKeyByMember = new Map<string, string>();
  for (const project of projects) {
    counts.set(project.projectKey, { input: 0, working: 0, done: 0 });
    for (const ref of project.memberProjectRefs) {
      projectKeyByMember.set(memberKey(ref), project.projectKey);
    }
  }
  for (const thread of threads) {
    const projectKey = projectKeyByMember.get(memberKey(thread));
    if (projectKey === undefined || !isListedThread(thread)) continue;
    const status = topStatusOf(thread);
    const counted = status === null ? undefined : COUNTED_STATUS[status];
    if (counted !== undefined) counts.get(projectKey)![counted] += 1;
  }
  return counts;
}

export function sumThreadCounts(counts: Iterable<ThreadCounts>): ThreadCounts {
  const total = { input: 0, working: 0, done: 0 };
  for (const count of counts) {
    total.input += count.input;
    total.working += count.working;
    total.done += count.done;
  }
  return total;
}
