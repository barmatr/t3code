export const amphetamineRefreshIntervalMs = 10 * 60_000;
const maxRemainingSeconds = 2 ** 31 - 1;
const statusPath = "/v1/amphetamine";

export interface AmphetamineConfig {
  readonly url: string;
  readonly environmentId: string;
}

const simpleStates = [
  "unlimited",
  "trigger",
  "conditional",
  "inactive",
  "closed",
  "unavailable",
] as const;

type AmphetamineStatus =
  | { readonly status: (typeof simpleStates)[number] }
  | { readonly status: "timed"; readonly remainingSeconds: number };

export interface AmphetamineSample {
  readonly status: AmphetamineStatus;
  readonly receivedAt: number;
}

export function readAmphetamineConfig(
  origin: unknown,
  environmentId: unknown,
): AmphetamineConfig | null {
  if (typeof origin !== "string" || typeof environmentId !== "string" || !environmentId.trim()) {
    return null;
  }

  try {
    const url = new URL(origin.trim());
    if (
      url.protocol !== "https:" ||
      !url.hostname.endsWith(".ts.net") ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      return null;
    }
    return { url: `${url.origin}${statusPath}`, environmentId: environmentId.trim() };
  } catch {
    return null;
  }
}

export function includesAmphetamineEnvironment(
  config: AmphetamineConfig,
  targets: readonly {
    readonly environmentId: string;
    readonly serverConfig: { readonly environment: { readonly platform: { readonly os: string } } };
  }[],
) {
  return targets.some(
    (target) =>
      target.environmentId === config.environmentId &&
      target.serverConfig.environment.platform.os === "darwin",
  );
}

function decodeStatus(value: unknown, environmentId: string): AmphetamineStatus {
  if (
    typeof value !== "object" ||
    value === null ||
    !("version" in value) ||
    value.version !== 1 ||
    !("environmentId" in value) ||
    value.environmentId !== environmentId ||
    !("status" in value)
  ) {
    return { status: "unavailable" };
  }

  if (
    value.status === "timed" &&
    "remainingSeconds" in value &&
    typeof value.remainingSeconds === "number" &&
    Number.isInteger(value.remainingSeconds) &&
    value.remainingSeconds >= 0 &&
    value.remainingSeconds <= maxRemainingSeconds
  ) {
    return { status: "timed", remainingSeconds: value.remainingSeconds };
  }

  const status = simpleStates.find((state) => state === value.status);
  return { status: status ?? "unavailable" };
}

export function createAmphetamineReader(
  config: AmphetamineConfig,
  request = globalThis.fetch,
  now = Date.now,
) {
  const fetchStatus = async (): Promise<AmphetamineStatus> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6_000);
    try {
      const response = await request(config.url, {
        signal: controller.signal,
        credentials: "omit",
        redirect: "error",
        headers: { Accept: "application/json" },
      });
      if (response.ok) return decodeStatus(await response.json(), config.environmentId);
    } catch {
      // Show an unavailable status when the private route or probe cannot answer.
    } finally {
      clearTimeout(timeout);
    }
    return { status: "unavailable" };
  };

  let cached: Promise<AmphetamineSample> | undefined;
  let receivedAt: number | undefined;
  return () => {
    if (
      cached === undefined ||
      (receivedAt !== undefined && now() - receivedAt >= amphetamineRefreshIntervalMs)
    ) {
      receivedAt = undefined;
      cached = fetchStatus().then((status) => {
        receivedAt = now();
        return { status, receivedAt };
      });
    }
    return cached;
  };
}

export function remainingAmphetamineSeconds(sample: AmphetamineSample, now: number): number | null {
  if (sample.status.status !== "timed") return null;

  const elapsed = Math.floor(Math.max(0, now - sample.receivedAt) / 1000);
  return Math.max(0, sample.status.remainingSeconds - elapsed);
}
