import type { OlderSettledScope } from "@t3tools/client-runtime/state/threads";
import type { EnvironmentId } from "@t3tools/contracts";
import { useMemo, useSyncExternalStore } from "react";

import { scopedProjectKey } from "../../lib/scopedEntities";
import { useOlderSettledShelf, useOlderSettledShelfGrowth } from "../../state/olderSettledShelf";
import type { PendingNewTask } from "../../state/use-pending-new-tasks";
import {
  buildThreadListV2Items,
  buildThreadListV2ListItems,
  getThreadListV2OrderedSection,
  groupThreadListV2ItemsByProject,
  threadListInboxReturns,
  threadListV2LayoutTime,
  sortFollowUpListItems,
} from "./threadListV2";
import { computeThreadMoveAvailability } from "./threadOrder";
import type { ThreadAge } from "../../lib/thread-age";
import { useThreadAgeFilter } from "./use-thread-age-filter";

/**
 * Screens' select handlers read the content-only key set; a fresh one per list rebuild gave
 * every row a new handler whenever any thread shell changed. Keyed by a string, the set keeps
 * its identity until its keys change.
 */
function useKeySet(newlineSeparatedKeys: string): ReadonlySet<string> {
  return useMemo(
    () => new Set(newlineSeparatedKeys.length === 0 ? [] : newlineSeparatedKeys.split("\n")),
    [newlineSeparatedKeys],
  );
}

type LayoutInput = Parameters<typeof buildThreadListV2Items>[0];

/**
 * The React Compiler drops unread dependencies, so pass the expired-grace version through
 * this call to keep inbox updates tied to its subscription.
 */
function observeInbox(
  threads: Parameters<typeof threadListInboxReturns.observe>[0],
  _expiredGraceVersion: number,
) {
  return threadListInboxReturns.observe(threads);
}

/**
 * Shelf callbacks prevent compiler caching across the whole derivation, so each stage keeps
 * its own memo boundary to preserve the list's identity during unrelated navigation renders.
 */
