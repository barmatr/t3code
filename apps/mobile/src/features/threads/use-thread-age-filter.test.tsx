import { RegistryContext } from "@effect/atom-react";
import { presentThreadShell } from "@t3tools/client-runtime/state/shell";
import { EnvironmentId, MessageId, ThreadId } from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import * as Option from "effect/Option";
import { AsyncResult, Atom, AtomRegistry } from "effect/reactivity";
import { act, useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vite-plus/test";
import type { ThreadAge, ThreadAgeBasis } from "../../lib/thread-age";
import type { Preferences } from "../../persistence/mobile-preferences";
import { makeRawThreadShell } from "../../test-fixtures";
import { latestThreadMessageAtom } from "../../state/thread-age-filter";
import { useThreadAgeFilter } from "./use-thread-age-filter";

const preferencesAtom = Atom.make(AsyncResult.success<Preferences>({}));
vi.mock("../../state/preferences", () => ({
  get mobilePreferencesAtom() {
    return preferencesAtom;
  },
}));
vi.mock("../../state/thread-age-filter", () => ({ latestThreadMessageAtom: vi.fn() }));

async function ageFilterHarness(basis: ThreadAgeBasis = "assistant_reply") {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const registry = AtomRegistry.make();
  registry.set(preferencesAtom, AsyncResult.success({ threadAgeBasis: basis }));
  const root = createRoot(document.createElement("div"));
  let current: ReturnType<typeof useThreadAgeFilter> | undefined;
  const commits: string[][] = [];
  function Probe(props: { threads: Parameters<typeof useThreadAgeFilter>[0] }) {
    const result = useThreadAgeFilter(props.threads, "1h", []);
    useLayoutEffect(() => {
      current = result;
      commits.push(result.threads.map((thread) => String(thread.id)));
    });
    return null;
  }
  return {
    registry,
    commits,
    get current() {
      if (!current) throw new Error("Filter not rendered");
      return current;
    },
    render: (threads: Parameters<typeof useThreadAgeFilter>[0]) =>
      act(async () =>
        root.render(
          <RegistryContext value={registry}>
            <Probe threads={threads} />
          </RegistryContext>,
        ),
      ),
    async [Symbol.asyncDispose]() {
      await act(() => root.unmount());
      registry.dispose();
      vi.unstubAllGlobals();
    },
  };
}

function shellWithoutMessage(environment = "test", updatedAt = "2026-11-10T12:00:00.000Z") {
  return presentThreadShell(
    EnvironmentId.make(environment),
    makeRawThreadShell({
      id: ThreadId.make("active-thread"),
      updatedAt: DateTime.makeUnsafe(updatedAt),
      visibleItemCount: 1,
      itemCount: 1,
      latestVisibleMessage: null,
    }),
  );
}

it.each(["assistant_reply", "conversation_activity"] as const)(
  "keeps a known recent %s date across stream versions and lookup failures",
  async (basis) => {
    const now = Date.UTC(2026, 10, 10, 12);
    vi.useFakeTimers({ now });
    using _timers = { [Symbol.dispose]: () => vi.useRealTimers() };
    await using view = await ageFilterHarness(basis);
    const original = shellWithoutMessage();
    const resolved = Atom.make<AsyncResult.AsyncResult<number | null, Error>>(
      AsyncResult.success(now - 120_000),
    );
    const refreshing = Atom.make<AsyncResult.AsyncResult<number | null, Error>>(
      AsyncResult.initial(),
    );
    let originalVersion: string | undefined;
    vi.mocked(latestThreadMessageAtom).mockImplementation(({ input }) => {
      originalVersion ??= input.messageVersion;
      return input.messageVersion === originalVersion ? resolved : refreshing;
    });
    await view.render([original]);
    expect(view.current.threads).toEqual([original]);
    await act(() =>
      view.registry.set(resolved, AsyncResult.success(now - 120_000, { waiting: true })),
    );
    expect(view.current.pending).toBe(true);
    // The list header must not appear for a background check of an already
    // resolved row; inserting it shifts every row even if membership is stable.
    expect(view.current.checking).toBe(false);
    expect(view.current.threads).toEqual([original]);
    const updated = shellWithoutMessage("test", "2026-11-10T12:00:01.000Z");
    await view.render([updated]);
    expect(view.current.pending).toBe(true);
    expect(view.current.checking).toBe(false);
    expect(view.current.threads).toEqual([updated]);
    await act(() => view.registry.set(refreshing, AsyncResult.fail(new Error("Offline"))));
    expect(view.current.failed).toBe(true);
    expect(view.current.threads).toEqual([updated]);
    await act(() => view.registry.set(refreshing, AsyncResult.success(now - 120_000)));
    expect(view.current.failed).toBe(false);
    // A late result belonging to the retired query version must not replace the
    // current version's answer or remove the row.
    await act(() => view.registry.set(resolved, AsyncResult.success(now - 24 * 60 * 60_000)));
    expect(view.current.threads).toEqual([updated]);
    expect(view.commits.every((ids) => ids.length === 1)).toBe(true);
  },
);

it("uses a previous success when a lookup first mounts in a failed state", async () => {
  const now = Date.UTC(2026, 10, 10, 12);
  vi.useFakeTimers({ now });
  using _timers = { [Symbol.dispose]: () => vi.useRealTimers() };
  await using view = await ageFilterHarness();
  const result = Atom.make(
    AsyncResult.fail(new Error("Disconnected"), {
      previousSuccess: Option.some(AsyncResult.success(now - 120_000)),
    }),
  );
  vi.mocked(latestThreadMessageAtom).mockReturnValue(result);
  const thread = shellWithoutMessage();
  await view.render([thread]);
  expect(view.current.failed).toBe(true);
  expect(view.current.threads).toEqual([thread]);
});

it.each([null, Date.UTC(2026, 10, 9, 12)])(
  "accepts an authoritative %s answer and does not resurrect an older cached success",
  async (answer) => {
    const now = Date.UTC(2026, 10, 10, 12);
    vi.useFakeTimers({ now });
    using _timers = { [Symbol.dispose]: () => vi.useRealTimers() };
    await using view = await ageFilterHarness();
    const result = Atom.make<AsyncResult.AsyncResult<number | null, Error>>(
      AsyncResult.success(now - 120_000),
    );
    vi.mocked(latestThreadMessageAtom).mockReturnValue(result);
    const thread = shellWithoutMessage();
    await view.render([thread]);
    expect(view.current.threads).toHaveLength(1);
    await act(() => view.registry.set(result, AsyncResult.success(answer)));
    expect(view.current.threads).toHaveLength(0);
    await act(() =>
      view.registry.set(
        result,
        AsyncResult.fail(new Error("Offline"), {
          previousSuccess: Option.some(AsyncResult.success(now - 120_000)),
        }),
      ),
    );
    expect(view.current.failed).toBe(true);
    expect(view.current.threads).toHaveLength(0);
  },
);

it.each(["loading", "failed"])("expires a retained date while a lookup is %s", async (status) => {
  const now = Date.UTC(2026, 10, 10, 12);
  vi.useFakeTimers({ now });
  using _timers = { [Symbol.dispose]: () => vi.useRealTimers() };
  await using view = await ageFilterHarness();
  const result = Atom.make<AsyncResult.AsyncResult<number | null, Error>>(
    AsyncResult.success(now - 59 * 60_000),
  );
  vi.mocked(latestThreadMessageAtom).mockReturnValue(result);
  await view.render([shellWithoutMessage()]);
  expect(view.current.threads).toHaveLength(1);
  await act(() =>
    view.registry.set(
      result,
      status === "loading" ? AsyncResult.initial() : AsyncResult.fail(new Error("Offline")),
    ),
  );
  expect(view.current.pending).toBe(status === "loading");
  expect(view.current.failed).toBe(status === "failed");
  expect(view.current.threads).toHaveLength(1);
  await act(async () => vi.advanceTimersByTime(60_000));
  expect(view.current.threads).toHaveLength(0);
});

it("isolates retained dates by environment and basis and prunes removed threads", async () => {
  const now = Date.UTC(2026, 10, 10, 12);
  vi.useFakeTimers({ now });
  using _timers = { [Symbol.dispose]: () => vi.useRealTimers() };
  await using view = await ageFilterHarness();
  const recent = Atom.make<AsyncResult.AsyncResult<number | null, Error>>(
    AsyncResult.success(now - 120_000),
  );
  const unknown = Atom.make(AsyncResult.initial<number | null, Error>());
  vi.mocked(latestThreadMessageAtom).mockImplementation(({ environmentId, input }) =>
    environmentId === "one" && input.basis === "assistant_reply" ? recent : unknown,
  );
  const one = shellWithoutMessage("one");
  const two = shellWithoutMessage("two");
  await view.render([one, two]);
  expect(view.current.threads).toEqual([one]);
  expect(view.current.checking).toBe(true);
  await act(() =>
    view.registry.set(
      preferencesAtom,
      AsyncResult.success({ threadAgeBasis: "conversation_activity" }),
    ),
  );
  expect(view.current.threads).toHaveLength(0);
  await act(() =>
    view.registry.set(preferencesAtom, AsyncResult.success({ threadAgeBasis: "assistant_reply" })),
  );
  expect(view.current.threads).toEqual([one]);
  await view.render([two]);
  await act(() => view.registry.set(recent, AsyncResult.initial()));
  await view.render([one, two]);
  expect(view.current.threads).toHaveLength(0);
});

it("filters the four rolling windows, changes the reference, and expires replies without new messages", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  using _globals = { [Symbol.dispose]: () => vi.unstubAllGlobals() };
  vi.mocked(latestThreadMessageAtom).mockReset();
  const now = Date.UTC(2026, 10, 10, 12);
  vi.useFakeTimers({ now });
  using _timers = { [Symbol.dispose]: () => vi.useRealTimers() };
  const registry = AtomRegistry.make();
  using _registry = { [Symbol.dispose]: () => registry.dispose() };
  const environmentId = EnvironmentId.make("test");
  const minutes = (value: number) => new Date(now - value * 60_000).toISOString();
  const thread = (id: string, ageMinutes: number, role: "assistant" | "user" = "assistant") =>
    presentThreadShell(
      environmentId,
      makeRawThreadShell({
        id: ThreadId.make(id),
        updatedAt: DateTime.makeUnsafe(minutes(0)),
        latestVisibleMessage: {
          id: MessageId.make(id),
          role,
          text: "Message de démonstration",
          updatedAt: DateTime.makeUnsafe(minutes(ageMinutes)),
        },
      }),
    );
  const threads = [
    thread("recent", 5),
    thread("hour", 30),
    thread("day", 720),
    thread("week", 4320),
    thread("old", 20160),
    thread("recent-user", 1, "user"),
    thread("no-reply", 1, "user"),
    // Current servers omit message bodies from their shell; the timestamp must
    // come from the bounded history rather than thread metadata or creation.
    presentThreadShell(
      environmentId,
      makeRawThreadShell({
        id: ThreadId.make("shell-without-message"),
        visibleItemCount: 1,
        itemCount: 1,
        updatedAt: DateTime.makeUnsafe(minutes(0)),
      }),
    ),
  ];
  const previousReply = Atom.make(AsyncResult.success<number | null>(Date.parse(minutes(180))));
  const shellReply = Atom.make(AsyncResult.success<number | null>(Date.parse(minutes(2))));
  const noReply = Atom.make(AsyncResult.success<number | null>(null));
  vi.mocked(latestThreadMessageAtom).mockImplementation(({ input }) =>
    input.threadId === "no-reply"
      ? noReply
      : input.threadId === "shell-without-message"
        ? shellReply
        : previousReply,
  );
  let current: ReturnType<typeof useThreadAgeFilter> | undefined;
  function Probe({ age }: { age: ThreadAge }) {
    const result = useThreadAgeFilter(threads, age, []);
    useLayoutEffect(() => {
      current = result;
    });
    return null;
  }
  const root = createRoot(document.createElement("div"));
  using _root = { [Symbol.dispose]: () => act(() => root.unmount()) };
  const render = async (age: ThreadAge) =>
    act(async () =>
      root.render(
        <RegistryContext value={registry}>
          <Probe age={age} />
        </RegistryContext>,
      ),
    );
  const ids = () => current!.threads.map((item) => String(item.id));
  await render("all");
  expect(current!.threads).toBe(threads);
  expect(latestThreadMessageAtom).not.toHaveBeenCalled();
  await render("10m");
  expect(ids()).toEqual(["recent", "shell-without-message"]);
  await render("1h");
  expect(ids()).toEqual(["recent", "hour", "shell-without-message"]);
  await render("1d");
  expect(ids()).toEqual(["recent", "hour", "day", "recent-user", "shell-without-message"]);
  await render("1w");
  expect(ids()).toEqual(["recent", "hour", "day", "week", "recent-user", "shell-without-message"]);
  const setBasis = async (basis: ThreadAgeBasis) =>
    act(async () => registry.set(preferencesAtom, AsyncResult.success({ threadAgeBasis: basis })));
  await setBasis("conversation_activity");
  await render("10m");
  expect(ids()).toEqual(["recent", "recent-user", "no-reply", "shell-without-message"]);
  await setBasis("assistant_reply");
  expect(ids()).toEqual(["recent", "shell-without-message"]);
  await act(async () => vi.advanceTimersByTime(5 * 60_000));
  expect(ids()).toEqual(["shell-without-message"]);
  await act(async () => registry.set(previousReply, AsyncResult.success(now + 5 * 60_000)));
  expect(ids()).toEqual(["recent-user", "shell-without-message"]);

  // A failed history lookup must stay visible as an error and be recoverable without
  // changing the filter. An initial lookup must not be confused with an empty result.
  let response: AsyncResult.AsyncResult<number | null, Error> = AsyncResult.initial();
  const retryingReply = Atom.make(() => response);
  vi.mocked(latestThreadMessageAtom).mockReturnValue(retryingReply);
  await render("all");
  await render("10m");
  expect(current!.pending).toBe(true);
  expect(current!.failed).toBe(false);
  response = AsyncResult.fail(new Error("Demo backend unavailable"));
  await act(async () => current!.retry());
  expect(current!.pending).toBe(false);
  expect(current!.failed).toBe(true);
  expect(ids()).toEqual(["recent-user", "shell-without-message"]);
  response = AsyncResult.success(now + 5 * 60_000);
  await act(async () => current!.retry());
  expect(current!.failed).toBe(false);
  expect(ids()).toEqual(["recent-user", "no-reply", "shell-without-message"]);
});
