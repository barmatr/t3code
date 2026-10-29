import { useAtomValue } from "@effect/atom-react";
import type { EnvironmentId } from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import { Atom } from "effect/reactivity";

import {
  RECENT_PROJECT_WINDOW_MS,
  recentProjectKeys,
  threadActivity,
  type ProjectActivity,
} from "../components/sidebar/recentProjects";
import type { SidebarProjectSnapshot } from "../sidebarProjectGrouping";
import { useQuietThreadShells } from "../state/entities";
import { useConnectedEnvironmentIds } from "../state/environments";
import { olderSettledThreads } from "../state/threads";
import { useNowMinute } from "./useNowMinute";

const HOUR_MS = 60 * 60 * 1000;
const MAX_OLDER_SETTLED_PAGES = 40;
const NO_ACTIVITY: ReadonlyArray<ProjectActivity> = [];

/**
 * Shells leave settled threads below a cut out. A human message unsettles a thread, so
 * reading pages until they settle before the window finds every recent one the shell omitted.
 */
const olderSettledActivityAtom = Atom.family((key: string) => {
  const [environmentIds, sinceMs] = JSON.parse(key) as [ReadonlyArray<EnvironmentId>, number];
  const since = new Date(sinceMs).toISOString();
  return Atom.make((get): ReadonlyArray<ProjectActivity> => {
    const activities: ProjectActivity[] = [];
    for (const environmentId of environmentIds) {
      const scope = { environmentId, projectIds: null };
      for (let pages = 0; pages <= MAX_OLDER_SETTLED_PAGES; pages += 1) {
        const read = get(olderSettledThreads.pagesAtom(scope, pages));
        const done =
          read.status !== "ready" || read.frontier === null || read.frontier.settledAt < since;
        if (!done && pages < MAX_OLDER_SETTLED_PAGES) continue;
        for (const page of read.reads) {
          for (const thread of page.threads) {
            const activity = threadActivity({
              environmentId,
              projectId: thread.projectId,
              latestUserMessageAt:
                thread.latestUserMessageAt === null
                  ? null
                  : DateTime.formatIso(thread.latestUserMessageAt),
              latestUserAuthoredMessageAt:
                thread.latestUserAuthoredMessageAt == null
                  ? thread.latestUserAuthoredMessageAt
                  : DateTime.formatIso(thread.latestUserAuthoredMessageAt),
              archivedAt: thread.archivedAt === null ? null : DateTime.formatIso(thread.archivedAt),
              deletedAt: thread.deletedAt === null ? null : DateTime.formatIso(thread.deletedAt),
              lineage: thread.lineage,
            });
            if (activity !== null) activities.push(activity);
          }
        }
        break;
      }
    }
    return activities.length === 0 ? NO_ACTIVITY : activities;
  }).pipe(Atom.withLabel(`recent-project-older-settled:${key}`));
});

/** Projects a human wrote in during the last two weeks, or added in that time. */
export function useRecentProjectKeys(
  projects: ReadonlyArray<SidebarProjectSnapshot>,
): ReadonlySet<string> {
  const threads = useQuietThreadShells();
  const environmentIds = useConnectedEnvironmentIds();
  // Hourly steps keep the page reads keyed stably while the window rolls.
  const sinceMs =
    Math.floor(Date.parse(`${useNowMinute()}Z`) / HOUR_MS) * HOUR_MS - RECENT_PROJECT_WINDOW_MS;
  const olderActivity = useAtomValue(
    olderSettledActivityAtom(JSON.stringify([[...environmentIds].sort(), sinceMs])),
  );
  return recentProjectKeys(projects, [...threads.map(threadActivity), ...olderActivity], sinceMs);
}
