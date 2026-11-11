export const THREAD_AGE_OPTIONS = [
  { id: "all", label: "All Ages", durationMs: null },
  { id: "10m", label: "Last 10 minutes", durationMs: 10 * 60_000 },
  { id: "1h", label: "Last hour", durationMs: 60 * 60_000 },
  { id: "1d", label: "Last day", durationMs: 24 * 60 * 60_000 },
  { id: "1w", label: "Last week", durationMs: 7 * 24 * 60 * 60_000 },
] as const;

export type ThreadAge = (typeof THREAD_AGE_OPTIONS)[number]["id"];
export type ThreadAgeBasis = "assistant_reply" | "conversation_activity";

export function isThreadAge(value: string): value is ThreadAge {
  return THREAD_AGE_OPTIONS.some((option) => option.id === value);
}

export function threadAgeOption(age: ThreadAge) {
  return THREAD_AGE_OPTIONS.find((option) => option.id === age)!;
}
