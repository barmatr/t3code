// T4 : alertes dans l'app, sur le modèle de startThreadNotifications (T3, client web/desktop).
// Les états des fils arrivent déjà par le flux que T4 ouvre vers chaque environnement ;
// ce module compare l'avant et l'après de chaque fil et alimente le bandeau.
import { enabledEnvironmentIds } from "@t3tools/client-runtime/state/connections";
import { threadKey } from "@t3tools/client-runtime/state/entities";
import {
  type EnvironmentThreadShell,
  presentThreadShell,
} from "@t3tools/client-runtime/state/models";
import { isShownUnderParent } from "@t3tools/client-runtime/state/threads";
import type { EnvironmentId, OrchestrationV2ThreadShell, ThreadId } from "@t3tools/contracts";
import * as Option from "effect/Option";
import { AsyncResult, Atom, type AtomRegistry } from "effect/reactivity";
import { AppState, type AppStateStatus } from "react-native";

import { environmentCatalog } from "../../connection/catalog";
import { mobilePreferencesAtom } from "../../state/preferences";
import { environmentShell } from "../../state/shell";
import { environmentThreadShells } from "../../state/threads";
import { threadDeepLinkOnScreen } from "../agent-awareness/notificationPayload";
import { createThreadNotificationGate, isSnoozedForNotification } from "./inAppAlertGate";
import {
  alertAllowed,
  bannerShowsThread,
  DEFAULT_IN_APP_ALERT_SETTINGS,
  enqueueAlert,
  type InAppAlert,
  type InAppAlertBanner,
  type InAppAlertKind,
  type InAppAlertSettings,
  observeThreadForAlerts,
  resolveInAppAlertSettings,
  takeNextBanner,
  type ThreadAlertObservation,
  withoutThread,
} from "./inAppAlertModel";

export interface InAppAlertsState {
  readonly banner: InAppAlertBanner | null;
  /** Changes with every banner shown, so the banner restarts its timer and entry. */
  readonly bannerId: number;
  readonly queue: ReadonlyArray<InAppAlert>;
}

const EMPTY_STATE: InAppAlertsState = { banner: null, bannerId: 0, queue: [] };

export const inAppAlertsAtom = Atom.make<InAppAlertsState>(EMPTY_STATE).pipe(
  Atom.keepAlive,
  Atom.withLabel("t4:in-app-alerts"),
);

/** After a return to the foreground, a reconnection's first snapshot is a silent baseline. */
const RETURN_GRACE_MS = 60_000;

interface ObservedThread extends ThreadAlertObservation {
  readonly raw: OrchestrationV2ThreadShell;
  readonly subagentRequest: EnvironmentThreadShell["pendingSubagentRequest"];
  readonly thread: EnvironmentThreadShell;
  readonly projectTitle: string | null;
}

interface WatchedEnvironment {
  previous: Map<ThreadId, ObservedThread>;
  live: boolean;
  reconnecting: boolean;
  /** The next observation only records the state, so nothing from the absence is announced. */
  resetBaseline: boolean;
  quietReconnectUntil: number;
  reobserve: () => void;
  unsubscribe: () => void;
  readonly gate: ReturnType<typeof createThreadNotificationGate<ThreadId>>;
}

let threadOnScreen: string | null = null;
let appActive = AppState.currentState === "active";
const watched = new Map<EnvironmentId, WatchedEnvironment>();
let installedRegistry: AtomRegistry.AtomRegistry | null = null;
let installedNavigate: ((href: string) => void) | null = null;
let discussionsOpener: (() => void) | null = null;

function threadDeepLink(environmentId: EnvironmentId, threadId: ThreadId): string {
  return `/threads/${encodeURIComponent(environmentId)}/${encodeURIComponent(threadId)}`;
}

function isOnScreen(environmentId: EnvironmentId, threadId: ThreadId): boolean {
  return threadOnScreen !== null && threadOnScreen === threadDeepLink(environmentId, threadId);
}

