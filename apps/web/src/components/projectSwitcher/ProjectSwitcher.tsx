import { useNavigate } from "@tanstack/react-router";
import {
  scopeProjectRef,
  scopeThreadRef,
  scopedThreadKey,
} from "@t3tools/client-runtime/environment";
import { threadWokeAt } from "@t3tools/client-runtime/state/thread-settled";
import { useNewThreadHandler } from "../../hooks/useHandleNewThread";
import { useThreadRouteTarget } from "../../hooks/useThreadRouteTarget";
import { readThreadShells, useQuietThreadShell } from "../../state/entities";
import { useComposerDraftStore } from "../../composerDraftStore";
import { buildThreadRouteParams } from "../../threadRoutes";
import {
  CheckIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  LayoutGridIcon,
  MessageCircleQuestionIcon,
} from "lucide-react";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useSidebarProjectGroups } from "../../hooks/useSidebarProjectGroups";
import { useRecentProjectKeys } from "../../hooks/useRecentProjectKeys";
import { defaultScopeProjects, projectKeyOf } from "../sidebar/recentProjects";
import { useUiStateStore } from "../../uiStateStore";
import { useThreadSelectionStore } from "../../threadSelectionStore";
import { ProjectFavicon } from "../ProjectFavicon";
import { resolveThreadLastVisitedAt, resolveThreadTopStatus } from "../Sidebar.logic";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import {
  Dialog,
  DialogPortal,
  DialogBackdrop,
  DialogViewport,
  renderRetainedPopup,
} from "../ui/dialog";
import { StageBackdropArt } from "../SidebarStageBackdrop";
import styles from "./projectSwitcher.module.css";
import raobarAvatar from "./raobar-avatar.png";
import { useSidebar } from "../ui/sidebar";
import { toastManager } from "../ui/toast";
import type { SidebarProjectSnapshot } from "../../sidebarProjectGrouping";
import {
  advanceProjectSelection,
  countProjectThreads,
  latestProjectThread,
  orderRecentProjects,
  rememberRecentProject,
  projectSwitcherCandidates,
  resolveFocusedProject,
  sumThreadCounts,
  type ThreadCounts,
} from "./projectSwitcher.logic";
import { useProjectSwitcherPreference } from "./useProjectSwitcherPreference";

const ALL_PROJECTS_KEY = "t4:all-selected-projects";
type SwitchOption = { key: string; label: string; project: SidebarProjectSnapshot | null };
type SwitchSession = {
  options: readonly SwitchOption[];
  selected: string;
  counts: ReadonlyMap<string, ThreadCounts>;
};

const NO_THREADS: ThreadCounts = { input: 0, working: 0, done: 0 };
const THREAD_COUNT_ROWS = [
  { key: "input", label: "Input", Icon: MessageCircleQuestionIcon },
  { key: "working", label: "Working", Icon: CircleDashedIcon },
  { key: "done", label: "Done", Icon: CircleCheckIcon },
] as const;

// Read when the switcher opens or moves rather than subscribed, so a closed switcher costs nothing.
function readThreadCounts(projects: readonly SidebarProjectSnapshot[]) {
  const localLastVisitedAtById = useUiStateStore.getState().threadLastVisitedAtById;
  const now = new Date().toISOString();
  return countProjectThreads(readThreadShells(), projects, (thread) =>
    resolveThreadTopStatus(thread, {
      lastVisitedAt: resolveThreadLastVisitedAt(
        thread.lastVisitedAt,
        localLastVisitedAtById[scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id))],
      ),
      wokeAt: threadWokeAt(thread, { now }),
    }),
  );
}

function ThreadCountRows({ counts, id }: { counts: ThreadCounts; id?: string }) {
  return (
    <span id={id} className={styles["t4-switcher-counts"]}>
      {THREAD_COUNT_ROWS.map(({ key, label, Icon }) => (
        <span
          key={key}
          className={styles["t4-switcher-count"]}
          data-status={key}
          data-empty={counts[key] === 0 || undefined}
        >
          <Icon aria-hidden size={12} />
          <span>{label}</span>
          <span className={styles["t4-switcher-count-value"]}>{counts[key]}</span>
        </span>
      ))}
    </span>
  );
}

