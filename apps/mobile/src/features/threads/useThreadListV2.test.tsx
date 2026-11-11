import { act, useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";
import { RegistryContext } from "@effect/atom-react";
import type { OlderSettledShelfEnvironment } from "@t3tools/client-runtime/state/threads";
import { presentThreadShell } from "@t3tools/client-runtime/state/shell";
import * as DateTime from "effect/DateTime";
import {
  CommandId,
  EnvironmentId,
  MessageId,
  ProjectId,
  RunId,
  ThreadId,
} from "@t3tools/contracts";
import { AsyncResult, Atom, AtomRegistry } from "effect/reactivity";
import { expect, it, vi } from "vite-plus/test";

import { olderSettledThreads } from "../../state/threads";
import { latestThreadMessageAtom } from "../../state/thread-age-filter";
import type { Preferences } from "../../persistence/mobile-preferences";
import { makeRawThreadShell } from "../../test-fixtures";
import { useThreadListV2 } from "./useThreadListV2";

vi.mock("../../state/threads", () => ({
  olderSettledThreads: { shelfAtom: vi.fn(), rowsKey: vi.fn(), pageRowsAtom: vi.fn() },
  threadFamilies: { mountRows: () => () => {} },
}));
vi.mock("../../state/atom-registry", () => ({ appAtomRegistry: undefined }));
vi.mock("../../state/thread-age-filter", () => ({ latestThreadMessageAtom: vi.fn() }));
const testPreferencesAtom = Atom.make(AsyncResult.success<Preferences>({}));
vi.mock("../../state/preferences", () => ({
  get mobilePreferencesAtom() {
    return testPreferencesAtom;
  },
}));

it.each(["assistant_reply", "conversation_activity"] as const)(
  "keeps the final grouped list and its neighbours stable during %s revalidation",
  async (basis) => {
    const now = Date.UTC(2026, 10, 10, 12);
    vi.useFakeTimers({ now });
    using _timers = { [Symbol.dispose]: () => vi.useRealTimers() };
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    using _globals = { [Symbol.dispose]: () => vi.unstubAllGlobals() };
    const registry = AtomRegistry.make();
    using _registry = { [Symbol.dispose]: () => registry.dispose() };
    registry.set(testPreferencesAtom, AsyncResult.success({ threadAgeBasis: basis }));
    vi.mocked(olderSettledThreads.shelfAtom).mockReturnValue(
      Atom.make<ReadonlyMap<EnvironmentId, OlderSettledShelfEnvironment>>(new Map()),
    );
    const environmentId = EnvironmentId.make("isolated-stream");
    const environmentIds = new Set([environmentId]);
    const makeThreads = (revision: number) =>
      ["before", "streaming", "after"].map((id) =>
        presentThreadShell(
          environmentId,
          makeRawThreadShell({
            id: ThreadId.make(id),
            projectId: ProjectId.make(id),
            updatedAt: DateTime.makeUnsafe(now + (id === "streaming" ? revision : 0)),
            settledOverride: "active",
            itemCount: 1,
            visibleItemCount: 1,
            latestVisibleMessage: null,
          }),
        ),
      );
    const recent = Atom.make(AsyncResult.success<number | null>(now - 120_000));
    const queries = new Map<string, Atom.Writable<AsyncResult.AsyncResult<number | null, Error>>>();
    let firstVersion: string | undefined;
    vi.mocked(latestThreadMessageAtom).mockImplementation(({ input }) => {
      if (input.threadId !== "streaming") return recent;
      firstVersion ??= input.messageVersion;
      if (input.messageVersion === firstVersion) return recent;
      let query = queries.get(input.messageVersion);
      if (!query) {
        query = Atom.make<AsyncResult.AsyncResult<number | null, Error>>(AsyncResult.initial());
        queries.set(input.messageVersion, query);
      }
      return query;
    });
    const input: Parameters<typeof useThreadListV2>[0] = {
      threads: makeThreads(0),
      prioritizeFollowUp: true,
      age: "1h",
      pendingTasks: [],
      environmentId: null,
      projectRefs: null,
      projectGroups: ["before", "streaming", "after"].map((id) => ({
        key: id,
        title: id,
        projectRefs: [{ environmentId, projectId: ProjectId.make(id) }],
      })),
      searchQuery: "",
      searchMatches: new Map(),
      settlementEnvironmentIds: environmentIds,
      snoozeEnvironmentIds: environmentIds,
      pinReorderEnvironmentIds: environmentIds,
      activeReorderEnvironmentIds: environmentIds,
      queuedThreadKeys: new Set(),
      settledLimit: 10,
      now: new Date(now).toISOString(),
      pendingOrder: null,
      shelfPreferencesLoaded: true,
      workingShelfEnabled: false,
      workingShelfExpanded: false,
      snoozedShelfExpanded: false,
      settledShelfExpanded: true,
      selectedThreadKey: null,
    };
    let current: ReturnType<typeof useThreadListV2> | undefined;
    const committedKeys: string[][] = [];
    function Probe(props: { threads: typeof input.threads }) {
      const result = useThreadListV2({ ...input, threads: props.threads });
      useLayoutEffect(() => {
        current = result;
        committedKeys.push(result.items.map((item) => item.key));
      });
      return null;
    }
    const root = createRoot(document.createElement("div"));
    using _root = { [Symbol.dispose]: () => act(() => root.unmount()) };
    const render = (revision: number) =>
      act(async () =>
        root.render(
          <RegistryContext value={registry}>
            <Probe threads={makeThreads(revision)} />
          </RegistryContext>,
        ),
      );
    await render(0);
    const originalKeys = current!.items.map((item) => item.key);
    expect(originalKeys).toHaveLength(6);
    for (const revision of [1, 2, 3, 4]) {
      await render(revision);
      expect(current!.ageFilter.pending).toBe(true);
      expect(current!.items.map((item) => item.key)).toEqual(originalKeys);
      const query = [...queries.values()].at(-1)!;
      await act(() => registry.set(query, AsyncResult.fail(new Error("Simulated reconnect"))));
      expect(current!.ageFilter.failed).toBe(true);
      expect(current!.items.map((item) => item.key)).toEqual(originalKeys);
      await act(() => registry.set(query, AsyncResult.success(now - 120_000)));
    }
    expect(committedKeys.every((keys) => keys.join() === originalKeys.join())).toBe(true);
  },
);

it("reuses a large thread list across tab renders and updates when its inputs change", async () => {
  vi.useFakeTimers({ now: Date.UTC(2026, 0, 2) });
  using _timers = { [Symbol.dispose]: () => vi.useRealTimers() };
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  using _globals = { [Symbol.dispose]: () => vi.unstubAllGlobals() };
  const shelfAtom = Atom.make<ReadonlyMap<EnvironmentId, OlderSettledShelfEnvironment>>(new Map());
  vi.mocked(olderSettledThreads.shelfAtom).mockReturnValue(shelfAtom);
  const registry = AtomRegistry.make();
  using _registry = { [Symbol.dispose]: () => registry.dispose() };
  const environmentId = EnvironmentId.make("environment-1");
  const otherEnvironmentId = EnvironmentId.make("environment-2");
  const threads = Array.from({ length: 1200 }, (_, index) =>
    presentThreadShell(
      index % 2 === 0 ? environmentId : otherEnvironmentId,
      makeRawThreadShell({
        id: ThreadId.make(`thread-${index}`),
        title: `Thread ${index}`,
        settledOverride: index < 150 ? "active" : "settled",
        settledAt: index < 150 ? null : DateTime.makeUnsafe("2026-01-01T00:00:00.000Z"),
      }),
    ),
  );
  const environmentIds = new Set([environmentId, otherEnvironmentId]);
  const input: Parameters<typeof useThreadListV2>[0] = {
    threads,
    pendingTasks: [],
    environmentId: null,
    projectRefs: null,
    searchQuery: "",
    searchMatches: new Map(),
    settlementEnvironmentIds: environmentIds,
    snoozeEnvironmentIds: environmentIds,
    pinReorderEnvironmentIds: environmentIds,
    activeReorderEnvironmentIds: environmentIds,
    queuedThreadKeys: new Set(),
    settledLimit: 10,
    now: "2026-01-02T00:00:00.000Z",
    pendingOrder: null,
    shelfPreferencesLoaded: true,
    workingShelfEnabled: true,
    workingShelfExpanded: false,
    snoozedShelfExpanded: false,
    settledShelfExpanded: true,
    selectedThreadKey: null,
  };
  const seen: Array<ReturnType<typeof useThreadListV2>> = [];
  function Probe(props: { input: typeof input; tab: string }) {
    return (
      <RegistryContext value={registry}>
        <ListProbe {...props} />
      </RegistryContext>
    );
  }
  function ListProbe(props: { input: typeof input; tab: string }) {
    const result = useThreadListV2(props.input);
    useLayoutEffect(() => {
      seen.push(result);
    });
    return <div>{props.tab}</div>;
  }

  const root = createRoot(document.createElement("div"));
  using _root = { [Symbol.dispose]: () => act(() => root.unmount()) };
  await act(async () => root.render(<Probe input={{ ...input }} tab="chats" />));
  const initial = seen.at(-1)!;
  expect(initial.layout.items).toHaveLength(160);
  expect(initial.layout.settledCount).toBe(1050);

  for (const tab of ["pullRequests", "chats", "settings", "chats"]) {
    await act(async () => root.render(<Probe input={{ ...input }} tab={tab} />));
    expect(seen.at(-1)!.olderSettledShelf.isListed).toBe(initial.olderSettledShelf.isListed);
    expect(seen.at(-1)!.olderSettledShelf.unloadedCount).toBe(
      initial.olderSettledShelf.unloadedCount,
    );
    expect(seen.at(-1)!.layout).toBe(initial.layout);
    expect(seen.at(-1)!.items).toBe(initial.items);
  }

  const nextMinute = { ...input, now: "2026-01-02T00:01:00.000Z" };
  await act(async () => root.render(<Probe input={nextMinute} tab="chats" />));
  expect(seen.at(-1)!.layout).toBe(initial.layout);
  expect(seen.at(-1)!.items).not.toBe(initial.items);
  expect(seen.at(-1)!.items.find((item) => item.type === "v2-thread")).toMatchObject({
    snoozePresetMinute: nextMinute.now,
  });

  await act(async () => root.render(<Probe input={{ ...input, environmentId }} tab="chats" />));
  expect(seen.at(-1)!.layout.items).toHaveLength(85);
  expect(seen.at(-1)!.layout.settledCount).toBe(525);
  expect(
    seen.at(-1)!.layout.items.every((item) => item.thread.environmentId === environmentId),
  ).toBe(true);

  const queuedThreadKeys = new Set([`${environmentId}:thread-150`]);
  await act(async () => root.render(<Probe input={{ ...input, queuedThreadKeys }} tab="chats" />));
  const queued = seen.at(-1)!;
  expect(queued.layout.items).toHaveLength(161);
  expect(queued.layout.settledCount).toBe(1049);
  expect(
    queued.items.find((item) => item.type === "v2-thread" && item.item.thread.id === "thread-150"),
  ).toMatchObject({ hasQueuedMessages: true, item: { variant: "card" } });

  await act(async () => root.render(<Probe input={{ ...input, settledLimit: 35 }} tab="chats" />));
  expect(seen.at(-1)!.layout.items).toHaveLength(185);

  const updatedThreads = threads.map((thread) =>
    thread.id === "thread-0" ? { ...thread, title: "Updated title" } : thread,
  );
  await act(async () =>
    root.render(<Probe input={{ ...input, threads: updatedThreads }} tab="chats" />),
  );
  expect(
    seen.at(-1)!.layout.items.find((item) => item.thread.id === "thread-0")?.thread.title,
  ).toBe("Updated title");

  await act(async () =>
    root.render(
      <Probe
        input={{ ...input, threads: updatedThreads, searchQuery: "Updated title" }}
        tab="chats"
      />,
    ),
  );
  expect(seen.at(-1)!.layout.items.map((item) => item.thread.title)).toEqual(["Updated title"]);
  const search = seen.at(-1)!;
  await act(async () =>
    root.render(
      <Probe
        input={{ ...nextMinute, threads: updatedThreads, searchQuery: "Updated title" }}
        tab="chats"
      />,
    ),
  );
  expect(seen.at(-1)!.layout).not.toBe(search.layout);
  expect(seen.at(-1)!.layout.items.map((item) => item.thread.title)).toEqual(["Updated title"]);

  const clockThreads = threads.map((thread) =>
    thread.id === "thread-0" ? { ...thread, snoozedUntil: "2026-01-02T00:00:30.000Z" } : thread,
  );
  const clockInput = { ...input, threads: clockThreads, snoozedShelfExpanded: true };
  await act(async () => root.render(<Probe input={clockInput} tab="chats" />));
  const beforeClock = seen.at(-1)!;
  expect(beforeClock.layout.snoozedCount).toBe(1);
  expect(beforeClock.layout.items.find((item) => item.thread.id === "thread-0")?.snoozed).toBe(
    true,
  );
  await act(async () => root.render(<Probe input={clockInput} tab="settings" />));
  expect(seen.at(-1)!.items).toBe(beforeClock.items);

  await act(async () =>
    root.render(<Probe input={{ ...clockInput, now: "2026-01-02T00:00:10.000Z" }} tab="chats" />),
  );
  expect(seen.at(-1)!.layout).toBe(beforeClock.layout);
  expect(seen.at(-1)!.layout.snoozedCount).toBe(1);

  await act(async () =>
    root.render(<Probe input={{ ...clockInput, now: "2026-01-02T00:01:00.000Z" }} tab="chats" />),
  );
  const afterClock = seen.at(-1)!;
  expect(afterClock.items).not.toBe(beforeClock.items);
  expect(afterClock.layout.snoozedCount).toBe(0);
  expect(afterClock.layout.items.find((item) => item.thread.id === "thread-0")?.snoozed).toBe(
    false,
  );
  await act(async () =>
    root.render(<Probe input={{ ...clockInput, now: "2026-01-02T00:02:00.000Z" }} tab="chats" />),
  );
  expect(seen.at(-1)!.layout).toBe(afterClock.layout);
  expect(seen.at(-1)!.items).not.toBe(afterClock.items);

  await act(async () =>
    root.render(<Probe input={{ ...clockInput, now: "2026-01-02T00:00:20.000Z" }} tab="chats" />),
  );
  expect(seen.at(-1)!.layout.snoozedCount).toBe(1);
  expect(seen.at(-1)!.layout.items.find((item) => item.thread.id === "thread-0")?.snoozed).toBe(
    true,
  );
  await act(async () => root.render(<Probe input={input} tab="chats" />));
  const before = "2026-01-01T12:00:00.000Z";
  const older = {
    before,
    beforeMs: Date.parse(before),
    counts: new Map([[ProjectId.make("project-test"), 575]]),
  };
  await act(async () => {
    registry.set(
      shelfAtom,
      new Map([
        [
          environmentId,
          {
            older,
            pages: { reads: [], frontier: { settledAt: before }, status: "pending" },
          },
        ],
      ]),
    );
  });
  const loading = seen.at(-1)!;
  expect(loading.layout.settledCount).toBe(1100);
  expect(loading.layout.listedSettledThreads).toHaveLength(0);
  expect(loading.layout.items).toHaveLength(150);
  expect(loading.olderSettledShelf.isListed(threads[150]!)).toBe(false);
  await act(async () => root.render(<Probe input={input} tab="settings" />));
  expect(seen.at(-1)!.items).toBe(loading.items);

  await act(async () => {
    registry.set(
      shelfAtom,
      new Map([
        [
          environmentId,
          {
            older,
            pages: { reads: [], frontier: null, status: "ready" },
          },
        ],
      ]),
    );
  });
  const loaded = seen.at(-1)!;
  expect(loaded.layout.settledCount).toBe(1100);
  expect(loaded.layout.items).toHaveLength(160);
  expect(loaded.olderSettledShelf.isListed(threads[150]!)).toBe(true);
  expect(loaded.items).not.toBe(loading.items);

  const ageThreads = threads.map((thread, index) =>
    index === 0 || index === 1 || index === 150
      ? presentThreadShell(thread.environmentId, {
          ...thread.source,
          latestVisibleMessage: {
            id: MessageId.make(`reply-${index}`),
            role: "assistant",
            text: "Recent reply",
            updatedAt: DateTime.makeUnsafe("2026-01-01T23:59:00.000Z"),
          },
        })
      : thread,
  );
  const ageInput = { ...input, threads: ageThreads, environmentId, age: "1h" as const };
  await act(async () => root.render(<Probe input={ageInput} tab="chats" />));
  expect(
    seen
      .at(-1)!
      .layout.items.map((item) => item.thread.id)
      .sort(),
  ).toEqual(["thread-0", "thread-150"]);
  // A completed page chain is authoritative even if older counts lag behind.
  expect(seen.at(-1)!.layout.settledCount).toBe(1);
  expect(seen.at(-1)!.hasUncheckedOlderThreads).toBe(false);
  await act(async () =>
    root.render(
      <Probe
        input={{
          ...ageInput,
          projectRefs: [{ environmentId, projectId: ProjectId.make("another-project") }],
        }}
        tab="chats"
      />,
    ),
  );
  expect(seen.at(-1)!.layout.items).toHaveLength(0);
});

it.each(["1h", "1d"] as const)(
  "keeps the settled shelf collapsible and loads matching older pages with age %s",
  async (age) => {
    vi.useFakeTimers({ now: Date.UTC(2026, 0, 2) });
    using _timers = { [Symbol.dispose]: () => vi.useRealTimers() };
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    using _globals = { [Symbol.dispose]: () => vi.unstubAllGlobals() };
    const registry = AtomRegistry.make();
    using _registry = { [Symbol.dispose]: () => registry.dispose() };
    registry.set(
      testPreferencesAtom,
      AsyncResult.success({ threadAgeBasis: "conversation_activity" }),
    );
    const environmentId = EnvironmentId.make("environment-age-pages");
    const projectId = ProjectId.make("project-test");
    const otherProjectId = ProjectId.make("project-b");
    const before = "2026-01-01T00:00:00.000Z";
    const older = { before, beforeMs: Date.parse(before), counts: new Map([[projectId, 1]]) };
    const shelf = (loaded: boolean) =>
      Atom.make<ReadonlyMap<EnvironmentId, OlderSettledShelfEnvironment>>(
        new Map<EnvironmentId, OlderSettledShelfEnvironment>([
          [
            environmentId,
            {
              older,
              pages: {
                reads: [],
                frontier: loaded ? null : { settledAt: before },
                status: "ready",
              },
            },
          ],
        ]),
      );
    const initialShelf = shelf(false);
    const loadedShelf = shelf(true);
    vi.mocked(olderSettledThreads.shelfAtom).mockImplementation((scopes) =>
      scopes.some(({ pages }) => pages > 0) ? loadedShelf : initialShelf,
    );
    const row = (id: string, recent: boolean, olderPage = false) =>
      presentThreadShell(
        environmentId,
        makeRawThreadShell({
          id: ThreadId.make(id),
          projectId: olderPage ? otherProjectId : projectId,
          settledOverride: "settled",
          settledAt: DateTime.makeUnsafe(
            olderPage ? "2025-12-31T00:00:00.000Z" : "2026-01-01T12:00:00.000Z",
          ),
          latestVisibleMessage: {
            id: MessageId.make(id),
            role: "user",
            text: "Activity",
            updatedAt: DateTime.makeUnsafe(
              recent ? "2026-01-01T23:59:00.000Z" : "2025-12-30T12:00:00.000Z",
            ),
          },
        }),
      );
    const environmentIds = new Set([environmentId]);
    const input: Parameters<typeof useThreadListV2>[0] = {
      threads: [
        row("recent", true),
        ...Array.from({ length: 30 }, (_, i) => row(`old-${i}`, false)),
        row("recent-in-older-page", true, true),
      ],
      pendingTasks: [],
      environmentId,
      projectRefs: null,
      projectGroups: [
        { key: "a", title: "Projet A", projectRefs: [{ environmentId, projectId }] },
        {
          key: "b",
          title: "Projet B",
          projectRefs: [{ environmentId, projectId: otherProjectId }],
        },
      ],
      searchQuery: "",
      searchMatches: new Map(),
      settlementEnvironmentIds: environmentIds,
      snoozeEnvironmentIds: environmentIds,
      pinReorderEnvironmentIds: environmentIds,
      activeReorderEnvironmentIds: environmentIds,
      queuedThreadKeys: new Set(),
      settledLimit: 10,
      now: "2026-01-02T00:00:00.000Z",
      pendingOrder: null,
      shelfPreferencesLoaded: true,
      workingShelfEnabled: false,
      workingShelfExpanded: true,
      snoozedShelfExpanded: false,
      settledShelfExpanded: true,
      selectedThreadKey: null,
      age,
    };
    let current: ReturnType<typeof useThreadListV2> | undefined;
    function Probe({ input: listInput = input }: { input?: typeof input }) {
      const value = useThreadListV2(listInput);
      useLayoutEffect(() => {
        current = value;
      });
      return null;
    }
    const root = createRoot(document.createElement("div"));
    using _root = { [Symbol.dispose]: () => act(() => root.unmount()) };
    await act(async () =>
      root.render(
        <RegistryContext value={registry}>
          <Probe />
        </RegistryContext>,
      ),
    );
    expect(current!.layout.items.map(({ thread }) => thread.id).sort()).toEqual([
      "recent",
      "recent-in-older-page",
    ]);
    expect(current!.projectGrouped).toBe(true);
    expect(current!.items.map((item) => item.type)).toEqual([
      "v2-settled-shelf",
      "v2-thread",
      "v2-thread",
    ]);
    expect(current!.items[0]).toMatchObject({ count: 2, expanded: true });
    expect(current!.hasUncheckedOlderThreads).toBe(false);
    await act(async () =>
      root.render(
        <RegistryContext value={registry}>
          <Probe input={{ ...input, age: "all" }} />
        </RegistryContext>,
      ),
    );
    expect(current!.projectGrouped).toBe(false);
    expect(current!.items.some((item) => item.type === "v2-project-header")).toBe(false);
    await act(async () =>
      root.render(
        <RegistryContext value={registry}>
          <Probe
            input={{
              ...input,
              prioritizeFollowUp: true,
              projectRefs: [{ environmentId, projectId }],
              settledShelfExpanded: false,
            }}
          />
        </RegistryContext>,
      ),
    );
    expect(current!.projectGrouped).toBe(false);
    expect(current!.items.map((item) => item.type)).toEqual(["v2-settled-shelf"]);
    expect(current!.items[0]).toMatchObject({ count: 1, expanded: false });
    expect(current!.layout.items).toHaveLength(0);
    await act(async () =>
      root.render(
        <RegistryContext value={registry}>
          <Probe
            input={{
              ...input,
              prioritizeFollowUp: true,
              projectRefs: [{ environmentId, projectId }],
              settledShelfExpanded: true,
            }}
          />
        </RegistryContext>,
      ),
    );
    expect(current!.items.map((item) => item.type)).toEqual(["v2-settled-shelf", "v2-thread"]);
    expect(current!.items[0]).toMatchObject({ count: 1, expanded: true });
    expect(current!.layout.items.map(({ thread }) => thread.id)).toEqual(["recent"]);
  },
);

it("hot ignores age, preserves project/environment/search, and reacts to real Done visits", async () => {
  const now = Date.UTC(2026, 0, 2);
  vi.useFakeTimers({ now });
  using _timers = { [Symbol.dispose]: () => vi.useRealTimers() };
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  using _globals = { [Symbol.dispose]: () => vi.unstubAllGlobals() };
  const registry = AtomRegistry.make();
  using _registry = { [Symbol.dispose]: () => registry.dispose() };
  registry.set(testPreferencesAtom, AsyncResult.success({ threadAgeBasis: "assistant_reply" }));
  vi.mocked(olderSettledThreads.shelfAtom).mockReturnValue(
    Atom.make<ReadonlyMap<EnvironmentId, OlderSettledShelfEnvironment>>(new Map()),
  );
  const env = EnvironmentId.make("hot-local");
  const remote = EnvironmentId.make("hot-remote");
  const projectId = ProjectId.make("hot-project");
  const otherProject = ProjectId.make("other-project");
  const envs = new Set([env, remote]);
  const old = "2025-01-01T00:00:00.000Z";
  const row = (id: string, environmentId = env, project = projectId) =>
    presentThreadShell(
      environmentId,
      makeRawThreadShell({
        id: ThreadId.make(id),
        projectId: project,
        title: `Hot ${id}`,
        settledOverride: "active",
        latestVisibleMessage: {
          id: MessageId.make(id),
          role: "assistant",
          text: "Old response",
          updatedAt: DateTime.makeUnsafe(old),
        },
      }),
    );
  const approval = { ...row("approval"), hasPendingApprovals: true };
  const unread = {
    ...row("unread"),
    settledOverride: "settled" as const,
    lastVisitedAt: "2024-01-01T00:00:00.000Z",
    latestRun: {
      runId: RunId.make("old-done"),
      status: "completed" as const,
      requestedAt: old,
      startedAt: old,
      completedAt: old,
      assistantMessageId: null,
    },
  };
  const waiting = { ...row("waiting", remote), hasPendingUserInput: true };
  const empty = { ...row("empty"), latestRun: null, runtime: null };
  const creation = { projectId, workspaceMode: "local" as const, branch: null, worktreePath: null };
  const pendingTasks: Parameters<typeof useThreadListV2>[0]["pendingTasks"] = [
    {
      kind: "pending",
      key: "local-queued",
      environmentId: env,
      projectId,
      projectTitle: undefined,
      projectCwd: undefined,
      branch: null,
      title: "Hot queued",
      createdAt: old,
      creation,
      message: {
        environmentId: env,
        threadId: ThreadId.make("new-queued"),
        messageId: MessageId.make("queued-message"),
        commandId: CommandId.make("queued-command"),
        text: "Hot queued",
        attachments: [],
        createdAt: old,
        creation,
      },
    },
    {
      kind: "draft",
      key: "local-draft",
      environmentId: env,
      projectId,
      projectTitle: undefined,
      projectCwd: undefined,
      title: "Hot draft",
      createdAt: old,
      draftKey: "new-task:draft",
      draft: { text: "Hot draft", attachments: [] },
    },
  ];
  const input: Parameters<typeof useThreadListV2>[0] = {
    threads: [
      empty,
      unread,
      approval,
      waiting,
      { ...row("other-project", env, otherProject), hasPendingApprovals: true },
    ],
    pendingTasks,
    environmentId: null,
    projectRefs: null,
    projectGroups: [
      { key: "local", title: "Local", projectRefs: [{ environmentId: env, projectId }] },
      { key: "remote", title: "Remote", projectRefs: [{ environmentId: remote, projectId }] },
      {
        key: "other",
        title: "Other",
        projectRefs: [{ environmentId: env, projectId: otherProject }],
      },
    ],
    searchQuery: "",
    searchMatches: new Map(),
    settlementEnvironmentIds: envs,
    snoozeEnvironmentIds: envs,
    pinReorderEnvironmentIds: envs,
    activeReorderEnvironmentIds: envs,
    queuedThreadKeys: new Set(),
    settledLimit: 10,
    now: new Date(now).toISOString(),
    pendingOrder: null,
    shelfPreferencesLoaded: true,
    workingShelfEnabled: true,
    workingShelfExpanded: false,
    snoozedShelfExpanded: false,
    settledShelfExpanded: false,
    selectedThreadKey: null,
    age: "1h",
    hot: false,
    prioritizeFollowUp: true,
  };
  let current: ReturnType<typeof useThreadListV2> | undefined;
  function Probe({ input: value }: { input: typeof input }) {
    const result = useThreadListV2(value);
    useLayoutEffect(() => {
      current = result;
    });
    return null;
  }
  const root = createRoot(document.createElement("div"));
  using _root = { [Symbol.dispose]: () => act(() => root.unmount()) };
  const render = (value: typeof input) =>
    act(async () =>
      root.render(
        <RegistryContext value={registry}>
          <Probe input={value} />
        </RegistryContext>,
      ),
    );
  const ids = () =>
    current!.items.flatMap((item) =>
      item.type === "v2-thread"
        ? [String(item.item.thread.id)]
        : item.type === "v2-pending"
          ? [item.pendingTask.key]
          : [],
    );
  await render(input);
  expect(ids()).toEqual([]);
  const hot = { ...input, hot: true };
  await render(hot);
  expect(new Set(ids())).toEqual(
    new Set(["approval", "unread", "waiting", "other-project", "local-draft", "local-queued"]),
  );
  expect(current!.ageFiltered).toBe(false);
  expect(current!.projectGrouped).toBe(true);
  expect(current!.items.filter((item) => item.type === "v2-project-header")).toHaveLength(3);
  await render({ ...hot, queuedThreadKeys: new Set([`${env}:empty`]) });
  expect(ids()).toContain("empty");
  await render(hot);
  const originalItems = current!.items;
  await render({ ...hot });
  expect(current!.items).toBe(originalItems);
  await render({ ...hot, environmentId: env, projectRefs: [{ environmentId: env, projectId }] });
  expect(ids()).toEqual(["approval", "unread", "local-draft", "local-queued"]);
  expect(current!.projectGrouped).toBe(false);
  await render({
    ...hot,
    environmentId: env,
    projectRefs: [{ environmentId: env, projectId }],
    searchQuery: "unread",
  });
  expect(ids()).toEqual(["unread"]);
  await render({
    ...hot,
    threads: hot.threads.map((thread) =>
      thread.id === "unread" ? { ...thread, lastVisitedAt: old } : thread,
    ),
  });
  expect(ids()).not.toContain("unread");
  // The hook never changes the chosen age or acknowledges a completion itself.
  expect(input.age).toBe("1h");
  expect(unread.lastVisitedAt).toBe("2024-01-01T00:00:00.000Z");
  await render(input);
  expect(current!.ageFiltered).toBe(true);
  expect(ids()).toEqual([]);
});
