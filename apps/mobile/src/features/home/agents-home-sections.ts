import {
  threadListV2ListItemsAreEqual,
  type ThreadListV2ListItem,
  type ThreadListV2PendingListItem,
  type ThreadListV2ThreadListItem,
} from "../threads/threadListV2";
import { isAgentsProject } from "./agents-project";

type AgentsHomeSection = "directors" | "agents" | "miscellaneous" | "snoozed";
type AgentsHomeRow = ThreadListV2ThreadListItem | ThreadListV2PendingListItem;

export type HomeListItem =
  | ThreadListV2ListItem
  | {
      readonly type: "agents-section-header";
      readonly key: `agents-section:${AgentsHomeSection}`;
      readonly section: AgentsHomeSection;
    };

const DIRECTOR_TITLE =
  /^(?:directeurs?|directrices?|comité\s+de\s+direction)(?![\p{L}\p{M}\p{N}\p{Pc}])/iu;
const AGENT_TITLE = /^agente?s?(?![\p{L}\p{M}\p{N}\p{Pc}])/iu;

function agentsHomeRole(title: string): Exclude<AgentsHomeSection, "snoozed"> {
  const start = title.trimStart().normalize("NFC");
  if (DIRECTOR_TITLE.test(start)) return "directors";
  if (AGENT_TITLE.test(start)) return "agents";
  return "miscellaneous";
}

export function groupAgentsHomeItems(
  items: readonly ThreadListV2ListItem[],
  agentsTab: boolean,
): readonly HomeListItem[] {
  if (!agentsTab) return items;

  const sections: Record<AgentsHomeSection, AgentsHomeRow[]> = {
    directors: [],
    agents: [],
    miscellaneous: [],
    snoozed: [],
  };
  let shelfStart = items.length;
  for (const [index, item] of items.entries()) {
    if (item.type === "v2-project-header") return items;
    if (item.type !== "v2-thread" && item.type !== "v2-pending") {
      shelfStart = index;
      break;
    }
    const row = item.type === "v2-thread" ? item.item.thread : item.pendingTask;
    if (!isAgentsProject(row)) return items;
    // Follow-up mode lists snoozed rows directly; keep them visible above the settled shelf.
    const section =
      item.type === "v2-thread" && item.item.snoozed ? "snoozed" : agentsHomeRole(row.title);
    sections[section].push(item);
  }
  if (shelfStart === 0) return items;

  const result: HomeListItem[] = [];
  for (const section of ["directors", "agents", "miscellaneous", "snoozed"] as const) {
    const rows = sections[section];
    if (rows.length === 0) continue;
    result.push({ type: "agents-section-header", key: `agents-section:${section}`, section });
    for (const [index, row] of rows.entries()) {
      const next = rows[index + 1];
      const showTrailingDivider =
        next !== undefined && (next.type === "v2-thread" || !next.showPendingDivider);
      result.push(
        row.showTrailingDivider === showTrailingDivider ? row : { ...row, showTrailingDivider },
      );
    }
  }
  return result.concat(items.slice(shelfStart));
}

export function homeListItemsAreEqual(previous: HomeListItem, item: HomeListItem): boolean {
  if (previous.type === "agents-section-header" || item.type === "agents-section-header") {
    return previous.type === item.type && previous.key === item.key;
  }
  return threadListV2ListItemsAreEqual(previous, item);
}
