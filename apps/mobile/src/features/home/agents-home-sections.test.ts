import { CommandId, EnvironmentId, MessageId, ProjectId, ThreadId } from "@t3tools/contracts";
import { threadSearchMatchKey } from "@t3tools/client-runtime/state/thread-search";
import { expect, it } from "vite-plus/test";

import type { PendingNewTask } from "../../state/use-pending-new-tasks";
import { makeThreadShellFixture } from "../../test-fixtures";
import {
  buildThreadListV2Items,
  buildThreadListV2ListItems,
  groupThreadListV2ItemsByProject,
  sortFollowUpListItems,
} from "../threads/threadListV2";
import { AGENTS_PROJECT } from "./agents-project";
import { groupAgentsHomeItems, type HomeListItem } from "./agents-home-sections";

const { environmentId, projectId } = AGENTS_PROJECT;
const NOW = "2026-11-22T12:00:00.000Z";

function thread(
  id: string,
  title: string,
  overrides: Parameters<typeof makeThreadShellFixture>[0] = {},
) {
  return makeThreadShellFixture({
    id: ThreadId.make(id),
    title,
    environmentId,
    projectId,
    ...overrides,
  });
}

function homeList(
  threads: Parameters<typeof buildThreadListV2Items>[0]["threads"],
  options: Partial<Parameters<typeof buildThreadListV2Items>[0]> = {},
  pendingTasks: readonly PendingNewTask[] = [],
) {
  const layout = buildThreadListV2Items({
    threads,
    environmentId,
    projectRefs: [AGENTS_PROJECT],
    searchQuery: "",
    now: NOW,
    prioritizeFollowUp: true,
    ...options,
  });
  const items = sortFollowUpListItems(
    buildThreadListV2ListItems({
      ...layout,
      pendingTasks,
      snoozedShelfExpanded: options.snoozedShelfExpanded,
      settledShelfExpanded: options.settledShelfExpanded,
    }),
  );
  return { layout, items };
}

function labels(items: readonly HomeListItem[]) {
  return items.map((item) =>
    item.type === "v2-thread"
      ? item.item.thread.id
      : item.type === "v2-pending"
        ? item.pendingTask.key
        : item.key,
  );
}

it("groups by complete French role prefixes and includes Comité de direction", () => {
  const directors = [
    "Directeur technique — semaine du 16/11",
    "Directeur de cabinet",
    "Directeur financier",
    "Directeur commercial",
    "Comité de direction",
    "  DIRECTRICE technique",
    "Directeurs adjoints",
    "Directrices",
    "COMITE\u0301 DE DIRECTION — suivi",
  ];
  const agents = [
    "Agent d'entretien des disques",
    "Agent builder TMP",
    "Agent anti-oubli",
    "AGENTE — entretien",
    "Agents",
    "Agentes",
  ];
  const miscellaneous = [
    "Publication Slack — durcissement contre un agent malveillant",
    "Aiguilleur",
    "Chantier — vérification avant présentation",
    "Agentique",
    "Agenté",
    "Agent2",
    "Directeurial",
    "Comité de directions",
  ];
  const { items } = homeList(
    [directors, agents, miscellaneous].flatMap((titles, group) =>
      titles.map((title, index) => thread(`${index}-${group}`, title)),
    ),
  );
  expect(labels(groupAgentsHomeItems(items, true))).toEqual([
    "agents-section:directors",
    ...directors.map((_, index) => `${index}-0`),
    "agents-section:agents",
    ...agents.map((_, index) => `${index}-1`),
    "agents-section:miscellaneous",
    ...miscellaneous.map((_, index) => `${index}-2`),
  ]);
});

it("leaves Fils, other project scopes and project heading groups intact", () => {
  const first = thread("directeur", "Directeur technique");
  const { items } = homeList([first]);
  expect(groupAgentsHomeItems(items, false)).toBe(items);
  expect(labels(groupAgentsHomeItems(items, true))).toEqual([
    "agents-section:directors",
    "directeur",
  ]);

  for (const other of [
    thread("other-machine", "Agent", { environmentId: EnvironmentId.make("other") }),
    thread("other-project", "Agent", { projectId: ProjectId.make("other") }),
  ]) {
    const mixed = homeList([first, other], { environmentId: null, projectRefs: null }).items;
    expect(groupAgentsHomeItems(mixed, true)).toBe(mixed);
  }

  const grouped = groupThreadListV2ItemsByProject(items, [
    { key: "direction", title: AGENTS_PROJECT.title, projectRefs: [AGENTS_PROJECT] },
  ]);
  expect(groupAgentsHomeItems(grouped, true)).toBe(grouped);
});