/** Whether a waiting alert still says something true about its thread. */
function stillRelevant(alert: InAppAlert): boolean {
  if (isOnScreen(alert.environmentId, alert.threadId)) return false;
  const state = watched.get(alert.environmentId)?.previous.get(alert.threadId);
  if (state === undefined) return false;
  return alert.kind === "completion" ? state.kind === null : state.kind !== null;
}

function showNext(registry: AtomRegistry.AtomRegistry, queue: ReadonlyArray<InAppAlert>): void {
  const current = registry.get(inAppAlertsAtom);
  const { banner, rest } = takeNextBanner(queue.filter(stillRelevant));
  registry.set(inAppAlertsAtom, {
    banner,
    bannerId: banner === null ? current.bannerId : current.bannerId + 1,
    queue: rest,
  });
}

function present(registry: AtomRegistry.AtomRegistry, alert: InAppAlert): void {
  if (!appActive || isOnScreen(alert.environmentId, alert.threadId)) return;
  if (
    registry
      .get(environmentThreadShells.hiddenThreadKeysAtom)
      .has(threadKey({ environmentId: alert.environmentId, threadId: alert.threadId }))
  ) {
    return;
  }
  const state = registry.get(inAppAlertsAtom);
  if (state.banner === null) {
    showNext(registry, enqueueAlert(state.queue, alert));
    return;
  }
  // The thread on the banner moved on: its banner says the new state, without waiting its turn.
  if (
    state.banner.type === "single" &&
    bannerShowsThread(state.banner, alert.environmentId, alert.threadId)
  ) {
    registry.set(inAppAlertsAtom, {
      banner: { type: "single", alert },
      bannerId: state.bannerId + 1,
      queue: withoutThread(state.queue, alert.environmentId, alert.threadId),
    });
    return;
  }
  registry.set(inAppAlertsAtom, { ...state, queue: enqueueAlert(state.queue, alert) });
}

/** Closes the banner and shows the next one, if any alert still holds. */
export function dismissInAppAlert(registry: AtomRegistry.AtomRegistry): void {
  showNext(registry, registry.get(inAppAlertsAtom).queue);
}

export function openInAppAlert(registry: AtomRegistry.AtomRegistry, banner: InAppAlertBanner) {
  const state = registry.get(inAppAlertsAtom);
  const alerts = banner.type === "single" ? [banner.alert] : banner.alerts;
  let queue = state.queue;
  for (const alert of alerts) queue = withoutThread(queue, alert.environmentId, alert.threadId);
  registry.set(inAppAlertsAtom, { ...state, banner: null, queue });
  if (banner.type === "single") {
    installedNavigate?.(threadDeepLink(banner.alert.environmentId, banner.alert.threadId));
  } else {
    installedNavigate?.("/");
    discussionsOpener?.();
  }
}

/** The workspace registers how to show the Discussions tab, for a grouped banner. */
export function registerDiscussionsOpener(open: () => void): () => void {
  discussionsOpener = open;
  return () => {
    if (discussionsOpener === open) discussionsOpener = null;
  };
}

/** Called with the workspace pathname on every root navigation state change. */
export function setInAppAlertPathname(pathname: string): void {
  threadOnScreen = threadDeepLinkOnScreen(pathname);
  const registry = installedRegistry;
  if (threadOnScreen === null || registry === null) return;
  const state = registry.get(inAppAlertsAtom);
  const queue = state.queue.filter((alert) => !isOnScreen(alert.environmentId, alert.threadId));
  const banner = state.banner;
  const alerts = banner === null ? [] : banner.type === "single" ? [banner.alert] : banner.alerts;
  if (alerts.some((alert) => isOnScreen(alert.environmentId, alert.threadId))) {
    showNext(registry, queue);
  } else if (queue.length !== state.queue.length) {
    registry.set(inAppAlertsAtom, { ...state, queue });
  }
}

function readSettings(registry: AtomRegistry.AtomRegistry): InAppAlertSettings {
  const preferences = registry.get(mobilePreferencesAtom);
  return AsyncResult.isSuccess(preferences)
    ? resolveInAppAlertSettings(preferences.value.inAppAlerts)
    : DEFAULT_IN_APP_ALERT_SETTINGS;
}

