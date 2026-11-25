import { RegistryContext, useAtomValue } from "@effect/atom-react";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import * as DateTime from "effect/DateTime";
import * as Option from "effect/Option";
import { AsyncResult, Atom } from "effect/reactivity";
import { useContext, useMemo, useState } from "react";

import { useNowAfter, useNowMinuteMs } from "../../lib/clock";
import { isOlderThreadAge, threadAgeOption, type ThreadAge } from "../../lib/thread-age";
import { mobilePreferencesAtom } from "../../state/preferences";
import { latestThreadMessageAtom } from "../../state/thread-age-filter";

// Since October 1, the largest observed message lag on the Mac was 4 h 02 (rounded up).
// A future lag over six hours can hide a recent reply until the thread updates.
const THREAD_TIMESTAMP_GRACE_MS = 6 * 60 * 60_000;

export function useThreadAgeFilter(
  threads: ReadonlyArray<EnvironmentThreadShell>,
  age: ThreadAge,
  pendingCreatedAt: ReadonlyArray<string>,
) {
  const registry = useContext(RegistryContext);
  const minuteMs = useNowMinuteMs();
  const [latestMs, setLatestMs] = useState(Date.now);
  const [retainedTimes, setRetainedTimes] = useState<ReadonlyMap<string, number | null>>(
    () => new Map(),
  );
  const afterMs = Math.max(latestMs, minuteMs);
  const durationMs = threadAgeOption(age).durationMs;
  const older = isOlderThreadAge(age);
  const readAtom = useMemo(
    () =>
      Atom.make((get) => {
        const preferences = get(mobilePreferencesAtom);
        const basis = AsyncResult.isSuccess(preferences)
          ? (preferences.value.threadAgeBasis ?? "assistant_reply")
          : "assistant_reply";
        const reads: Array<ReturnType<typeof latestThreadMessageAtom>> = [];
        const pendingThreads = new Set<EnvironmentThreadShell>();
        const outsideWindow = new Set<EnvironmentThreadShell>();
        let pending = false;
        let failed = false;
        const times = new Map<EnvironmentThreadShell, number | null>();
        const previousTimes = new Map<EnvironmentThreadShell, number | null>();
        if (durationMs !== null) {
          const cutoff = afterMs - durationMs;
          for (const thread of threads) {
            const message = thread.source.latestVisibleMessage;
            if (basis === "conversation_activity" && message !== null) {
              times.set(thread, DateTime.toEpochMillis(message.updatedAt));
            } else if (message?.role === "assistant" && message.text.trim().length > 0) {
              times.set(thread, DateTime.toEpochMillis(message.updatedAt));
            } else if (
              message !== null
                ? DateTime.toEpochMillis(message.updatedAt) > cutoff
                : thread.source.visibleItemCount > 0 || thread.source.itemCount > 0
            ) {
              if (
                !older &&
                message === null &&
                Date.parse(thread.updatedAt) < cutoff - THREAD_TIMESTAMP_GRACE_MS &&
                (basis !== "conversation_activity" || Date.parse(thread.createdAt) <= cutoff)
              ) {
                outsideWindow.add(thread);
                continue;
              }
              // Current servers omit message bodies from shell rows. Read bounded
              // conversation pages; thread metadata can also change without a reply.
              const atom = latestThreadMessageAtom({
                environmentId: thread.environmentId,
                input: {
                  threadId: thread.id,
                  basis,
                  messageVersion: JSON.stringify([
                    thread.updatedAt,
                    thread.source.visibleItemCount,
                    thread.source.itemCount,
                    message?.id,
                    message === null ? null : DateTime.formatIso(message.updatedAt),
                  ]),
                },
              });
              reads.push(atom);
              const result = get(atom);
              if (result.waiting) pending = true;
              if (result.waiting || AsyncResult.isInitial(result)) pendingThreads.add(thread);
              if (AsyncResult.isSuccess(result)) {
                const timestamp =
                  result.value ??
                  (basis === "conversation_activity" || older
                    ? Date.parse(thread.createdAt)
                    : null);
                times.set(thread, timestamp);
              } else if (AsyncResult.isFailure(result)) {
                failed = true;
                const previous = AsyncResult.value(result);
                if (Option.isSome(previous)) {
                  previousTimes.set(
                    thread,
                    previous.value ??
                      (basis === "conversation_activity" ? Date.parse(thread.createdAt) : null),
                  );
                }
              } else pending = true;
            } else if (basis === "conversation_activity" && message === null) {
              times.set(thread, Date.parse(thread.createdAt));
            } else {
              // T4 : for "> 5 days", a thread with no reply in range is old; date it by
              // its last message or its creation.
              times.set(
                thread,
                older
                  ? message !== null
                    ? DateTime.toEpochMillis(message.updatedAt)
                    : Date.parse(thread.createdAt)
                  : null,
              );
            }
          }
        }
        return {
          times,
          previousTimes,
          reads,
          pendingThreads,
          outsideWindow,
          pending,
          failed,
          basis,
        };
      }),
    [threads, durationMs, older, afterMs],
  );
  const state = useAtomValue(readAtom);
  const resolved = useMemo(() => {
    const retained = new Map<string, number | null>();
    const times = new Map<EnvironmentThreadShell, number>();
    let checking = false;
    for (const thread of threads) {
      const key = JSON.stringify([thread.environmentId, thread.id, state.basis]);
      // A new query version must not erase a date already checked for this thread.
      // Keep null answers too, so an older previousSuccess cannot resurrect a row.
      const timestamp = state.times.has(thread)
        ? state.times.get(thread)
        : retainedTimes.has(key)
          ? retainedTimes.get(key)
          : state.previousTimes.get(thread);
      if (timestamp !== undefined) {
        retained.set(key, timestamp);
        if (timestamp !== null && !state.outsideWindow.has(thread)) times.set(thread, timestamp);
      } else if (state.pendingThreads.has(thread)) checking = true;
    }
    return { retained, times, checking };
  }, [
    threads,
    state.times,
    state.previousTimes,
    state.pendingThreads,
    state.outsideWindow,
    state.basis,
    retainedTimes,
  ]);
  // Bound retention to the current candidates and basis. Adjust before commit so
  // a transient query state never reaches the list as an artificial removal.
  if (
    retainedTimes.size !== resolved.retained.size ||
    [...resolved.retained].some(([key, timestamp]) => retainedTimes.get(key) !== timestamp)
  ) {
    setRetainedTimes(resolved.retained);
  }
  const deadlines =
    durationMs === null
      ? []
      : [
          ...[...resolved.times.values()].map((timestamp) => timestamp + durationMs),
          ...(state.basis === "conversation_activity"
            ? pendingCreatedAt.map((timestamp) => Date.parse(timestamp) + durationMs)
            : []),
        ];
  let nextDeadline: number | null = null;
  for (const deadline of deadlines) {
    if (deadline > afterMs && (nextDeadline === null || deadline < nextDeadline))
      nextDeadline = deadline;
  }
  const nowMs = Math.max(useNowAfter(nextDeadline), minuteMs, latestMs);
  if (nowMs !== latestMs) setLatestMs(nowMs);
  const filteredThreads = useMemo(
    () =>
      durationMs === null
        ? threads
        : threads.filter((thread) => {
            const timestamp = resolved.times.get(thread);
            if (timestamp === undefined) return false;
            return older ? timestamp <= nowMs - durationMs : timestamp > nowMs - durationMs;
          }),
    [threads, durationMs, older, resolved.times, nowMs],
  );

  return {
    threads: filteredThreads,
    pending: state.pending,
    checking: resolved.checking,
    failed: state.failed,
    basis: state.basis,
    older,
    cutoff: durationMs === null ? null : nowMs - durationMs,
    retry: () => {
      for (const atom of state.reads) registry.refresh(atom);
    },
  };
}
