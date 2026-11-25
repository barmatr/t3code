// T4 : alertes dans l'app. Ce module reste pur ; inAppAlerts.ts le branche sur l'état des fils.
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import { effectiveSnoozed } from "@t3tools/client-runtime/state/thread-settled";
import type { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { monitorHoldsWakeCompletion } from "@t3tools/shared/orchestrationV2PendingBackgroundWork";

import {
  resolveThreadListV2RowStatus,
  resolveThreadListV2Status,
  threadHasUnseenCompletion,
  type ThreadListV2Status,
} from "../threads/threadListV2";
import type { ThreadNotificationObservation } from "./inAppAlertGate";

export type InAppAlertAttentionKind = "approval" | "input" | "request" | "failed" | "limited";
export type InAppAlertKind = InAppAlertAttentionKind | "completion";
export type InAppAlertFamily = "attention" | "failure" | "completion";

export interface InAppAlert {
  readonly id: string;
  readonly environmentId: EnvironmentId;
  readonly threadId: ThreadId;
  readonly kind: InAppAlertKind;
  readonly threadTitle: string;
  /** The project's title, or the error for a failure. */
  readonly detail: string | null;
  readonly at: number;
}

export type InAppAlertBanner =
  | { readonly type: "single"; readonly alert: InAppAlert }
  | {
      readonly type: "group";
      readonly family: InAppAlertFamily;
      readonly alerts: ReadonlyArray<InAppAlert>;
    };

export interface InAppAlertSettings {
  readonly enabled: boolean;
  /** Approvals, questions and guest requests. */
  readonly attention: boolean;
  readonly completions: boolean;
  readonly failures: boolean;
  readonly haptics: boolean;
  readonly badge: boolean;
}

/** On by default in T4: Raoul asked for these alerts. T3 ships its desktop setting off. */
export const DEFAULT_IN_APP_ALERT_SETTINGS: InAppAlertSettings = {
  enabled: true,
  attention: true,
  completions: true,
  failures: true,
  haptics: true,
  badge: true,
};

export function resolveInAppAlertSettings(
  stored: Partial<InAppAlertSettings> | undefined,
): InAppAlertSettings {
  return { ...DEFAULT_IN_APP_ALERT_SETTINGS, ...stored };
}

const ATTENTION_STATUSES: ReadonlySet<ThreadListV2Status> = new Set([
  "approval",
  "input",
  "request",
  "failed",
  "limited",
]);

export function alertFamily(kind: InAppAlertKind): InAppAlertFamily {
  if (kind === "completion") return "completion";
  return kind === "failed" || kind === "limited" ? "failure" : "attention";
}

export function alertAllowed(kind: InAppAlertKind, settings: InAppAlertSettings): boolean {
  if (!settings.enabled) return false;
  const family = alertFamily(kind);
  return family === "attention"
    ? settings.attention
    : family === "failure"
      ? settings.failures
      : settings.completions;
}

export interface ThreadAlertObservation extends ThreadNotificationObservation {
  /** What the thread waits on, while it needs attention. */
  readonly kind: InAppAlertAttentionKind | null;
}

/** The request id comes from the thread's own pending request; a subagent's has none. */
function pendingRequestId(thread: EnvironmentThreadShell): string | null {
  const ownRequestId = thread.source.pendingRuntimeRequest?.id ?? null;
  if (thread.hasPendingApprovals) return ownRequestId;
  if (thread.pendingSubagentRequest === "approval") return null;
  if (thread.hasPendingUserInput) return ownRequestId;
  return null;
}

/** Mirrors observeThreads in T3's ThreadNotificationCoordinator.tsx. */
export function observeThreadForAlerts(thread: EnvironmentThreadShell): ThreadAlertObservation {
  let status = resolveThreadListV2Status(thread);
  if (status === "ready" && thread.latestRun?.status === "failed") status = "failed";
  const needsAttention = ATTENTION_STATUSES.has(status);
  const requestId = needsAttention ? pendingRequestId(thread) : null;
  // Queued messages become the latest run while a request stays pending, so a request with an
  // id is keyed by that id alone and announces once.
  const attention = !needsAttention
    ? null
    : requestId !== null
      ? `${status}:${requestId}`
      : `${thread.latestRun?.runId ?? ""}:${status}`;
  const completed = status === "ready" && thread.latestRun?.status === "completed";
  const settled = completed && !monitorHoldsWakeCompletion(thread.source);
  const parsedCompletedAt = Date.parse(thread.latestRun?.completedAt ?? "");
  const completedAt = Number.isFinite(parsedCompletedAt) ? parsedCompletedAt : null;
  return {
    kind: needsAttention ? (status as InAppAlertAttentionKind) : null,
    attention,
    requestId,
    settled,
    completedAt: settled ? completedAt : null,
    backgroundWake: thread.source.latestRunBackgroundWake === true,
  };
}

const FAMILY_ORDER: ReadonlyArray<InAppAlertFamily> = ["attention", "failure", "completion"];

/** A newer alert for a thread replaces the one still waiting. */
export function enqueueAlert(
  queue: ReadonlyArray<InAppAlert>,
  alert: InAppAlert,
): ReadonlyArray<InAppAlert> {
  return [...withoutThread(queue, alert.environmentId, alert.threadId), alert];
}

export function withoutThread(
  queue: ReadonlyArray<InAppAlert>,
  environmentId: EnvironmentId,
  threadId: ThreadId,
): ReadonlyArray<InAppAlert> {
  return queue.filter(
    (alert) => alert.environmentId !== environmentId || alert.threadId !== threadId,
  );
}

/**
 * The next banner shows the most urgent family first: what waits on the user, then failures,
 * then completions. Several alerts of that family share one banner.
 */
export function takeNextBanner(queue: ReadonlyArray<InAppAlert>): {
  readonly banner: InAppAlertBanner | null;
  readonly rest: ReadonlyArray<InAppAlert>;
} {
  for (const family of FAMILY_ORDER) {
    const alerts = queue.filter((alert) => alertFamily(alert.kind) === family);
    if (alerts.length === 0) continue;
    const rest = queue.filter((alert) => alertFamily(alert.kind) !== family);
    return alerts.length === 1
      ? { banner: { type: "single", alert: alerts[0]! }, rest }
      : { banner: { type: "group", family, alerts }, rest };
  }
  return { banner: null, rest: queue };
}

export function bannerShowsThread(
  banner: InAppAlertBanner,
  environmentId: EnvironmentId,
  threadId: ThreadId,
): boolean {
  const alerts = banner.type === "single" ? [banner.alert] : banner.alerts;
  return alerts.some(
    (alert) => alert.environmentId === environmentId && alert.threadId === threadId,
  );
}

/**
 * The Discussions tab badge: how many threads wait on the user, or an empty value, which
 * UIKit draws as a dot, when only unread completions remain.
 */
export function discussionsBadgeValue(
  threads: ReadonlyArray<EnvironmentThreadShell>,
  now: string,
): string | undefined {
  let waiting = 0;
  let unread = false;
  for (const thread of threads) {
    if (effectiveSnoozed(thread, { now })) continue;
    const status = resolveThreadListV2RowStatus(thread);
    if (ATTENTION_STATUSES.has(status)) waiting += 1;
    else if (status === "ready" && threadHasUnseenCompletion(thread)) unread = true;
  }
  if (waiting > 0) return waiting > 99 ? "99+" : String(waiting);
  return unread ? "" : undefined;
}
