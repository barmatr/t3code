import type { EnvironmentProject } from "@t3tools/client-runtime/state/shell";
import { EnvironmentId, ProjectId } from "@t3tools/contracts";

export const AGENTS_PROJECT = {
  environmentId: EnvironmentId.make("0a16ae11-4b0b-47f1-851d-5c4272f6f64f"),
  projectId: ProjectId.make("mcp:849be1d4-c343-428a-946d-a411d3f33a54"),
  title: "Direction agentique",
};

export function isAgentsProject(ref: {
  readonly environmentId: EnvironmentId;
  readonly projectId: ProjectId;
}) {
  return (
    ref.environmentId === AGENTS_PROJECT.environmentId && ref.projectId === AGENTS_PROJECT.projectId
  );
}

export function resolveAgentsProject(projects: readonly EnvironmentProject[]) {
  return (
    projects.find((project) =>
      isAgentsProject({ environmentId: project.environmentId, projectId: project.id }),
    ) ?? null
  );
}

export function isHomeTabProject(
  ref: Parameters<typeof isAgentsProject>[0],
  agents = false,
): boolean {
  return isAgentsProject(ref) === agents;
}
