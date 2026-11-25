import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import { EnvironmentId, RunId, ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { makeThreadShellFixture } from "../../test-fixtures";
import {
  alertAllowed,
  DEFAULT_IN_APP_ALERT_SETTINGS,
  discussionsBadgeValue,
  enqueueAlert,
  type InAppAlert,
  type InAppAlertKind,
  observeThreadForAlerts,
  resolveInAppAlertSettings,
  takeNextBanner,
  withoutThread,
} from "./inAppAlertModel";

const environmentId = EnvironmentId.make("environment-1");
const NOW = "2026-11-25T12:00:00.000Z";

function alert(threadId: string, kind: InAppAlertKind, at = 1): InAppAlert {
  return {
    id: `${threadId}:${kind}:${at}`,
    environmentId,
    threadId: ThreadId.make(threadId),
    kind,
    threadTitle: threadId,
    detail: null,
    at,
  };
}

function thread(overrides: Partial<EnvironmentThreadShell> = {}): EnvironmentThreadShell {
  return makeThreadShellFixture({
    environmentId,
    id: ThreadId.make("thread-1"),
    title: "Thread",
    runtime: null,
    ...overrides,
  });
}

function completedRun(completedAt = "2026-11-25T11:00:00.000Z") {
  return {
    runId: RunId.make("run-1"),
    status: "completed" as const,
    requestedAt: "2026-11-25T10:00:00.000Z",
    startedAt: "2026-11-25T10:00:00.000Z",
    completedAt,
    assistantMessageId: null,
  };
}

describe("in-app alert settings", () => {
  it("turns everything on until the user changes it", () => {
    expect(resolveInAppAlertSettings(undefined)).toEqual(DEFAULT_IN_APP_ALERT_SETTINGS);
    expect(resolveInAppAlertSettings({ completions: false }).completions).toBe(false);
    expect(resolveInAppAlertSettings({ completions: false }).attention).toBe(true);
  });

  it("filters each alert by its family and the main switch", () => {
    const settings = resolveInAppAlertSettings({ completions: false });
    expect(alertAllowed("approval", settings)).toBe(true);
    expect(alertAllowed("limited", settings)).toBe(true);
    expect(alertAllowed("completion", settings)).toBe(false);
    expect(alertAllowed("approval", resolveInAppAlertSettings({ enabled: false }))).toBe(false);
    expect(alertAllowed("failed", resolveInAppAlertSettings({ failures: false }))).toBe(false);
  });
});

describe("the alert queue", () => {
  it("keeps one alert per thread, the newest", () => {
    const queue = enqueueAlert([alert("a", "approval"), alert("b", "completion")], {
      ...alert("a", "completion", 2),
    });
    expect(queue.map((item) => `${item.threadId}:${item.kind}`)).toEqual([
      "b:completion",
      "a:completion",
    ]);
    expect(withoutThread(queue, environmentId, ThreadId.make("b"))).toHaveLength(1);
  });

  it("shows what waits on the user before failures and completions", () => {
    const { banner, rest } = takeNextBanner([
      alert("done", "completion"),
      alert("broken", "failed"),
      alert("ask", "input"),
    ]);
    expect(banner).toEqual({ type: "single", alert: alert("ask", "input") });
    expect(rest.map((item) => item.threadId)).toEqual(["done", "broken"]);
    expect(takeNextBanner(rest).banner).toEqual({
      type: "single",
      alert: alert("broken", "failed"),
    });
  });

  it("groups several alerts of the same family into one banner", () => {
    const { banner, rest } = takeNextBanner([
      alert("one", "completion"),
      alert("two", "completion"),
      alert("three", "limited"),
    ]);
    expect(banner).toEqual({ type: "single", alert: alert("three", "limited") });
    const next = takeNextBanner(rest);
    expect(next.banner?.type).toBe("group");
    expect(next.banner?.type === "group" ? next.banner.alerts.length : 0).toBe(2);
    expect(next.rest).toEqual([]);
    expect(takeNextBanner([]).banner).toBeNull();
  });
});

describe("observeThreadForAlerts", () => {
  it("reports an approval as attention, keyed by its run when it has no request id", () => {
    const observation = observeThreadForAlerts(thread({ hasPendingApprovals: true }));
    expect(observation.kind).toBe("approval");
    expect(observation.settled).toBe(false);
    expect(observation.requestId).toBeNull();
    expect(observation.attention).toBe(":approval");
  });

  it("reports a completed run with its completion time", () => {
    const observation = observeThreadForAlerts(thread({ latestRun: completedRun() }));
    expect(observation.kind).toBeNull();
    expect(observation.settled).toBe(true);
    expect(observation.completedAt).toBe(Date.parse("2026-11-25T11:00:00.000Z"));
  });

  it("treats a failed latest run as a failure even when the thread looks ready", () => {
    const observation = observeThreadForAlerts(
      thread({ latestRun: { ...completedRun(), status: "failed" } }),
    );
    expect(observation.kind).toBe("failed");
    expect(observation.attention).toBe("run-1:failed");
    expect(observation.settled).toBe(false);
  });
});

describe("discussionsBadgeValue", () => {
  it("counts the threads that wait on the user", () => {
    const threads = [
      thread({ id: ThreadId.make("a"), hasPendingApprovals: true }),
      thread({ id: ThreadId.make("b"), hasPendingUserInput: true }),
      thread({ id: ThreadId.make("c") }),
    ];
    expect(discussionsBadgeValue(threads, NOW)).toBe("2");
  });

  it("shows a dot when only an unread completion remains", () => {
    const threads = [
      thread({ latestRun: completedRun(), lastVisitedAt: "2026-11-25T10:30:00.000Z" }),
    ];
    expect(discussionsBadgeValue(threads, NOW)).toBe("");
  });

  it("shows nothing once the completion was read, or while its thread is snoozed", () => {
    expect(
      discussionsBadgeValue(
        [thread({ latestRun: completedRun(), lastVisitedAt: "2026-11-25T11:30:00.000Z" })],
        NOW,
      ),
    ).toBeUndefined();
    expect(
      discussionsBadgeValue(
        [
          thread({
            latestRun: completedRun("2026-11-25T11:30:00.000Z"),
            lastVisitedAt: "2026-11-25T10:30:00.000Z",
            snoozedAt: "2026-11-25T11:45:00.000Z",
            snoozedUntil: "2026-11-25T18:00:00.000Z",
          }),
        ],
        NOW,
      ),
    ).toBeUndefined();
  });

  it("caps the count", () => {
    const threads = Array.from({ length: 120 }, (_, index) =>
      thread({ id: ThreadId.make(`t-${index}`), hasPendingApprovals: true }),
    );
    expect(discussionsBadgeValue(threads, NOW)).toBe("99+");
  });
});
