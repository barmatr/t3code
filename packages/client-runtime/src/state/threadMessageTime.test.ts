import { expect, it } from "@effect/vitest";
import {
  MessageId,
  RunId,
  TurnItemId,
  type OrchestrationV2ProjectedTurnItem,
} from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { readLatestThreadMessageAt } from "./threadMessageTime.ts";
import { v2Now, v2ThreadId } from "./orchestrationV2TestFixtures.ts";

function reply(updatedAt: string, text = "Réponse de démonstration") {
  return {
    position: 0,
    visibility: "local",
    sourceThreadId: v2ThreadId,
    sourceItemId: TurnItemId.make("reply"),
    item: {
      id: TurnItemId.make("reply"),
      threadId: v2ThreadId,
      runId: RunId.make("run"),
      nodeId: null,
      providerThreadId: null,
      providerTurnId: null,
      nativeItemRef: null,
      parentItemId: null,
      ordinal: 1,
      status: "completed",
      title: null,
      startedAt: v2Now,
      completedAt: v2Now,
      updatedAt: DateTime.makeUnsafe(updatedAt),
      type: "assistant_message",
      messageId: MessageId.make("message"),
      text,
      streaming: false,
    },
  } satisfies OrchestrationV2ProjectedTurnItem;
}

it.effect("finds a reply behind newer user messages without reading the rest of the history", () =>
  Effect.gen(function* () {
    const expected = "2026-06-20T00:00:40.000Z";
    const recentUserMessage: OrchestrationV2ProjectedTurnItem = {
      ...reply("2026-06-20T00:01:00.000Z"),
      item: {
        ...reply("2026-06-20T00:01:00.000Z").item,
        type: "user_message",
        createdBy: "user",
        creationSource: "mobile",
        inputIntent: "turn_start",
        attachments: [],
      },
    };
    const activity = yield* readLatestThreadMessageAt({
      basis: "conversation_activity",
      first: Effect.succeed({ items: [recentUserMessage], cursor: "previous" }),
      earlier: () => Effect.die("The latest activity is already on the first page"),
    });
    expect(activity).toBe(Date.parse("2026-06-20T00:01:00.000Z"));
    const result = yield* readLatestThreadMessageAt({
      basis: "assistant_reply",
      first: Effect.succeed({ items: [recentUserMessage], cursor: "previous" }),
      earlier: (cursor) =>
        cursor === "previous"
          ? Effect.succeed({
              items: [reply(expected), reply("2026-06-20T00:00:10.000Z")],
              cursor: "unused",
            })
          : Effect.die("Should stop at the latest reply"),
    });
    expect(result).toBe(Date.parse(expected));
  }),
);

it.effect("excludes empty assistant placeholders and reports no reply at the end of history", () =>
  Effect.gen(function* () {
    const result = yield* readLatestThreadMessageAt({
      basis: "assistant_reply",
      first: Effect.succeed({ items: [reply("2026-06-20T00:00:40.000Z", " ")], cursor: null }),
      earlier: () => Effect.die("No history remains"),
    });
    expect(result).toBeNull();
  }),
);

it.effect("fails instead of repeatedly reading a cursor that does not advance", () =>
  Effect.gen(function* () {
    const result = yield* readLatestThreadMessageAt({
      basis: "assistant_reply",
      first: Effect.succeed({ items: [], cursor: "stuck" }),
      earlier: () => Effect.succeed({ items: [], cursor: "stuck" }),
    }).pipe(Effect.flip);
    expect(result.message).toBe("Conversation history did not advance.");
  }),
);