function observeThreads(
  registry: AtomRegistry.AtomRegistry,
  environmentId: EnvironmentId,
  entry: WatchedEnvironment,
  threads: ReadonlyArray<OrchestrationV2ThreadShell>,
  projectTitles: ReadonlyMap<string, string>,
): void {
  if (entry.resetBaseline) {
    entry.previous = new Map();
    entry.gate.clear();
    // In the background every observation stays a baseline; back in front, the next one counts.
    if (appActive) entry.resetBaseline = false;
  }
  const previous = entry.previous;
  const next = new Map<ThreadId, ObservedThread>();
  const subagentRequests = registry.get(
    environmentThreadShells.pendingSubagentRequestsAtom(environmentId),
  );
  const delegatedUnderParent = registry.get(environmentThreadShells.delegatedUnderParentAtom);
  const changed: Array<[ObservedThread | undefined, ObservedThread]> = [];
  for (const raw of threads) {
    // A task shown under its parent speaks through the parent, as on the Mac.
    if (
      isShownUnderParent({ environmentId, threadId: raw.id }, raw.lineage, delegatedUnderParent)
    ) {
      continue;
    }
    const prior = previous.get(raw.id);
    const subagentRequest = subagentRequests.get(raw.id) ?? null;
    if (!entry.reconnecting && prior?.raw === raw && prior.subagentRequest === subagentRequest) {
      next.set(raw.id, prior);
      continue;
    }
    const thread = presentThreadShell(environmentId, raw, subagentRequest);
    const state: ObservedThread = {
      ...observeThreadForAlerts(thread),
      raw,
      subagentRequest,
      thread,
      projectTitle: projectTitles.get(raw.projectId) ?? null,
    };
    next.set(raw.id, state);
    changed.push([prior, state]);
  }
  entry.reconnecting = false;
  entry.previous = next;
  entry.gate.retain(new Set(next.keys()));
  const now = Date.now();
  for (const [prior, state] of changed) {
    entry.gate.observe(state.thread.id, prior, state, {
      archived: state.thread.archivedAt !== null,
      quiet: state.raw.latestRunStopRequested === true,
      snoozed: isSnoozedForNotification(state.thread, state.completedAt, now),
    });
  }
}

function alertFromState(
  environmentId: EnvironmentId,
  state: ObservedThread,
  kind: InAppAlertKind,
): InAppAlert {
  const failure = kind === "failed" || kind === "limited";
  return {
    id: `${environmentId}:${state.thread.id}:${kind}:${Date.now()}`,
    environmentId,
    threadId: state.thread.id,
    kind,
    threadTitle: state.thread.title,
    detail: (failure ? state.thread.runtime?.lastError : null) ?? state.projectTitle,
    at: Date.now(),
  };
}