export function useThreadListV2(input: {
  readonly threads: LayoutInput["threads"];
  readonly pendingTasks: ReadonlyArray<PendingNewTask>;
  readonly environmentId: EnvironmentId | null;
  readonly projectRefs: LayoutInput["projectRefs"];
  readonly searchQuery: string;
  /** Threads that match the search by content, keyed like `threadSearchMatchKey`. */
  readonly searchMatches: ReadonlyMap<string, unknown>;
  readonly settlementEnvironmentIds: ReadonlySet<EnvironmentId>;
  readonly snoozeEnvironmentIds: ReadonlySet<EnvironmentId>;
  readonly pinReorderEnvironmentIds: ReadonlySet<EnvironmentId>;
  readonly activeReorderEnvironmentIds: ReadonlySet<EnvironmentId>;
  readonly queuedThreadKeys: ReadonlySet<string>;
  readonly settledLimit: number;
  readonly now: string;
  readonly pendingOrder: LayoutInput["pendingOrder"];
  readonly shelfPreferencesLoaded: boolean;
  readonly workingShelfEnabled: boolean;
  readonly workingShelfExpanded: boolean;
  readonly snoozedShelfExpanded: boolean;
  readonly settledShelfExpanded: boolean;
  readonly selectedThreadKey: string | null;
  readonly age?: ThreadAge;
  readonly hot?: boolean;
  readonly prioritizeFollowUp?: boolean;
  readonly projectGroups?: Parameters<typeof groupThreadListV2ItemsByProject>[1];
}) {
  const { threads } = input;
  const effectiveAge = input.hot ? "all" : input.age;
  const ageFiltered = effectiveAge !== undefined && effectiveAge !== "all";
  const groupByProject =
    (ageFiltered || input.hot === true) &&
    input.projectRefs == null &&
    input.projectGroups !== undefined;
  const workingShelfEnabled =
    !input.prioritizeFollowUp && !ageFiltered && input.workingShelfEnabled;
  const ageCandidates = useMemo(() => {
    if (effectiveAge === undefined || effectiveAge === "all") return threads;
    const projectKeys =
      input.projectRefs == null
        ? null
        : new Set(
            input.projectRefs.map((ref) => scopedProjectKey(ref.environmentId, ref.projectId)),
          );
    return threads.filter(
      (thread) =>
        thread.archivedAt === null &&
        (input.environmentId === null || thread.environmentId === input.environmentId) &&
        (projectKeys === null ||
          projectKeys.has(scopedProjectKey(thread.environmentId, thread.projectId))),
    );
  }, [threads, effectiveAge, input.environmentId, input.projectRefs]);
  const ageFilter = useThreadAgeFilter(
    ageCandidates,
    effectiveAge ?? "all",
    input.pendingTasks.map((task) => task.createdAt),
  );
  const layoutTime = useMemo(
    () => threadListV2LayoutTime({ threads, now: input.now, searchQuery: input.searchQuery }),
    [threads, input.now, input.searchQuery],
  );
  // A thread can stop working when the threads change, or when its exit grace expires.
  const inboxVersion = useSyncExternalStore(
    threadListInboxReturns.subscribe,
    threadListInboxReturns.getSnapshot,
  );
  const inbox = useMemo(
    () => observeInbox(workingShelfEnabled ? threads : null, inboxVersion),
    [threads, workingShelfEnabled, inboxVersion],
  );
  // Compute move availability per section; per-row planning is quadratic.
  const moveAvailability = useMemo(() => {
    if (input.prioritizeFollowUp) return new Map();
    const sectionAvailability = (section: "pinned" | "active") =>
      computeThreadMoveAvailability({
        allThreads: threads,
        section,
        pendingOrder: input.pendingOrder,
        reorderableEnvironmentIds:
          section === "pinned" ? input.pinReorderEnvironmentIds : input.activeReorderEnvironmentIds,
        ordered: getThreadListV2OrderedSection({
          threads,
          section,
          pendingOrder: input.pendingOrder,
          now: layoutTime,
          settlementEnvironmentIds: input.settlementEnvironmentIds,
          snoozeEnvironmentIds: input.snoozeEnvironmentIds,
          queuedThreadKeys: input.queuedThreadKeys,
        }),
      });
    return new Map([
      ...sectionAvailability("pinned"),
      ...(workingShelfEnabled ? [] : sectionAvailability("active")),
    ]);
  }, [
    input.prioritizeFollowUp,
    threads,
    input.pendingOrder,
    input.pinReorderEnvironmentIds,
    input.activeReorderEnvironmentIds,
    layoutTime,
    input.settlementEnvironmentIds,
    input.snoozeEnvironmentIds,
    input.queuedThreadKeys,
    workingShelfEnabled,
  ]);
  // Older settled threads load in pages; the shelf lists them only as far as they are loaded.
  const scopes = useMemo(
    () =>
      olderSettledScopes({
        environmentId: input.environmentId,
        projectRefs: input.projectRefs,
        settlementEnvironmentIds: input.settlementEnvironmentIds,
      }),
    [input.environmentId, input.projectRefs, input.settlementEnvironmentIds],
  );
  const olderSettledShelf = useOlderSettledShelf({
    scopes,
    expanded:
      ageFiltered ||
      input.hot === true ||
      input.prioritizeFollowUp === true ||
      input.settledShelfExpanded,
    // A search lists only matches, so the shelf would page forever; loaded pages stay.
    visibleCount: input.searchQuery.trim().length === 0 ? input.settledLimit : 0,
  });
  const { isListed, unloadedCount } = olderSettledShelf;
  const layoutInput = useMemo(
    () => ({
      prioritizeFollowUp: input.prioritizeFollowUp,
      hot: input.hot,
      pendingOrder: input.pendingOrder,
      threads: threads.filter((thread) => thread.archivedAt === null),
      environmentId: input.environmentId,
      projectRefs: input.projectRefs,
      searchQuery: input.searchQuery,
      matchedThreadKeys: new Set(input.searchMatches.keys()),
      settlementEnvironmentIds: input.settlementEnvironmentIds,
      snoozeEnvironmentIds: input.snoozeEnvironmentIds,
      queuedThreadKeys: input.queuedThreadKeys,
      settledLimit: input.settledLimit,
      now: layoutTime,
      workingShelfEnabled,
      workingShelfExpanded: ageFiltered || input.workingShelfExpanded,
      inboxReturnAt: inbox.returnedAt,
      isWorking: inbox.isWorking,
      snoozedShelfExpanded: ageFiltered || input.snoozedShelfExpanded,
      settledShelfExpanded: ageFiltered || input.settledShelfExpanded,
      selectedThreadKey: input.selectedThreadKey,
      isListedSettled: isListed,
      unloadedSettledCount: unloadedCount(
        threads.filter(
          (thread) =>
            thread.archivedAt === null &&
            scopes.some(
              (scope) =>
                scope.environmentId === thread.environmentId &&
                (scope.projectIds === null || scope.projectIds.includes(thread.projectId)),
            ),
        ),
      ),
    }),
    [
      input.prioritizeFollowUp,
      input.hot,
      input.pendingOrder,
      threads,
      input.environmentId,
      input.projectRefs,
      input.searchQuery,
      input.searchMatches,
      input.settlementEnvironmentIds,
      input.snoozeEnvironmentIds,
      input.queuedThreadKeys,
      input.settledLimit,
      layoutTime,
      workingShelfEnabled,
      ageFiltered,
      input.workingShelfExpanded,
      inbox.returnedAt,
      inbox.isWorking,
      input.snoozedShelfExpanded,
      input.settledShelfExpanded,
      input.selectedThreadKey,
      isListed,
      unloadedCount,
      scopes,
    ],
  );
  const unfilteredLayout = useMemo(() => buildThreadListV2Items(layoutInput), [layoutInput]);
  const layout = useMemo(
    () =>
      effectiveAge === undefined || effectiveAge === "all"
        ? unfilteredLayout
        : buildThreadListV2Items({
            ...layoutInput,
            threads: ageFilter.threads,
            // Unloaded rows have not been checked for replies; do not count them as matches.
            unloadedSettledCount: 0,
          }),
    [effectiveAge, unfilteredLayout, layoutInput, ageFilter.threads],
  );
  // Fill the filtered list, even when a full page contains mostly old messages.
  // Wait for message dates before deciding that another page is needed.
  useOlderSettledShelfGrowth(
    ageFilter.pending || ageFilter.failed
      ? { ...olderSettledShelf, visibleCount: 0 }
      : olderSettledShelf,
    layout.listedSettledThreads,
  );
  const contentOnlyThreadKeys = useKeySet([...layout.contentOnlyThreadKeys].sort().join("\n"));
  const pendingTasks = useMemo(() => {
    const scopedProjectKeys =
      input.projectRefs == null
        ? null
        : new Set(
            input.projectRefs.map((ref) => scopedProjectKey(ref.environmentId, ref.projectId)),
          );
    const searchQuery = input.searchQuery.trim().toLocaleLowerCase();
    return input.pendingTasks.filter(
      (pendingTask) =>
        (input.environmentId === null || pendingTask.environmentId === input.environmentId) &&
        (ageFilter.cutoff === null ||
          (ageFilter.basis === "conversation_activity" &&
            Date.parse(pendingTask.createdAt) > ageFilter.cutoff)) &&
        (scopedProjectKeys === null ||
          scopedProjectKeys.has(
            scopedProjectKey(pendingTask.environmentId, pendingTask.projectId),
          )) &&
        (searchQuery.length === 0 || pendingTask.title.toLocaleLowerCase().includes(searchQuery)),
    );
  }, [
    input.projectRefs,
    input.searchQuery,
    input.pendingTasks,
    input.environmentId,
    ageFilter.cutoff,
    ageFilter.basis,
  ]);
  const ungroupedItems = useMemo(
    () =>
      buildThreadListV2ListItems({
        items: layout.items,
        pendingTasks,
        workingCount: layout.workingCount,
        workingShelfExpanded: input.workingShelfExpanded,
        workingShelfHeaderIndex: layout.workingShelfHeaderIndex,
        snoozedCount: layout.snoozedCount,
        snoozedShelfExpanded: input.snoozedShelfExpanded,
        snoozedShelfHeaderIndex: layout.snoozedShelfHeaderIndex,
        settledCount: layout.settledCount,
        settledShelfExpanded: input.settledShelfExpanded,
        settledShelfHeaderIndex: layout.settledShelfHeaderIndex,
        snoozeLabelNow: `${input.now.slice(0, 16)}:00.000Z`,
        snoozeEnvironmentIds: input.snoozeEnvironmentIds,
        queuedThreadKeys: input.queuedThreadKeys,
        moveAvailability,
        shelfPreferencesLoading: !input.shelfPreferencesLoaded,
      }),
    [
      layout,
      pendingTasks,
      input.workingShelfExpanded,
      input.snoozedShelfExpanded,
      input.settledShelfExpanded,
      input.now,
      input.snoozeEnvironmentIds,
      input.queuedThreadKeys,
      moveAvailability,
      input.shelfPreferencesLoaded,
    ],
  );
  const items = useMemo(() => {
    const orderedItems = input.prioritizeFollowUp
      ? sortFollowUpListItems(ungroupedItems)
      : ungroupedItems;
    if (groupByProject)
      return groupThreadListV2ItemsByProject(
        orderedItems,
        input.projectGroups ?? [],
        input.prioritizeFollowUp,
      );
    // An age filter is a result list, independent of collapsed status shelves.
    return ageFiltered
      ? orderedItems.filter((item) => item.type === "v2-thread" || item.type === "v2-pending")
      : orderedItems;
  }, [input.prioritizeFollowUp, ageFiltered, groupByProject, ungroupedItems, input.projectGroups]);
  return {
    layout,
    items,
    projectGrouped: groupByProject,
    ageFiltered,
    contentOnlyThreadKeys,
    olderSettledShelf,
    ageFilter,
    hasUncheckedOlderThreads:
      (ageFiltered || input.hot === true) &&
      [...olderSettledShelf.environments.values()].some(
        ({ older, pages }) => older !== null && pages.frontier !== null,
      ),
  };
}

/** The list's scope per environment: its projects there, or every project. */
function olderSettledScopes(input: {
  readonly environmentId: EnvironmentId | null;
  readonly projectRefs: LayoutInput["projectRefs"];
  readonly settlementEnvironmentIds: ReadonlySet<EnvironmentId>;
}): ReadonlyArray<OlderSettledScope> {
  const environmentIds =
    input.environmentId === null ? [...input.settlementEnvironmentIds] : [input.environmentId];
  return environmentIds.flatMap((environmentId): ReadonlyArray<OlderSettledScope> => {
    if (input.projectRefs == null) return [{ environmentId, projectIds: null }];
    const projectIds = input.projectRefs.flatMap((ref) =>
      ref.environmentId === environmentId ? [ref.projectId] : [],
    );
    return projectIds.length === 0 ? [] : [{ environmentId, projectIds }];
  });
}