export function ProjectSwitcher() {
  const projects = useSidebarProjectGroups();
  const filterKeys = useUiStateStore((state) => state.sidebarProjectScopeKeys);
  const recentProjectKeys = useRecentProjectKeys(projects);
  const focusedKey = useUiStateStore((state) => state.sidebarFocusedProjectKey);
  const setFocusedKey = useUiStateStore((state) => state.setSidebarFocusedProjectKey);
  const clearThreadSelection = useThreadSelectionStore((state) => state.clearSelection);
  const allProjectsLabel =
    filterKeys.length > 0
      ? "All selected projects"
      : recentProjectKeys.size > 0
        ? "All recent projects"
        : "All projects";
  const navigate = useNavigate();
  const openDraft = useNewThreadHandler();
  const routeTarget = useThreadRouteTarget();
  const routeThread = useQuietThreadShell(
    routeTarget?.kind === "server" ? routeTarget.threadRef : null,
  );
  const routeDraft = useComposerDraftStore((state) =>
    routeTarget?.kind === "draft" ? state.getDraftSession(routeTarget.draftId) : null,
  );
  const routeProject = routeThread ?? routeDraft;
  const candidates =
    filterKeys.length === 0
      ? defaultScopeProjects(projects, recentProjectKeys, projectKeyOf(projects, routeProject))
      : projectSwitcherCandidates(projects, filterKeys);
  const routeProjectKey =
    projects.find((project) =>
      project.memberProjectRefs.some(
        (ref) =>
          ref.projectId === routeProject?.projectId &&
          ref.environmentId === routeProject?.environmentId,
      ),
    )?.projectKey ?? null;
  const activeProject =
    resolveFocusedProject(projects, filterKeys, focusedKey)?.projectKey ?? routeProjectKey;
  const recentProjects = useRef<string[]>([]);
  // oxlint-disable-next-line t3code/react-effect-budget -- the active project also changes through sidebar clicks, the palette and links, which no handler here sees.
  useEffect(() => {
    recentProjects.current = rememberRecentProject(recentProjects.current, activeProject);
  }, [activeProject]);
  const [enabled] = useProjectSwitcherPreference();
  const [session, setSession] = useState<SwitchSession | null>(null);
  // Native IPC can deliver a quick cycle and release before React commits a render.
  const sessionRef = useRef<SwitchSession | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const { setOpen } = useSidebar();
  const close = () => {
    sessionRef.current = null;
    setSession(null);
  };
  const choose = (key: string) => {
    close();
    const project = candidates.find((candidate) => candidate.projectKey === key);
    if (key !== ALL_PROJECTS_KEY && !project) return;
    const previousKey =
      resolveFocusedProject(
        projects,
        filterKeys,
        useUiStateStore.getState().sidebarFocusedProjectKey,
      )?.projectKey ?? routeProjectKey;
    if (project) {
      recentProjects.current = rememberRecentProject(
        rememberRecentProject(recentProjects.current, previousKey),
        key,
      );
    }
    clearThreadSelection();
    setFocusedKey(key === ALL_PROJECTS_KEY ? null : key);
    setOpen(true);
    if (!project) return;
    const latest = latestProjectThread(readThreadShells(), project.memberProjectRefs);
    const opening = latest
      ? navigate({
          to: "/$environmentId/$threadId",
          params: buildThreadRouteParams(scopeThreadRef(latest.environmentId, latest.id)),
        })
      : openDraft(scopeProjectRef(project.environmentId, project.id));
    void opening.catch(() =>
      toastManager.add({
        type: "error",
        title: "Couldn’t open the thread",
        description: "Pick a thread in the sidebar to try again.",
      }),
    );
  };
  const onAction = useEffectEvent((action: string) => {
    if (!action.startsWith("t4.project-switcher.")) return;
    if (action.endsWith("unavailable")) {
      toastManager.add({
        type: "error",
        title: "Project shortcut unavailable",
        description:
          "⌥ Tab couldn’t be enabled. Check that no other app already uses this shortcut.",
      });
      return;
    }
    if (action.endsWith("cancel")) return close();
    if (action.endsWith("commit")) {
      if (sessionRef.current) choose(sessionRef.current.selected);
      return;
    }
    if (action.endsWith("next") || action.endsWith("previous")) {
      const current = sessionRef.current;
      const activeKey =
        resolveFocusedProject(
          projects,
          filterKeys,
          useUiStateStore.getState().sidebarFocusedProjectKey,
        )?.projectKey ?? routeProjectKey;
      // Freeze the MRU order while Option is held; only a committed choice changes it.
      const list: readonly SwitchOption[] = current?.options ?? [
        ...orderRecentProjects(candidates, recentProjects.current, activeKey).map((project) => ({
          key: project.projectKey,
          label: project.displayName,
          project,
        })),
        { key: ALL_PROJECTS_KEY, label: allProjectsLabel, project: null },
      ];
      const selected = advanceProjectSelection(
        list.map((option) => option.key),
        current?.selected ?? activeKey,
        action.endsWith("previous") ? -1 : 1,
      );
      if (selected === null) return;
      const next = {
        options: list,
        selected,
        counts: readThreadCounts(
          list.flatMap((option) => (option.project ? [option.project] : [])),
        ),
      };
      sessionRef.current = next;
      setSession(next);
    }
  });
  const available = enabled && candidates.length > 0;
  // oxlint-disable-next-line t3code/react-effect-budget -- subscribes to the native Option+Tab bridge, an external system.
  useEffect(() => {
    const bridge = window.desktopBridge;
    if (!bridge?.setProjectSwitcherEnabled) return;
    const unsubscribe = bridge.onMenuAction(onAction);
    bridge.setProjectSwitcherEnabled(available);
    return () => {
      bridge.setProjectSwitcherEnabled?.(false);
      unsubscribe();
    };
  }, [available]);

  const totalCounts = session ? sumThreadCounts(session.counts.values()) : NO_THREADS;
  const countsOf = (option: SwitchOption) =>
    option.project ? (session?.counts.get(option.key) ?? NO_THREADS) : totalCounts;
  const selectedOption = session?.options.find((option) => option.key === session.selected);

  return (
    <Dialog
      open={session !== null}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogViewport>
          <DialogPrimitive.Popup
            ref={popupRef}
            initialFocus={popupRef}
            className={styles["t4-project-switcher"]}
            render={renderRetainedPopup}
          >
            <header className={styles["t4-switcher-header"]}>
              <div className={styles["t4-switcher-sky"]} aria-hidden="true">
                <StageBackdropArt variant="nightly" />
              </div>
              <div className={styles["t4-switcher-heading"]}>
                <span className={styles["t4-switcher-eyebrow"]}>T4 · WORKSPACES</span>
                <DialogPrimitive.Title className={styles["t4-switcher-title"]}>
                  Switch project
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className={styles["t4-switcher-description"]}>
                  One project at a time. Keep the thread.
                </DialogPrimitive.Description>
              </div>
              <div className={styles["t4-switcher-shortcut"]} aria-label="Option Tab">
                <kbd>⌥</kbd>
                <kbd>Tab</kbd>
              </div>
            </header>
            <div
              className={styles["t4-switcher-projects"]}
              role="listbox"
              aria-label="Projects"
              aria-activedescendant={
                session
                  ? `switch-project-${session.options.findIndex((option) => option.key === session.selected)}`
                  : undefined
              }
            >
              {session?.options.map((option, index) => (
                <button
                  key={option.key}
                  id={`switch-project-${index}`}
                  type="button"
                  role="option"
                  aria-selected={option.key === session.selected}
                  aria-label={option.label}
                  aria-describedby={`switch-project-${index}-threads`}
                  ref={(element) => {
                    if (element && option.key === session.selected)
                      element.scrollIntoView({ block: "nearest", inline: "nearest" });
                  }}
                  onClick={() => choose(option.key)}
                  className={styles["t4-switcher-card"]}
                >
                  <span className={styles["t4-switcher-check"]} aria-hidden="true">
                    <CheckIcon size={10} strokeWidth={3} />
                  </span>
                  <span className={styles["t4-switcher-icon"]}>
                    {option.project ? (
                      <ProjectFavicon project={option.project} className="size-10.5" />
                    ) : (
                      <span className={styles["t4-switcher-all-icon"]}>
                        <LayoutGridIcon size={21} strokeWidth={1.5} />
                      </span>
                    )}
                  </span>
                  <span className={styles["t4-switcher-label"]}>{option.label}</span>
                  <ThreadCountRows
                    id={`switch-project-${index}-threads`}
                    counts={countsOf(option)}
                  />
                </button>
              ))}
            </div>
            <footer className={styles["t4-switcher-footer"]}>
              <div className={styles["t4-switcher-status"]} aria-live="polite">
                <span className={styles["t4-switcher-status-dot"]} aria-hidden="true" />
                <span className={styles["t4-switcher-status-label"]}>{selectedOption?.label}</span>
                {selectedOption ? <ThreadCountRows counts={countsOf(selectedOption)} /> : null}
              </div>
              <div className={styles["t4-switcher-bottom-line"]}>
                <div className={styles["t4-switcher-hints"]}>
                  <span>
                    Release <kbd>⌥</kbd> to switch
                  </span>
                  <span>
                    <kbd>⇧ Tab</kbd> back
                  </span>
                  <span>
                    <kbd>esc</kbd> cancel
                  </span>
                </div>
                <div className={styles["t4-switcher-credit"]}>
                  <span>
                    🚀 Powered by <strong>Raobar</strong>
                  </span>
                  <img src={raobarAvatar} alt="Portrait of Raobar" width={28} height={28} />
                </div>
              </div>
            </footer>
          </DialogPrimitive.Popup>
        </DialogViewport>
      </DialogPortal>
    </Dialog>
  );
}
