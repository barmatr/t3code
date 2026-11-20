import { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { expect, it } from "vite-plus/test";

import { scopedThreadKey } from "../../lib/scopedEntities";
import type { ThreadListV2ListItem } from "../threads/threadListV2";
import { checkedThreadsForSettle, settleGroupsByProjectHeader } from "./threadSettleSelection";

const local = EnvironmentId.make("local");
const legacy = EnvironmentId.make("legacy");
const row = (environmentId: EnvironmentId, id: string) =>
  ({
    type: "v2-thread",
    key: id,
    item: { thread: { environmentId, id: ThreadId.make(id) } },
  }) as unknown as ThreadListV2ListItem;
const header = (key: string) =>
  ({ type: "v2-project-header", key, title: key }) satisfies ThreadListV2ListItem;

it("groups each project's listed rows under its heading, above Settled only", () => {
  const items = [
    header("p1"),
    row(local, "a"),
    row(legacy, "no-settlement"),
    row(local, "b"),
    header("p2"),
    row(local, "c"),
    { type: "v2-settled-shelf", key: "settled" } as unknown as ThreadListV2ListItem,
    row(local, "already-settled"),
  ] satisfies ReadonlyArray<ThreadListV2ListItem>;
  const groups = settleGroupsByProjectHeader(items, new Set([local]));
  expect([...groups.keys()]).toEqual(["p1", "p2"]);
  const first = groups.get("p1")!;
  expect(first.threads.map((thread) => thread.id)).toEqual(["a", "b"]);
  expect(first.rowKeys.has(scopedThreadKey(legacy, ThreadId.make("no-settlement")))).toBe(true);
  expect(groups.get("p2")!.threads.map((thread) => thread.id)).toEqual(["c"]);
  expect(first.rowKeys.has(scopedThreadKey(local, ThreadId.make("c")))).toBe(false);
});

it("starts with every row checked and keeps the ones the user unchecks out", () => {
  const groups = settleGroupsByProjectHeader(
    [header("p"), row(local, "a"), row(local, "b")],
    new Set([local]),
  );
  const selectable = groups.get("p")!.threads;
  expect(checkedThreadsForSettle(selectable, new Set()).map((thread) => thread.id)).toEqual([
    "a",
    "b",
  ]);
  const unchecked = new Set([scopedThreadKey(local, ThreadId.make("a"))]);
  expect(checkedThreadsForSettle(selectable, unchecked).map((thread) => thread.id)).toEqual(["b"]);
});
