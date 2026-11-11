import type { OrchestrationV2ProjectedTurnItem, ThreadId } from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Semaphore from "effect/Semaphore";
import * as Schema from "effect/Schema";
import * as SubscriptionRef from "effect/SubscriptionRef";
import { Atom } from "effect/reactivity";
import type { HttpClient } from "effect/http";

import * as RemoteAuthorization from "../authorization/service.ts";
import type * as EnvironmentRegistry from "../connection/registry.ts";
import * as EnvironmentSupervisor from "../connection/supervisor.ts";
import * as ManagedRelay from "../relay/managedRelay.ts";
import { fetchEnvironmentBoundedThreadSnapshot } from "./boundedThreadSnapshotHttp.ts";
import { fetchEnvironmentThreadHistoryPage } from "./threadHistoryHttp.ts";
import { createEnvironmentQueryAtomFamily } from "./runtime.ts";

type ReplyPage = {
  readonly items: ReadonlyArray<OrchestrationV2ProjectedTurnItem>;
  readonly cursor: string | null;
};

export class ThreadMessageReadError extends Schema.TaggedError<ThreadMessageReadError>()(
  "ThreadMessageReadError",
  { message: Schema.String },
) {}

/** Read conversation pages only until the requested message is found; never load tool output or full history. */
export const readLatestThreadMessageAt = Effect.fn("ThreadAge.readLatestThreadMessageAt")(
  function* <E, R>(input: {
    readonly basis: "assistant_reply" | "conversation_activity";
    readonly first: Effect.Effect<ReplyPage, E, R>;
    readonly earlier: (cursor: string) => Effect.Effect<ReplyPage, E, R>;
  }) {
    let page = yield* input.first;
    const visited = new Set<string>();
    while (true) {
      let latest: number | null = null;
      for (const { item } of page.items) {
        if (
          (item.type !== "assistant_message" &&
            !(input.basis === "conversation_activity" && item.type === "user_message")) ||
          (item.text.trim().length === 0 && (item.attachments?.length ?? 0) === 0)
        )
          continue;
        const timestamp = DateTime.toEpochMillis(item.updatedAt);
        latest = latest === null ? timestamp : Math.max(latest, timestamp);
      }
      if (latest !== null || page.cursor === null) return latest;
      if (visited.has(page.cursor))
        return yield* new ThreadMessageReadError({
          message: "Conversation history did not advance.",
        });
      visited.add(page.cursor);
      page = yield* input.earlier(page.cursor);
    }
  },
);

export function createLatestThreadMessageAtoms<R, ER>(
  runtime: Atom.AtomRuntime<
    EnvironmentRegistry.EnvironmentRegistry | HttpClient.HttpClient | R,
    ER
  >,
) {
  const reads = Semaphore.makeUnsafe(4);
  return createEnvironmentQueryAtomFamily(runtime, {
    label: "environment-data:latest-thread-message",
    idleTtlMs: 60_000,
    execute: (input: {
      readonly threadId: ThreadId;
      readonly messageVersion: string;
      readonly basis: "assistant_reply" | "conversation_activity";
    }) =>
      reads.withPermits(1)(
        Effect.gen(function* () {
          const supervisor = yield* EnvironmentSupervisor.EnvironmentSupervisor;
          const prepared = yield* SubscriptionRef.get(supervisor.prepared);
          if (Option.isNone(prepared))
            return yield* new ThreadMessageReadError({ message: "Environment is not connected." });
          const signer = yield* Effect.serviceOption(ManagedRelay.ManagedRelayDpopSigner);
          const remoteAuthorization = yield* Effect.serviceOption(
            RemoteAuthorization.RemoteEnvironmentAuthorization,
          );
          const target = {
            prepared: prepared.value,
            threadId: input.threadId,
            signer,
            remoteAuthorization,
          };
          return yield* readLatestThreadMessageAt({
            basis: input.basis,
            first: fetchEnvironmentBoundedThreadSnapshot(target).pipe(
              Effect.map((snapshot) => ({
                items: snapshot.projection.visibleTurnItems,
                cursor: snapshot.hasMoreHistory ? snapshot.historyCursor : null,
              })),
            ),
            earlier: (cursor) =>
              fetchEnvironmentThreadHistoryPage({ ...target, cursor, view: "conversation" }).pipe(
                Effect.map((page) => ({
                  items: page.items,
                  cursor: page.hasMoreHistory ? page.nextCursor : null,
                })),
              ),
          });
        }),
      ),
  });
}
