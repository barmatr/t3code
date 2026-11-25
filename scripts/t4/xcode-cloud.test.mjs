import { describe, expect, it } from "vite-plus/test";

import { run } from "./xcode-cloud.mjs";

const appId = "6832960692";
const groupId = "2caea9a3-c476-464e-a0f9-0be680a5b06a";
const runId = "574f26a1-193c-409e-98ab-33ed4105a2ff";
const buildId = "9e1ef577-14f6-41bb-8411-9077bb235cf6";
const commit = "f26eb20b514716c4e40b2ec3cae9ec1238c29c40";
const ok = (data, extra = {}) => ({ status: 200, body: { data, ...extra } });

// Shapes follow Apple's OpenAPI specification 4.6.1 for the Xcode Cloud resources.
function setup({ lastRunNumber, latestBuild = 32, runStates, groupIdsByStatusCall = [[groupId]] }) {
  const posts = [];
  const proofs = {};
  const logs = [];
  const states = [...runStates];
  const statusCalls = [...groupIdsByStatusCall];
  const calls = [];
  const runData = (attributes) => ({
    id: runId,
    attributes: {
      number: 33,
      startReason: "MANUAL",
      createdDate: "2026-11-26T09:00:00Z",
      startedDate: "2026-11-26T09:00:30Z",
      finishedDate: null,
      sourceCommit: { commitSha: commit },
      ...attributes,
    },
  });
  const routes = [
    [/^apps\/\d+$/, () => ok({ id: appId, attributes: { bundleId: "fr.emaxconseils.t4" } })],
    [/^apps\/\d+\/ciProduct$/, () => ok({ id: "product", attributes: { name: "T4 Mobile" } })],
    [
      /^ciProducts\/product\/workflows/,
      () =>
        ok(
          [
            {
              id: "workflow",
              attributes: {
                name: "TestFlight interne",
                isEnabled: true,
                containerFilePath: "apps/mobile/ios/T4Mobile.xcworkspace",
                actions: [
                  {
                    actionType: "ARCHIVE",
                    scheme: "T4Mobile",
                    buildDistributionAudience: "INTERNAL_ONLY",
                  },
                ],
              },
              relationships: { xcodeVersion: { data: { id: "xcode" } } },
            },
          ],
          { included: [{ id: "xcode", attributes: { name: "Xcode 27.2" } }] },
        ),
    ],
    [
      /^ciProducts\/product\/primaryRepositories/,
      () => ok([{ id: "repo", attributes: { ownerName: "barmatr", repositoryName: "t3code" } }]),
    ],
    [
      /^scmRepositories\/repo\/gitReferences/,
      () =>
        ok([{ id: "other", attributes: { kind: "BRANCH", name: "t4", isDeleted: false } }], {
          links: { next: "https://api.appstoreconnect.apple.com/v1/next-page" },
        }),
    ],
    [
      /next-page$/,
      () =>
        ok([
          {
            id: "reference",
            attributes: { kind: "BRANCH", name: "t4-mobile-4682", isDeleted: false },
          },
        ]),
    ],
    [
      /^builds\?/,
      () =>
        ok([{ attributes: { version: String(latestBuild) } }, { attributes: { version: "9" } }]),
    ],
    [
      /^ciProducts\/product\/buildRuns/,
      () => ok(lastRunNumber === undefined ? [] : [{ attributes: { number: lastRunNumber } }]),
    ],
    [
      /^ciBuildRuns\/[a-f0-9-]+(\?.*)?$/,
      () => ok(runData(states.length > 1 ? states.shift() : states[0])),
    ],
    [
      /^ciBuildRuns\/[a-f0-9-]+\/actions/,
      () =>
        ok([
          {
            id: "action",
            attributes: {
              name: "Archive - iOS",
              actionType: "ARCHIVE",
              completionStatus: states[0].completionStatus,
              startedDate: "2026-11-26T09:01:00Z",
              finishedDate: "2026-11-26T09:19:00Z",
            },
          },
        ]),
    ],
    [
      /^ciBuildActions\/action\/issues/,
      () =>
        ok([
          { attributes: { issueType: "ERROR", message: "Command PhaseScriptExecution failed" } },
        ]),
    ],
    [
      /^ciBuildRuns\/[a-f0-9-]+\/builds/,
      () => ok([{ id: buildId, attributes: { processingState: "VALID" } }]),
    ],
  ];
  const api = {
    get: async (path) => {
      calls.push(path);
      const route = routes.find(([pattern]) => pattern.test(path));
      return route ? route[1]() : { status: 404, body: { errors: [{ detail: path }] } };
    },
    post: async (path, body) => {
      posts.push({ path, body });
      return { status: 201, body: { data: runData({ executionProgress: "PENDING" }) } };
    },
  };
  const system = {
    git: (...args) => {
      if (args[0] === "status") return "";
      if (args[0] === "ls-remote") return `${commit}\trefs/heads/t4-mobile-4682`;
      return args.includes("--abbrev-ref") ? "t4-mobile-4682" : commit;
    },
    appStoreConnect: (command) => {
      calls.push(`asc ${command}`);
      if (command === "distribute") return '{"associated":true}\n';
      const groupIds = statusCalls.length > 1 ? statusCalls.shift() : statusCalls[0];
      return `{"authenticated":true}\n${JSON.stringify({
        buildId,
        version: "0.1.0",
        buildNumber: "33",
        processingState: "VALID",
        expired: false,
        beta: { autoNotifyEnabled: false, internalBuildState: "IN_BETA_TESTING" },
        groupIds,
      })}\n`;
    },
    sleep: async () => {},
    now: () => new Date("2026-11-26T09:30:00Z"),
    log: (line) => logs.push(line),
    writeProof: (number, name, content) => {
      proofs[`build-${number}/${name}`] = content;
      return `build-${number}/${name}`;
    },
  };
  return { api, system, posts, proofs, logs, calls };
}

