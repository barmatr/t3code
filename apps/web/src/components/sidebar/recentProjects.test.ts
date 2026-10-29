import { describe, expect, it } from "vite-plus/test";

import {
  defaultScopeProjects,
  orderProjectScopeItems,
  recentProjectKeys,
  resolveProjectScopeSelection,
  threadActivity,
} from "./recentProjects";
import { projectSwitcherCandidates } from "../projectSwitcher/projectSwitcher.logic";

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

describe("project scope menu", () => {
  const items = ["all", "alpha", "beta", "gamma"].map((value) => ({ value, label: value }));
  const recentKeys = new Set(["gamma"]);

  it("keeps older projects collapsed by default with a selectable group row", () => {
    expect(orderProjectScopeItems(items, recentKeys)).toEqual([
      items[0],
      items[3],
      { value: "older", label: "Older projects" },
    ]);
  });

  it("expands older projects in their existing alphabetical order", () => {
    expect(orderProjectScopeItems(items, recentKeys, true).map((item) => item.value)).toEqual([
      "all",
      "gamma",
      "older",
      "alpha",
      "beta",
    ]);
  });

  it("omits the older group when every project is recent", () => {
    expect(orderProjectScopeItems(items, new Set(["alpha", "beta", "gamma"]))).toEqual(items);
  });

  it("preserves the all-projects fallback when none is recent", () => {
    expect(orderProjectScopeItems(items, new Set())).toEqual(items);
  });

  it("selects every older project exclusively for the sidebar and Option-Tab", () => {
    const selection = resolveProjectScopeSelection(
      ["gamma"],
      ["gamma", "older"],
      ["alpha", "beta"],
      false,
    );
    expect(selection).toEqual({ keys: ["alpha", "beta"], close: true });
    expect(
      projectSwitcherCandidates(
        ["alpha", "beta", "gamma"].map((projectKey) => ({ projectKey })),
        selection!.keys,
      ),
    ).toEqual([{ projectKey: "alpha" }, { projectKey: "beta" }]);
  });

  it("returns to the recent group without persisting a synthetic group key", () => {
    expect(
      resolveProjectScopeSelection(
        ["alpha", "beta"],
        ["alpha", "beta", "all"],
        ["alpha", "beta"],
        false,
      ),
    ).toEqual({ keys: [], close: true });
  });

  it("keeps plain clicks exclusive even on an already checked project", () => {
    expect(
      resolveProjectScopeSelection(["alpha", "beta"], ["beta"], ["alpha", "beta"], false),
    ).toEqual({ keys: ["alpha"], close: true });
  });

  it("keeps shift-click additive and the menu open", () => {
    expect(
      resolveProjectScopeSelection(["alpha"], ["alpha", "gamma"], ["alpha", "beta"], true),
    ).toEqual({ keys: ["alpha", "gamma"], close: false });
  });
});
