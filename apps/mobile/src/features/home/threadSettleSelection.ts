import type { EnvironmentId } from "@t3tools/contracts";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";

import { scopedThreadKey } from "../../lib/scopedEntities";
import type { ThreadListV2ListItem } from "../threads/threadListV2";

/** T4 : what one project heading of the project view can settle. */
export interface ProjectSettleGroup {
  /** Listed threads under the heading, in environments that support settlement. */
  readonly threads: ReadonlyArray<EnvironmentThreadShell>;
  /** Every thread row under the heading, settleable or not. */
  readonly rowKeys: ReadonlySet<string>;
}

/**
 * T4 : groups the project view's rows by heading, keyed by the heading's list key.
 * Rows from the Settled section on are left out.
 */
export function settleGroupsByProjectHeader(
  items: ReadonlyArray<ThreadListV2ListItem>,
  settlementEnvironmentIds: ReadonlySet<EnvironmentId>,
): ReadonlyMap<string, ProjectSettleGroup> {
  const groups = new Map<string, { threads: EnvironmentThreadShell[]; rowKeys: Set<string> }>();
  let current: { threads: EnvironmentThreadShell[]; rowKeys: Set<string> } | null = null;
  for (const item of items) {
    if (item.type === "v2-settled-shelf") break;
    if (item.type === "v2-project-header") {
      current = { threads: [], rowKeys: new Set() };
      groups.set(item.key, current);
      continue;
    }
    if (current === null || item.type !== "v2-thread") continue;
    const thread = item.item.thread;
    const key = scopedThreadKey(thread.environmentId, thread.id);
    current.rowKeys.add(key);
    if (settlementEnvironmentIds.has(thread.environmentId)) current.threads.push(thread);
  }
  return groups;
}

/** Every selectable row starts checked; the selection keeps the rows the user unchecked. */
export function checkedThreadsForSettle(
  selectable: ReadonlyArray<EnvironmentThreadShell>,
  unchecked: ReadonlySet<string>,
): EnvironmentThreadShell[] {
  return selectable.filter(
    (thread) => !unchecked.has(scopedThreadKey(thread.environmentId, thread.id)),
  );
}