const succeeded = [
  { executionProgress: "PENDING" },
  { executionProgress: "RUNNING" },
  {
    executionProgress: "COMPLETE",
    completionStatus: "SUCCEEDED",
    finishedDate: "2026-11-26T09:20:00Z",
  },
];

describe("xcode-cloud deliver", () => {
  it("starts the workflow on the pushed branch and records the delivery proof", async () => {
    const context = setup({ runStates: succeeded, groupIdsByStatusCall: [[], [groupId]] });
    await run(["deliver", "--confirm-app-id", appId], context.api, context.system);

    expect(context.posts).toEqual([
      {
        path: "ciBuildRuns",
        body: {
          data: {
            type: "ciBuildRuns",
            attributes: {},
            relationships: {
              workflow: { data: { type: "ciWorkflows", id: "workflow" } },
              sourceBranchOrTag: { data: { type: "scmGitReferences", id: "reference" } },
            },
          },
        },
      },
    ]);
    expect(context.calls.filter((call) => call.startsWith("asc"))).toEqual([
      "asc status",
      "asc distribute",
      "asc status",
    ]);
    expect(JSON.parse(context.proofs["build-33/deployment.json"])).toMatchObject({
      channel: "xcode-cloud",
      build: 33,
      appleBuildId: buildId,
      groupId,
      sourceCommit: commit,
      distribution: "apple-distribution.jsonl",
    });
    expect(JSON.parse(context.proofs["build-33/xcode-cloud-run.json"])).toMatchObject({
      completionStatus: "SUCCEEDED",
      computeSeconds: 1080,
    });
  });

  it("sends nothing in a dry run", async () => {
    const context = setup({ runStates: succeeded });
    const result = await run(["deliver", "--dry-run"], context.api, context.system);

    expect(context.posts).toEqual([]);
    expect(result.body.data.relationships.sourceBranchOrTag.data.id).toBe("reference");
  });

  it("refuses to start when the next Xcode Cloud number is already taken in TestFlight", async () => {
    const context = setup({ runStates: succeeded, lastRunNumber: 12 });

    await expect(
      run(["deliver", "--confirm-app-id", appId], context.api, context.system),
    ).rejects.toThrow("Next Build Number");
    expect(context.posts).toEqual([]);
  });

  it("keeps the failure evidence and reports the build errors", async () => {
    const context = setup({
      runStates: [{ executionProgress: "COMPLETE", completionStatus: "FAILED" }],
    });

    await expect(
      run(["watch", runId, "--confirm-app-id", appId], context.api, context.system),
    ).rejects.toThrow("FAILED");
    expect(context.logs.join("\n")).toContain("PhaseScriptExecution");
    expect(context.proofs["build-33/deployment.json"]).toBeUndefined();
    expect(JSON.parse(context.proofs["build-33/xcode-cloud-run.json"]).completionStatus).toBe(
      "FAILED",
    );
  });
});
