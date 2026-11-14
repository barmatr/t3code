import { EnvironmentId, ProjectId } from "@t3tools/contracts";
import { expect, it } from "vite-plus/test";

import {
  moveProjectScope,
  orderProjectScopes,
  projectVisibilityPatch,
} from "./project-visibility.logic";

const local = EnvironmentId.make("local");
const remote = EnvironmentId.make("remote");
const a = {
  key: "repo:a",
  projectRefs: [
    { environmentId: local, projectId: ProjectId.make("a") },
    { environmentId: remote, projectId: ProjectId.make("a") },
  ],
};
const b = {
  key: "repo:b",
  projectRefs: [{ environmentId: local, projectId: ProjectId.make("b") }],
};
const c = {
  key: "repo:c",
  projectRefs: [{ environmentId: local, projectId: ProjectId.make("c") }],
};

it("keeps the default order, moves grouped copies together and appends new projects", () => {
  const scopes = [a, b];
  expect(orderProjectScopes(scopes, [])).toBe(scopes);
  const order = moveProjectScope(scopes, b.key, 0, ["offline:z"]);
  expect(order).toEqual(["local:b", "local:a", "remote:a", "offline:z"]);
  expect(orderProjectScopes([a, b, c], order)).toEqual([b, a, c]);
  expect(orderProjectScopes([a, c], order)).toEqual([a, c]);
  expect(orderProjectScopes([a, b, c], order)).toEqual([b, a, c]);
  expect(orderProjectScopes([a, b], ["remote:a", "local:b"])).toEqual([a, b]);
});

it.each(["repo:a", "local:a"])(
  "hides all copies and clears the selected %s filter without losing the order",
  (projectKey) => {
    const current = {
      hiddenProjectKeys: ["local:c"],
      projectPickerOrder: ["local:b", "local:a"],
      threadListFilters: { environmentId: null, projectKey, age: "1d" as const },
    };
    const hidden = { ...current, ...projectVisibilityPatch(current, a, false) };
    expect(hidden.hiddenProjectKeys).toEqual(["local:c", "local:a", "remote:a"]);
    expect(hidden.threadListFilters).toEqual({ environmentId: null, projectKey: null, age: "1d" });
    expect(hidden.projectPickerOrder).toEqual(current.projectPickerOrder);
    expect(projectVisibilityPatch(hidden, a, true)).toEqual({ hiddenProjectKeys: ["local:c"] });
    expect(projectVisibilityPatch(current, b, false).threadListFilters).toBeUndefined();
  },
);
