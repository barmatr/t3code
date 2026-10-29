import { describe, expect, it } from "vite-plus/test";

import {
  defaultScopeProjects,
  orderProjectScopeItems,
  recentProjectKeys,
  threadActivity,
} from "./recentProjects";

const NOW = Date.parse("2026-10-29T12:00:00.000Z");
const SINCE = NOW - 14 * 24 * 60 * 60 * 1000;
const OLD = "2026-09-01T00:00:00.000Z";
const RECENT = "2026-10-25T00:00:00.000Z";

const project = (projectKey: string, createdAt = OLD) => ({
  projectKey,
  memberProjects: [{ environmentId: "env", id: projectKey, createdAt }],
});

const thread = (projectId: string, overrides: Partial<Parameters<typeof threadActivity>[0]>) =>
  threadActivity({
    environmentId: "env",
    projectId,
    latestUserMessageAt: null,
    archivedAt: null,
    deletedAt: null,
    lineage: { relationshipToParent: null },
    ...overrides,
  });

describe("recentProjectKeys", () => {
  it("dates a thread by its last human message only", () => {
    const keys = recentProjectKeys(
      [project("resumed"), project("woken"), project("untouched")],
      [
        thread("resumed", { latestUserMessageAt: RECENT, latestUserAuthoredMessageAt: RECENT }),
        // A snooze wake advances latestUserMessageAt without a human writing.
        thread("woken", { latestUserMessageAt: RECENT, latestUserAuthoredMessageAt: OLD }),
        thread("untouched", { latestUserMessageAt: RECENT, latestUserAuthoredMessageAt: null }),
      ],
      SINCE,
    );
    expect([...keys]).toEqual(["resumed"]);
  });

  it("ignores archived, deleted and subagent threads", () => {
    const keys = recentProjectKeys(
      [project("a"), project("b"), project("c")],
      [
        thread("a", { latestUserAuthoredMessageAt: RECENT, archivedAt: RECENT }),
        thread("b", { latestUserAuthoredMessageAt: RECENT, deletedAt: RECENT }),
        thread("c", {
          latestUserAuthoredMessageAt: RECENT,
          lineage: { relationshipToParent: "subagent" },
        }),
      ],
      SINCE,
    );
    expect(keys.size).toBe(0);
  });

  it("keeps a project added in the window recent before its first thread", () => {
    expect([...recentProjectKeys([project("new", RECENT)], [], SINCE)]).toEqual(["new"]);
  });
});

describe("defaultScopeProjects", () => {
  const projects = [{ projectKey: "a" }, { projectKey: "b" }, { projectKey: "c" }];

  it("keeps the open thread's older project visible", () => {
    expect(defaultScopeProjects(projects, new Set(["a"]), "c")).toEqual([
      { projectKey: "a" },
      { projectKey: "c" },
    ]);
  });

  it("shows every project when none is recent", () => {
    expect(defaultScopeProjects(projects, new Set(), null)).toEqual(projects);
  });
});

it("orders the filter menu as all, recent, then older projects", () => {
  const items = ["all", "alpha", "beta", "gamma"].map((value) => ({ value }));
  expect(orderProjectScopeItems(items, new Set(["gamma"])).map((item) => item.value)).toEqual([
    "all",
    "gamma",
    "alpha",
    "beta",
  ]);
});