function watchEnvironment(
  registry: AtomRegistry.AtomRegistry,
  environmentId: EnvironmentId,
): WatchedEnvironment {
  const entry: WatchedEnvironment = {
    previous: new Map(),
    live: false,
    reconnecting: false,
    resetBaseline: !appActive,
    quietReconnectUntil: 0,
    reobserve: () => {},
    unsubscribe: () => {},
    gate: createThreadNotificationGate<ThreadId>((threadId, gateKind) => {
      const state = entry.previous.get(threadId);
      if (!state) return;
      const kind: InAppAlertKind | null = gateKind === "completion" ? "completion" : state.kind;
      if (kind === null || !alertAllowed(kind, readSettings(registry))) return;
      present(registry, alertFromState(environmentId, state, kind));
    }),
  };
  let threads: ReadonlyArray<OrchestrationV2ThreadShell> | null = null;
  let projectTitles: ReadonlyMap<string, string> = new Map();
  const reobserve = () => {
    if (threads !== null) observeThreads(registry, environmentId, entry, threads, projectTitles);
  };
  entry.reobserve = reobserve;
  const unsubscribeShell = registry.subscribe(
    environmentShell.stateValueAtom(environmentId),
    (shell) => {
      const live = shell.status === "live" && Option.isSome(shell.snapshot);
      entry.live = live;
      if (live && Option.isSome(shell.snapshot)) {
        threads = shell.snapshot.value.threads;
        projectTitles = new Map(
          shell.snapshot.value.projects.map((project) => [project.id as string, project.title]),
        );
        reobserve();
        return;
      }
      threads = null;
      entry.reconnecting = true;
      if (!appActive || Date.now() < entry.quietReconnectUntil) entry.resetBaseline = true;
      entry.gate.pause();
    },
    { immediate: true },
  );
  const unsubscribeRequests = registry.subscribe(
    environmentThreadShells.pendingSubagentRequestsAtom(environmentId),
    reobserve,
  );
  const unsubscribeDelegated = registry.subscribe(
    environmentThreadShells.delegatedUnderParentAtom,
    reobserve,
  );
  entry.unsubscribe = () => {
    unsubscribeShell();
    unsubscribeRequests();
    unsubscribeDelegated();
    entry.gate.clear();
  };
  return entry;
}

function onAppStateChange(registry: AtomRegistry.AtomRegistry, status: AppStateStatus): void {
  // "inactive" covers Control Center and the app switcher's first frames: nothing changes.
  if (status === "inactive") return;
  const active = status === "active";
  if (active === appActive) return;
  appActive = active;
  if (!active) {
    for (const entry of watched.values()) entry.resetBaseline = true;
    registry.set(inAppAlertsAtom, { ...registry.get(inAppAlertsAtom), banner: null, queue: [] });
    return;
  }
  const until = Date.now() + RETURN_GRACE_MS;
  for (const entry of watched.values()) {
    entry.quietReconnectUntil = until;
    // A live stream records today's state now; a stale one waits for its reconnection.
    entry.resetBaseline = true;
    if (entry.live) entry.reobserve();
  }
}

/**
 * Starts the in-app alerts for the app's lifetime. Alerts only show while T4 is in front:
 * what happens while it is away waits in the Discussions list and its tab badge.
 */
export function installInAppAlerts(input: {
  readonly registry: AtomRegistry.AtomRegistry;
  readonly navigate: (href: string) => void;
}): () => void {
  const { registry } = input;
  installedRegistry = registry;
  installedNavigate = input.navigate;
  appActive = AppState.currentState === "active";

  const sync = () => {
    const enabled = readSettings(registry).enabled;
    const catalog = registry.get(environmentCatalog.catalogValueAtom);
    const environmentIds = enabled && catalog.isReady ? [...enabledEnvironmentIds(catalog)] : [];
    const activeIds = new Set(environmentIds);
    for (const [environmentId, entry] of watched) {
      if (activeIds.has(environmentId)) continue;
      entry.unsubscribe();
      watched.delete(environmentId);
    }
    for (const environmentId of environmentIds) {
      if (!watched.has(environmentId)) {
        watched.set(environmentId, watchEnvironment(registry, environmentId));
      }
    }
    const state = registry.get(inAppAlertsAtom);
    if (!enabled && (state.banner !== null || state.queue.length > 0)) {
      registry.set(inAppAlertsAtom, { ...state, banner: null, queue: [] });
    }
  };

  const unsubscribeCatalog = registry.subscribe(environmentCatalog.catalogValueAtom, sync);
  const unsubscribePreferences = registry.subscribe(mobilePreferencesAtom, sync);
  const appStateSubscription = AppState.addEventListener("change", (status) =>
    onAppStateChange(registry, status),
  );
  sync();

  return () => {
    unsubscribeCatalog();
    unsubscribePreferences();
    appStateSubscription.remove();
    for (const entry of watched.values()) entry.unsubscribe();
    watched.clear();
    registry.set(inAppAlertsAtom, EMPTY_STATE);
    installedRegistry = null;
    installedNavigate = null;
  };
}
