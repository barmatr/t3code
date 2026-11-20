export const THREAD_AGE_OPTIONS = [
  { id: "all", label: "All Ages", durationMs: null },
  { id: "10m", label: "Last 10 minutes", durationMs: 10 * 60_000 },
  { id: "1h", label: "Last hour", durationMs: 60 * 60_000 },
  { id: "1d", label: "Last day", durationMs: 24 * 60 * 60_000 },
  { id: "5d", label: "Last 5 days", durationMs: 5 * 24 * 60 * 60_000 },
  // T4 : the reverse filter, threads older than 5 days.
  { id: "older5d", label: "> 5 days", durationMs: 5 * 24 * 60 * 60_000, older: true },
] as const;

export type ThreadAge = (typeof THREAD_AGE_OPTIONS)[number]["id"];
export type ThreadAgeBasis = "assistant_reply" | "conversation_activity";

export function isThreadAge(value: string): value is ThreadAge {
  return THREAD_AGE_OPTIONS.some((option) => option.id === value);
}

export function threadAgeOption(age: ThreadAge) {
  return THREAD_AGE_OPTIONS.find((option) => option.id === age)!;
}

/** Whether the filter keeps threads older than its duration rather than newer ones. */
export function isOlderThreadAge(age: ThreadAge): boolean {
  const option = threadAgeOption(age);
  return "older" in option && option.older;
}

/** T4 : "Last week" became "Last 5 days"; a saved "1w" reads as that. */
export function migrateThreadAge(age: string | undefined): ThreadAge | undefined {
  if (age === "1w") return "5d";
  return age !== undefined && isThreadAge(age) ? age : undefined;
}
