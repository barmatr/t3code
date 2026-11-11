import type { EnvironmentProject } from "@t3tools/client-runtime/state/shell";
import { EnvironmentId, ProjectId } from "@t3tools/contracts";
import { expect, it } from "vite-plus/test";

import {
  AGENTS_PROJECT,
  isAgentsProject,
  isHomeTabProject,
  resolveAgentsProject,
} from "./agents-project";

it("keeps the Agents shortcut on its exact project and machine, including when unavailable", () => {
  const project: EnvironmentProject = {
    id: AGENTS_PROJECT.projectId,
    environmentId: AGENTS_PROJECT.environmentId,
    title: AGENTS_PROJECT.title,
    workspaceRoot: "/workspace/direction-agentique",
    repositoryIdentity: null,
    defaultModelSelection: null,
    scripts: [],
    createdAt: "2026-11-10T00:00:00.000Z",
    updatedAt: "2026-11-10T00:00:00.000Z",
  };
  const wrongMachine = { ...project, environmentId: EnvironmentId.make("another-machine") };
  const sameName = { ...project, id: ProjectId.make("another-project") };
  expect(resolveAgentsProject([wrongMachine, sameName, project])).toBe(project);
  expect(resolveAgentsProject([wrongMachine, sameName])).toBeNull();
  expect(resolveAgentsProject([])).toBeNull();
  const refs = [wrongMachine, sameName, project].map(({ environmentId, id }) => ({
    environmentId,
    projectId: id,
  }));
  // The same scope guard drives Chats' conversations, pending tasks and project picker.
  expect(refs.filter((ref) => isHomeTabProject(ref))).toEqual(refs.slice(0, 2));
  expect(refs.filter((ref) => isHomeTabProject(ref, true))).toEqual(refs.slice(2));
  expect(
    [wrongMachine, sameName, project]
      .map(({ environmentId, id }) => ({ environmentId, projectId: id }))
      .filter(isAgentsProject),
  ).toEqual([{ environmentId: project.environmentId, projectId: project.id }]);
});
