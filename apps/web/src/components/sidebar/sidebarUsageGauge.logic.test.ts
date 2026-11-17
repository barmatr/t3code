import type { ServerProviderUsageWindow } from "@t3tools/contracts";
import type { LimitAccount, LimitPresentations } from "@t3tools/shared/usageLimits";
import { describe, expect, it } from "vite-plus/test";

import { weeklyUsageChips } from "./sidebarUsageGauge.logic";

const NOW = Date.parse("2026-11-17T12:00:00.000Z");
const NONE: LimitPresentations = new Map();

const account = (key: string, windows: ServerProviderUsageWindow[]) =>
  ({
    key,
    driver: "codex",
    displayName: "EMAX",
    limits: { checkedAt: "2026-11-17T11:59:00.000Z", windows },
  }) as unknown as LimitAccount;

const window = (overrides: Partial<ServerProviderUsageWindow>) =>
  ({
    id: "secondary",
    kind: "weekly",
    label: "Weekly",
    usedPercent: 60,
    resetsAt: "2026-11-20T00:00:00.000Z",
    ...overrides,
  }) as ServerProviderUsageWindow;

describe("weeklyUsageChips", () => {
  it("shows the account-wide weekly share used, ignoring session windows", () => {
    const chips = weeklyUsageChips(
      [account("a", [window({ id: "primary", kind: "session", usedPercent: 90 }), window({})])],
      NONE,
      NOW,
    );
    expect(chips.map((chip) => [chip.key, chip.usedPercent])).toEqual([["a", 60]]);
  });

  it("prefers the window that covers every model over a model-scoped week", () => {
    const chips = weeklyUsageChips(
      [
        account("a", [
          window({ id: "seven_day_fable", usedPercent: 95, modelIds: ["fable"] }),
          window({ id: "seven_day", usedPercent: 41.6 }),
        ]),
      ],
      NONE,
      NOW,
    );
    expect(chips[0]?.usedPercent).toBe(42);
  });

  it("counts a week past its reset as unused and skips accounts without a week", () => {
    const chips = weeklyUsageChips(
      [
        account("a", [window({ resetsAt: "2026-11-17T11:00:00.000Z" })]),
        account("b", [window({ kind: "session" })]),
      ],
      NONE,
      NOW,
    );
    expect(chips.map((chip) => [chip.key, chip.usedPercent])).toEqual([["a", 0]]);
  });

  it("keeps a chip without a number for an account whose limits could not be read", () => {
    const presentations = new Map([
      [
        "env",
        {
          entry: { target: { label: "Mac" } },
          serverConfig: {
            providers: [
              {
                instanceId: "claudeAgent",
                driver: "claudeAgent",
                displayName: "EMAX",
                enabled: true,
                installed: true,
                usageLimits: {
                  checkedAt: "2026-11-17T11:59:00.000Z",
                  windows: [],
                  unavailable: { reason: "probeFailed" },
                },
              },
              {
                instanceId: "codex",
                driver: "codex",
                displayName: "EMAX",
                enabled: true,
                installed: true,
              },
            ],
          },
        },
      ],
    ]) as unknown as LimitPresentations;
    const chips = weeklyUsageChips([account("env:codex", [window({})])], presentations, NOW);
    expect(chips.map((chip) => [chip.key, chip.driver, chip.usedPercent])).toEqual([
      ["env:claudeAgent", "claudeAgent", null],
      ["env:codex", "codex", 60],
    ]);
  });
});
