import {
  EnvironmentId,
  RunId,
  RuntimeRequestId,
  ThreadId,
  type OrchestrationV2ThreadShell,
} from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import * as Option from "effect/Option";
import { AsyncResult, Atom, AtomRegistry } from "effect/reactivity";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { makeRawThreadShell } from "../../test-fixtures";

const fixture = vi.hoisted(() => ({
  appState: "active" as string,
  listeners: [] as Array<(status: string) => void>,
}));

vi.mock("react-native", () => ({
  AppState: {
    get currentState() {
      return fixture.appState;
    },
    addEventListener: (_event: string, listener: (status: string) => void) => {
      fixture.listeners.push(listener);
      return { remove: () => {} };
    },
  },
}));
vi.mock("../agent-awareness/notificationPayload", () => ({
  threadDeepLinkOnScreen: (pathname: string) =>
    pathname.startsWith("/threads/") ? pathname : null,
}));
vi.mock("../../connection/catalog", async () => {
  const { Atom } = await import("effect/reactivity");
  const { EnvironmentId } = await import("@t3tools/contracts");
  return {
    environmentCatalog: {
      catalogValueAtom: Atom.make({
        isReady: true,
        entries: new Map([[EnvironmentId.make("env-1"), { enabled: true }]]),
      }),
    },
  };
});
vi.mock("../../state/preferences", async () => {
  const { AsyncResult, Atom } = await import("effect/reactivity");
  return { mobilePreferencesAtom: Atom.make(AsyncResult.success({})) };
});
vi.mock("../../state/shell", async () => {
  const { Atom } = await import("effect/reactivity");
  const Option = await import("effect/Option");
  const state = Atom.make({
    snapshot: Option.none(),
    status: "empty",
    error: Option.none(),
    generation: 0,
  });
  return { environmentShell: { stateValueAtom: () => state } };
});
vi.mock("../../state/threads", async () => {
  const { Atom } = await import("effect/reactivity");
  const requests = Atom.make(new Map());
  return {
    environmentThreadShells: {
      pendingSubagentRequestsAtom: () => requests,
      delegatedUnderParentAtom: Atom.make(new Set()),
      hiddenThreadKeysAtom: Atom.make(new Set()),
    },
  };
});

const { environmentShell } = await import("../../state/shell");
const { mobilePreferencesAtom } = await import("../../state/preferences");
const { inAppAlertsAtom, installInAppAlerts, openInAppAlert, setInAppAlertPathname } =
  await import("./inAppAlerts");

const environmentId = EnvironmentId.make("env-1");
const threadId = ThreadId.make("thread-1");
const shellAtom = environmentShell.stateValueAtom(environmentId) as unknown as Atom.Writable<
  unknown,
  unknown
>;

function rawThread(
  status: "running" | "completed",
  completedAt?: string,
): OrchestrationV2ThreadShell {
  const base = makeRawThreadShell({ id: threadId, title: "Refonte du bandeau" });
  return {
    ...base,
    status,
    latestRunId: RunId.make("run-1"),
    activeRunId: status === "running" ? RunId.make("run-1") : null,
    updatedAt: DateTime.makeUnsafe(completedAt ?? "2026-11-25T10:00:00.000Z"),
    ...(completedAt === undefined
      ? {}
      : { latestRunCompletedAt: DateTime.makeUnsafe(completedAt) }),
  };
}

function publish(
  registry: AtomRegistry.AtomRegistry,
  threads: ReadonlyArray<OrchestrationV2ThreadShell>,
  status = "live",
) {
  registry.set(shellAtom, {
    snapshot: Option.some({ threads, projects: [] }),
    status,
    error: Option.none(),
    generation: 1,
  });
}

function setAppState(status: string) {
  fixture.appState = status;
  for (const listener of fixture.listeners) listener(status);
}

describe("installInAppAlerts", () => {
  let registry: AtomRegistry.AtomRegistry;
  let navigate: ReturnType<typeof vi.fn<(href: string) => void>>;
  let dispose: () => void;

  beforeEach(() => {
    fixture.appState = "active";
    fixture.listeners.length = 0;
    registry = AtomRegistry.make();
    navigate = vi.fn<(href: string) => void>();
    setInAppAlertPathname("/");
    publish(registry, [rawThread("running")]);
    dispose = installInAppAlerts({ registry, navigate });
  });

  afterEach(() => dispose());

  it("stays quiet about the state found at launch, then announces a finished turn", () => {
    expect(registry.get(inAppAlertsAtom).banner).toBeNull();
    publish(registry, [rawThread("completed", "2026-11-25T10:05:00.000Z")]);
    const banner = registry.get(inAppAlertsAtom).banner;
    expect(banner?.type).toBe("single");
    expect(banner?.type === "single" ? banner.alert.kind : null).toBe("completion");
    expect(banner?.type === "single" ? banner.alert.threadTitle : null).toBe("Refonte du bandeau");

    openInAppAlert(registry, banner!);
    expect(navigate).toHaveBeenCalledWith(`/threads/env-1/thread-1`);
    expect(registry.get(inAppAlertsAtom).banner).toBeNull();
  });

  it("says nothing about the thread already on screen", () => {
    setInAppAlertPathname("/threads/env-1/thread-1");
    publish(registry, [rawThread("completed", "2026-11-25T10:05:00.000Z")]);
    expect(registry.get(inAppAlertsAtom).banner).toBeNull();
  });

  it("keeps what happened in the background for Discussions, not for a burst of banners", () => {
    setAppState("background");
    publish(registry, [rawThread("completed", "2026-11-25T10:05:00.000Z")]);
    expect(registry.get(inAppAlertsAtom).banner).toBeNull();
    setAppState("active");
    expect(registry.get(inAppAlertsAtom).banner).toBeNull();
  });

  it("announces an approval, then drops the banner once it is answered elsewhere", () => {
    const waiting: OrchestrationV2ThreadShell = {
      ...rawThread("running"),
      updatedAt: DateTime.makeUnsafe("2026-11-25T10:01:00.000Z"),
      pendingRuntimeRequest: {
        id: RuntimeRequestId.make("request-1"),
        kind: "command",
        createdAt: DateTime.makeUnsafe("2026-11-25T10:01:00.000Z"),
      },
    };
    publish(registry, [waiting]);
    const banner = registry.get(inAppAlertsAtom).banner;
    expect(banner?.type === "single" ? banner.alert.kind : null).toBe("approval");

    publish(registry, [{ ...waiting, pendingRuntimeRequest: null }]);
    expect(registry.get(inAppAlertsAtom).banner).toBeNull();
  });

  it("follows the main switch", () => {
    registry.set(
      mobilePreferencesAtom as unknown as Atom.Writable<unknown, unknown>,
      AsyncResult.success({ inAppAlerts: { enabled: false } }),
    );
    publish(registry, [rawThread("completed", "2026-11-25T10:05:00.000Z")]);
    expect(registry.get(inAppAlertsAtom).banner).toBeNull();
  });
});
