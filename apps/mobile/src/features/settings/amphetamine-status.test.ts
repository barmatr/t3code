import { describe, expect, it, vi } from "vite-plus/test";

import {
  amphetamineRefreshIntervalMs,
  createAmphetamineReader,
  includesAmphetamineEnvironment,
  readAmphetamineConfig,
  remainingAmphetamineSeconds,
} from "./amphetamine-status";

const config = {
  url: "https://mac.test.ts.net:18443/v1/amphetamine",
  environmentId: "mac",
};

describe("Amphetamine settings status", () => {
  it("targets the configured Mac within the current settings scope", () => {
    const target = (environmentId: string, os: string) => ({
      environmentId,
      serverConfig: { environment: { platform: { os } } },
    });
    expect(includesAmphetamineEnvironment(config, [target("mac", "darwin")])).toBe(true);
    expect(includesAmphetamineEnvironment(config, [target("mac", "linux")])).toBe(false);
    expect(includesAmphetamineEnvironment(config, [target("other-mac", "darwin")])).toBe(false);
    expect(includesAmphetamineEnvironment(config, [])).toBe(false);
  });

  it("accepts an HTTPS origin on Tailscale and rejects unexpected origins", () => {
    expect(readAmphetamineConfig("https://mac.test.ts.net:18443", "mac")).toEqual(config);
    expect(readAmphetamineConfig("http://mac.test.ts.net", "mac")).toBeNull();
    expect(readAmphetamineConfig("https://mac.test.ts.net.example.com", "mac")).toBeNull();
    expect(readAmphetamineConfig("https://name@mac.test.ts.net", "mac")).toBeNull();
    expect(readAmphetamineConfig("https://mac.test.ts.net/path", "mac")).toBeNull();
    expect(readAmphetamineConfig("https://mac.test.ts.net", "")).toBeNull();
  });

  it("shares the pending and cached request until ten minutes after receipt", async () => {
    let now = 10_000;
    const send = vi.fn(async () => {
      now += 300;
      return Response.json({
        version: 1,
        environmentId: "mac",
        status: "timed",
        remainingSeconds: 120,
      });
    });
    const read = createAmphetamineReader(config, send, () => now);
    const pending = read();
    expect(read()).toBe(pending);
    const sample = await pending;
    expect(remainingAmphetamineSeconds(sample, now + 60_000)).toBe(60);
    expect(remainingAmphetamineSeconds(sample, now + 130_000)).toBe(0);
    now += amphetamineRefreshIntervalMs - 1;
    expect(await read()).toBe(sample);
    expect(send).toHaveBeenCalledTimes(1);
    now += 1;
    await read();
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("treats failures, mismatched environments and malformed durations as unavailable", async () => {
    const examples = [
      { version: 1, environmentId: "other", status: "unlimited" },
      { version: 1, environmentId: "mac", status: "timed", remainingSeconds: -1 },
      { version: 2, environmentId: "mac", status: "closed" },
    ];
    for (const response of examples) {
      const read = createAmphetamineReader(config, async () => Response.json(response));
      expect((await read()).status).toEqual({ status: "unavailable" });
    }
    const unreachable = createAmphetamineReader(config, async () => {
      throw new Error("offline");
    });
    expect((await unreachable()).status).toEqual({ status: "unavailable" });
  });
});
