import type { ServerProviderUsageWindow } from "@t3tools/contracts";
import type { LimitAccount } from "@t3tools/shared/usageLimits";

export interface WeeklyUsageChip {
  readonly key: string;
  readonly account: LimitAccount;
  readonly usedPercent: number;
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
 * T4 sidebar: one chip per account that reports a weekly limit, with the share of that week already used.
 * A week whose reset has passed counts as unused until the next probe.
 */
export function weeklyUsageChips(
  accounts: readonly LimitAccount[],
  now: number,
): readonly WeeklyUsageChip[] {
  return accounts.flatMap((account) => {
    const window = weeklyWindow(account);
    if (!window) return [];
    const resetsAt = window.resetsAt === undefined ? Number.NaN : Date.parse(window.resetsAt);
    const used = Number.isFinite(resetsAt) && resetsAt <= now ? 0 : window.usedPercent;
    return [
      {
        key: account.key,
        account,
        usedPercent: Math.round(Math.max(0, Math.min(100, used))),
      },
    ];
  });
}
