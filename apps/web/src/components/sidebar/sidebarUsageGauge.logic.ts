import type { ServerProviderUsageWindow } from "@t3tools/contracts";
import type { LimitAccount, LimitPresentations } from "@t3tools/shared/usageLimits";

export interface WeeklyUsageChip {
  readonly key: string;
  readonly driver: LimitAccount["driver"];
  readonly displayName: string | null;
  /** Null when the account's limits could not be read. */
  readonly usedPercent: number | null;
}

/** The account-wide weekly window; model-scoped ones (such as Claude's Fable-only week) only stand in when it is missing. */
function weeklyWindow(account: LimitAccount): ServerProviderUsageWindow | undefined {
  const weekly = account.limits.windows.filter((window) => window.kind === "weekly");
  return (
    weekly.find((window) => window.modelIds === undefined && window.providerIds === undefined) ??
    weekly.toSorted((left, right) => right.usedPercent - left.usedPercent)[0]
  );
}

/**
 * T4 sidebar: one chip per account, with the share of its week already used.
 * A week whose reset has passed counts as unused until the next probe. Accounts whose
 * limits could not be read keep a chip without a number, so a missing account is visible.
 */
export function weeklyUsageChips(
  accounts: readonly LimitAccount[],
  presentations: LimitPresentations,
  now: number,
): readonly WeeklyUsageChip[] {
  const chips: WeeklyUsageChip[] = accounts.flatMap((account) => {
    const window = weeklyWindow(account);
    if (!window) return [];
    const resetsAt = window.resetsAt === undefined ? Number.NaN : Date.parse(window.resetsAt);
    const used = Number.isFinite(resetsAt) && resetsAt <= now ? 0 : window.usedPercent;
    return [
      {
        key: account.key,
        driver: account.driver,
        displayName: account.displayName,
        usedPercent: Math.round(Math.max(0, Math.min(100, used))),
      },
    ];
  });
  const listed = new Set(accounts.map((account) => account.key));
  for (const [environmentId, presentation] of presentations) {
    for (const provider of presentation.serverConfig?.providers ?? []) {
      const key = `${environmentId}:${provider.instanceId}`;
      if (
        !provider.enabled ||
        !provider.installed ||
        provider.usageLimits?.unavailable?.reason !== "probeFailed" ||
        listed.has(key)
      ) {
        continue;
      }
      chips.push({
        key,
        driver: provider.driver,
        displayName: provider.displayName?.trim() || null,
        usedPercent: null,
      });
    }
  }
  // Group by provider so each account keeps its place whatever the probe order.
  return chips.toSorted(
    (left, right) =>
      String(left.driver).localeCompare(String(right.driver)) ||
      (left.displayName ?? "").localeCompare(right.displayName ?? ""),
  );
}