it("keeps row states, priorities, drafts and the existing settled shelf and page", () => {
  const creation = { projectId, workspaceMode: "local" as const, branch: null, worktreePath: null };
  const pending: readonly PendingNewTask[] = [
    {
      kind: "draft",
      key: "draft",
      environmentId,
      projectId,
      projectTitle: undefined,
      projectCwd: undefined,
      title: "Agente en préparation",
      createdAt: NOW,
      draftKey: "new-task:draft",
      draft: { text: "Directrice mentionnée dans le brouillon", attachments: [] },
    },
    {
      kind: "pending",
      key: "queued",
      environmentId,
      projectId,
      projectTitle: undefined,
      projectCwd: undefined,
      branch: null,
      title: "Chantier en attente",
      createdAt: NOW,
      creation,
      message: {
        environmentId,
        threadId: ThreadId.make("pending-thread"),
        messageId: MessageId.make("pending-message"),
        commandId: CommandId.make("pending-command"),
        text: "Directeur mentionné dans le message",
        attachments: [],
        createdAt: NOW,
        creation,
      },
    },
  ];
  const threads = [
    thread("pinned", "Directeur de cabinet", { pinnedAt: NOW }),
    thread("input", "Directeur financier", { hasPendingUserInput: true }),
    thread("agent", "Agent builder TMP"),
    thread("paused", "Agent anti-oubli", {
      snoozedAt: NOW,
      snoozedUntil: "2026-11-23T12:00:00.000Z",
      hasPendingUserInput: true,
      pendingUserInputAt: NOW,
    }),
    thread("settled-a", "Directrice", { settledOverride: "settled", settledAt: NOW }),
    thread("settled-b", "Agent", { settledOverride: "settled", settledAt: NOW }),
  ];
  const { items, layout } = homeList(threads, { settledLimit: 1 }, pending);
  const grouped = groupAgentsHomeItems(items, true);
  const shelfStart = items.findIndex((item) => item.type === "v2-settled-shelf");
  expect(labels(grouped.slice(0, -2))).toEqual([
    "agents-section:directors",
    "input",
    "pinned",
    "agents-section:agents",
    "draft",
    "agent",
    "agents-section:miscellaneous",
    "queued",
    "agents-section:snoozed",
    "paused",
  ]);
  expect(layout.hiddenSettledCount).toBe(1);
  expect(grouped.slice(-2)).toEqual(items.slice(shelfStart));
  expect(grouped.at(-2)).toBe(items[shelfStart]);
  const rows = grouped.filter((item) => item.type !== "agents-section-header");
  expect(rows.map((item) => item.key).sort()).toEqual(items.map((item) => item.key).sort());
  for (const item of rows) {
    const original = items.find((candidate) => candidate.key === item.key);
    expect(item).toEqual({
      ...original,
      ...("showTrailingDivider" in item ? { showTrailingDivider: item.showTrailingDivider } : {}),
    });
  }
  expect(
    grouped.find((item) => item.type === "v2-thread" && item.item.thread.id === "pinned"),
  ).toMatchObject({ showTrailingDivider: false, item: { pinned: true } });
  const collapsed = groupAgentsHomeItems(
    homeList(threads, { settledLimit: 1, settledShelfExpanded: false }, pending).items,
    true,
  );
  expect(collapsed.at(-1)).toMatchObject({ type: "v2-settled-shelf", count: 2, expanded: false });
  const more = homeList(threads, { settledLimit: 2, now: "2026-11-23T12:00:00.000Z" }, pending);
  const afterWake = labels(groupAgentsHomeItems(more.items, true));
  expect(afterWake).not.toContain("agents-section:snoozed");
  expect(afterWake.indexOf("paused")).toBe(afterWake.indexOf("agents-section:agents") + 1);
  expect(afterWake.slice(-3)).toEqual(labels(more.items.slice(-3)));
  expect(more.layout.hiddenSettledCount).toBe(0);
});

it.each([false, true])(
  "keeps title and message search matches with HOT %s and excludes subagents",
  (hot) => {
    const titleMatch = thread("title-match", "Agent budget", { hasPendingApprovals: true });
    const contentMatch = thread("content-match", "Publication Slack", {
      hasPendingUserInput: true,
    });
    const hiddenChild = thread("child", "Directeur budget", {
      hasPendingApprovals: true,
      lineage: {
        rootThreadId: titleMatch.id,
        parentThreadId: titleMatch.id,
        relationshipToParent: "subagent",
      },
    });
    const coldMatch = thread("cold", "Agent suivi budget");
    const matchKey = threadSearchMatchKey({ environmentId, threadId: contentMatch.id });
    const { layout, items } = homeList([titleMatch, contentMatch, hiddenChild, coldMatch], {
      hot,
      searchQuery: "budget",
      matchedThreadKeys: new Set([matchKey]),
    });
    expect(layout.contentOnlyThreadKeys).toEqual(new Set([matchKey]));
    expect(labels(groupAgentsHomeItems(items, true))).toEqual([
      "agents-section:agents",
      "title-match",
      ...(hot ? [] : ["cold"]),
      "agents-section:miscellaneous",
      "content-match",
    ]);
  },
);
