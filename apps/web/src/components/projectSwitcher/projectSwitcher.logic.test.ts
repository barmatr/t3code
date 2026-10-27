import { describe, expect, it } from "vite-plus/test";
import {
  advanceProjectSelection,
  latestProjectThread,
  orderRecentProjects,
  rememberRecentProject,
  projectSwitcherCandidates,
  resolveFocusedProject,
} from "./projectSwitcher.logic";

describe("project switcher", () => {
  const projects = [{ projectKey: "renolib" }, { projectKey: "miga" }, { projectKey: "athena" }];
  it("focus narrows the sidebar without narrowing the next switcher's candidates", () => {
    const filter = ["renolib", "athena"];
    const focused = resolveFocusedProject(projects, filter, "athena");
    expect(focused?.projectKey).toBe("athena");
    const keys = projectSwitcherCandidates(projects, filter).map((p) => p.projectKey);
    expect(keys).toEqual(["renolib", "athena"]);
    expect(advanceProjectSelection(keys, focused!.projectKey, 1)).toBe("renolib");
    expect(resolveFocusedProject(projects, filter, "miga")).toBeNull();
    expect(resolveFocusedProject(projects, filter, "deleted")).toBeNull();
    expect(resolveFocusedProject(projects, [], "miga")?.projectKey).toBe("miga");
  });
  it("cycles only through the saved filter without changing it", () => {
    const filter = ["renolib", "athena"];
    const keys = projectSwitcherCandidates(projects, filter).map((p) => p.projectKey);
    expect(advanceProjectSelection(keys, "renolib", 1)).toBe("athena");
    expect(advanceProjectSelection(keys, "athena", 1)).toBe("renolib");
    expect(advanceProjectSelection(keys, "renolib", -1)).toBe("athena");
    expect(filter).toEqual(["renolib", "athena"]);
  });
  it("uses all projects without a filter and starts at the appropriate end outside the list", () => {
    const keys = projectSwitcherCandidates(projects, []).map((p) => p.projectKey);
    expect(advanceProjectSelection(keys, null, 1)).toBe("renolib");
    expect(advanceProjectSelection(keys, "removed", -1)).toBe("athena");
  });
  it("does not expose other projects when a saved filter is temporarily unavailable", () => {
    expect(projectSwitcherCandidates(projects, ["offline"])).toEqual([]);
    expect(advanceProjectSelection([], null, 1)).toBeNull();
    expect(advanceProjectSelection(["renolib"], "renolib", -1)).toBe("renolib");
  });
});

describe("recent project switching", () => {
  const projects = ["a", "b", "c"].map((projectKey) => ({ projectKey }));
  it("alternates A/B on successive invocations and keeps other projects reachable", () => {
    let recent = rememberRecentProject([], "a");
    const fromA = orderRecentProjects(projects, recent, "a").map((p) => p.projectKey);
    expect(advanceProjectSelection(fromA, "a", 1)).toBe("b");
    recent = rememberRecentProject(recent, "b");
    const fromB = orderRecentProjects(projects, recent, "b").map((p) => p.projectKey);
    expect(fromB).toEqual(["b", "a", "c"]);
    expect(advanceProjectSelection(fromB, "b", 1)).toBe("a");
    expect(advanceProjectSelection(fromB, "a", 1)).toBe("c");
    recent = rememberRecentProject(recent, "a");
    expect(
      advanceProjectSelection(
        orderRecentProjects(projects, recent, "a").map((p) => p.projectKey),
        "a",
        1,
      ),
    ).toBe("b");
  });
  it("ignores removed/unselected projects and uses the manually opened project as current", () => {
    const recent = ["deleted", "b", "a"];
    expect(orderRecentProjects(projects, recent, "c").map((p) => p.projectKey)).toEqual([
      "c",
      "b",
      "a",
    ]);
    expect(
      orderRecentProjects([projects[0]!, projects[2]!], recent, "b").map((p) => p.projectKey),
    ).toEqual(["a", "c"]);
    expect(recent).toEqual(["deleted", "b", "a"]);
  });
});

describe("latest conversation in a project", () => {
  const thread = (id: string, updatedAt: string) => ({
    id,
    updatedAt,
    projectId: "project",
    environmentId: "local",
    archivedAt: null as string | null,
    deletedAt: null as string | null,
    lineage: { relationshipToParent: null as string | null },
  });
  const members = [{ projectId: "project", environmentId: "local" }];
  it("chooses the latest update, including ongoing or settled conversations", () => {
    const older = thread("older", "2026-10-26T10:00:00Z");
    const newest = thread("newest", "2026-10-26T10:02:00Z");
    expect(latestProjectThread([newest, older], members)?.id).toBe("newest");
    expect(latestProjectThread([older, newest], members)?.id).toBe("newest");
  });
  it("respects environment/project identity and excludes archives, deletions and subagents", () => {
    const visible = thread("visible", "2026-10-26T10:00:00Z");
    const newer = thread("hidden", "2026-10-26T11:00:00Z");
    const threads = [
      visible,
      { ...newer, environmentId: "remote" },
      { ...newer, projectId: "other" },
      { ...newer, archivedAt: newer.updatedAt },
      { ...newer, deletedAt: newer.updatedAt },
      { ...newer, lineage: { relationshipToParent: "subagent" } },
    ];
    expect(latestProjectThread(threads, members)?.id).toBe("visible");
    expect(
      latestProjectThread(threads, [...members, { projectId: "project", environmentId: "remote" }])
        ?.environmentId,
    ).toBe("remote");
    expect(latestProjectThread(threads, [])).toBeNull();
    expect(latestProjectThread([], members)).toBeNull();
  });
});
