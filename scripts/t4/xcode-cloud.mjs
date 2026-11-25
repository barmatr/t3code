#!/usr/bin/env node
// Delivers T4 Mobile through Xcode Cloud: starts the workflow, follows the run,
// then proves the build reached the internal TestFlight group.
import * as NodeChildProcess from "node:child_process";
import * as NodeCrypto from "node:crypto";
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

const root = NodePath.resolve(NodePath.dirname(NodeURL.fileURLToPath(import.meta.url)), "../..");
const apiBase = "https://api.appstoreconnect.apple.com/v1/";
const appId = "6832960692";
const bundleId = "fr.emaxconseils.t4";
const issuerId = "091aa7cb-a286-4f8a-a612-52d3fc18387e";
const groupId = "2caea9a3-c476-464e-a0f9-0be680a5b06a";
const groupName = "T4 Interne";
const repository = "barmatr/t3code";
const remote = "fork";
const scheme = "T4Mobile";
const container = "apps/mobile/ios/T4Mobile.xcworkspace";
const usage =
  "Usage : node scripts/t4/xcode-cloud.mjs {check|deliver [--branch B] [--workflow NOM] [--dry-run] --confirm-app-id 6832960692|watch RUN_ID --confirm-app-id 6832960692|status RUN_ID}";

class Refusal extends Error {}

// App Store Connect tokens live ten minutes; a run lasts longer, so sign per request.
function createApi() {
  // A worktree has no ignored files: T4_ASC_ENV_FILE points at the main checkout's copy.
  const envFile =
    process.env.T4_ASC_ENV_FILE ?? NodePath.resolve(root, ".env.app-store-connect.local");
  if (!NodeFS.existsSync(envFile))
    throw new Refusal(`Configuration App Store Connect introuvable : ${envFile}.`);
  if ((NodeFS.statSync(envFile).mode & 0o077) !== 0)
    throw new Refusal("Le fichier .env.app-store-connect.local doit être en mode 600.");
  const config = Object.fromEntries(
    NodeFS.readFileSync(envFile, "utf8")
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]),
  );
  if (
    config.ASC_ISSUER_ID !== issuerId ||
    config.ASC_APP_ID !== appId ||
    config.ASC_BUNDLE_ID !== bundleId
  )
    throw new Refusal(
      "Refus : configuration différente du compte EMAX et de la fiche T4 attendus.",
    );
  const keyPath = config.ASC_PRIVATE_KEY_PATH;
  if (!keyPath || !/^[A-Z0-9]{10}$/.test(config.ASC_KEY_ID ?? ""))
    throw new Refusal("Clé API non configurée.");
  if ((NodeFS.statSync(keyPath).mode & 0o077) !== 0)
    throw new Refusal("La clé privée doit être en mode 600.");
  const key = NodeCrypto.createPrivateKey(NodeFS.readFileSync(keyPath));
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = () => {
    const now = Math.floor(Date.now() / 1000);
    const unsigned = `${encode({ alg: "ES256", kid: config.ASC_KEY_ID, typ: "JWT" })}.${encode({ iss: issuerId, iat: now - 5, exp: now + 600, aud: "appstoreconnect-v1" })}`;
    return `${unsigned}.${NodeCrypto.sign("sha256", Buffer.from(unsigned), { key, dsaEncoding: "ieee-p1363" }).toString("base64url")}`;
  };
  const request = async (method, path, body) => {
    const url = path.startsWith(apiBase) ? path : `${apiBase}${path}`;
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token()}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(30000),
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : undefined };
  };
  return { get: (path) => request("GET", path), post: (path, body) => request("POST", path, body) };
}

function createSystem() {
  const git = (...args) =>
    NodeChildProcess.execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  const appStoreConnect = (...args) =>
    NodeChildProcess.execFileSync(
      "node",
      [NodePath.join(root, "scripts/t4/app-store-connect.mjs"), ...args],
      { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
    );
  return {
    git,
    appStoreConnect,
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    now: () => new Date(),
    log: (line) => console.log(line),
    writeProof: (buildNumber, name, content) => {
      const directory = NodePath.join(root, "build/xcode-cloud", `build-${buildNumber}`);
      NodeFS.mkdirSync(directory, { recursive: true });
      NodeFS.writeFileSync(NodePath.join(directory, name), content);
      return NodePath.join(directory, name);
    },
  };
}

function expectOk(response, what) {
  if (response.status < 200 || response.status > 299) {
    const detail = response.body?.errors?.map((error) => error.detail ?? error.title).join(" ; ");
    throw new Error(
      `App Store Connect : HTTP ${response.status} pour ${what}${detail ? ` (${detail})` : ""}.`,
    );
  }
  return response.body;
}

async function listAll(api, path, what) {
  const items = [];
  for (let next = path; next;) {
    const page = expectOk(await api.get(next), what);
    items.push(...page.data);
    next = page.links?.next;
  }
  return items;
}

async function readProduct(api) {
  const app = expectOk(await api.get(`apps/${appId}`), "la fiche T4").data;
  if (app.attributes.bundleId !== bundleId)
    throw new Refusal("La fiche Apple ne correspond pas à T4.");
  const response = await api.get(`apps/${appId}/ciProduct`);
  if (response.status === 404 || (response.status === 200 && !response.body?.data))
    return undefined;
  return expectOk(response, "le produit Xcode Cloud").data;
}

const archiveAction = (workflow) =>
  workflow.attributes.actions?.find((action) => action.actionType === "ARCHIVE");

function describeWorkflow(workflow, included = []) {
  const related = (name) =>
    included.find((item) => item.id === workflow.relationships?.[name]?.data?.id)?.attributes;
  const action = archiveAction(workflow);
  return {
    id: workflow.id,
    name: workflow.attributes.name,
    enabled: workflow.attributes.isEnabled,
    lockedForEditing: workflow.attributes.isLockedForEditing,
    clean: workflow.attributes.clean,
    container: workflow.attributes.containerFilePath,
    archiveScheme: action?.scheme,
    archiveAudience: action?.buildDistributionAudience,
    manualBranches: workflow.attributes.manualBranchStartCondition?.source,
    startsOnPush: Boolean(workflow.attributes.branchStartCondition),
    xcode: related("xcodeVersion")?.name ?? related("xcodeVersion")?.version,
    macOs: related("macOsVersion")?.name ?? related("macOsVersion")?.version,
  };
}

async function readWorkflows(api, productId) {
  const page = expectOk(
    await api.get(`ciProducts/${productId}/workflows?limit=50&include=xcodeVersion,macOsVersion`),
    "les workflows",
  );
  return page.data.map((workflow) => ({
    raw: workflow,
    ...describeWorkflow(workflow, page.included),
  }));
}

function chooseWorkflow(workflows, wantedName) {
  const candidates = workflows.filter(
    (workflow) =>
      workflow.archiveScheme === scheme && (wantedName ? workflow.name === wantedName : true),
  );
  if (candidates.length !== 1)
    throw new Refusal(
      `${candidates.length} workflow(s) archivent ${scheme}${wantedName ? ` sous le nom « ${wantedName} »` : ""} : en indiquer un seul avec --workflow NOM (${workflows.map((workflow) => workflow.name).join(", ") || "aucun workflow"}).`,
    );
  const [workflow] = candidates;
  if (!workflow.enabled) throw new Refusal(`Le workflow « ${workflow.name} » est désactivé.`);
  if (workflow.container !== container)
    throw new Refusal(
      `Le workflow « ${workflow.name} » vise ${workflow.container}, pas ${container}.`,
    );
  if (workflow.archiveAudience !== "INTERNAL_ONLY")
    throw new Refusal(
      `Le workflow « ${workflow.name} » ne prépare pas l’archive pour « TestFlight (Internal Testing Only) ».`,
    );
  return workflow;
}

async function readRepository(api, productId) {
  const repositories = expectOk(
    await api.get(`ciProducts/${productId}/primaryRepositories`),
    "le dépôt du produit",
  ).data;
  const found = repositories.find(
    (item) => `${item.attributes.ownerName}/${item.attributes.repositoryName}` === repository,
  );
  if (!found) throw new Refusal(`Le produit Xcode Cloud n’est pas relié à ${repository}.`);
  return found;
}

async function latestTestFlightBuildNumber(api) {
  const builds = expectOk(
    await api.get(`builds?filter[app]=${appId}&sort=-uploadedDate&limit=20`),
    "les builds TestFlight",
  ).data;
  return Math.max(0, ...builds.map((build) => Number(build.attributes.version) || 0));
}

function readSource(system, branchArgument) {
  const branch = branchArgument ?? system.git("rev-parse", "--abbrev-ref", "HEAD");
  if (branch === "HEAD") throw new Refusal("HEAD détaché : indiquer --branch.");
  const commit = system.git("rev-parse", branch);
  if (!branchArgument && system.git("status", "--porcelain", "--untracked-files=no"))
    throw new Refusal(
      "Des modifications ne sont pas commitées : Xcode Cloud ne construit que ce qui est poussé.",
    );
  const pushed = system.git("ls-remote", remote, `refs/heads/${branch}`).split(/\s/)[0];
  if (pushed !== commit)
    throw new Refusal(
      `La branche ${branch} n’est pas à jour sur ${remote} (local ${commit.slice(0, 10)}, distant ${pushed ? pushed.slice(0, 10) : "absent"}) : pousser avant de livrer.`,
    );
  return { branch, commit };
}

const seconds = (start, end) =>
  start && end ? Math.round((Date.parse(end) - Date.parse(start)) / 1000) : undefined;

async function followRun(api, system, runId) {
  let last = "";
  for (let failures = 0, waited = 0; waited < 110 * 60; waited += 30) {
    const response = await api.get(`ciBuildRuns/${runId}`).catch((error) => ({ status: 0, error }));
    if (response.status !== 200) {
      if (++failures > 5)
        throw new Error(`Lecture du run ${runId} impossible (HTTP ${response.status}).`);
    } else {
      failures = 0;
      const { executionProgress, completionStatus, number } = response.body.data.attributes;
      const state = `${executionProgress}${completionStatus ? ` / ${completionStatus}` : ""}`;
      if (state !== last) system.log(`Run ${number} : ${state} (${system.now().toISOString()}).`);
      last = state;
      if (executionProgress === "COMPLETE") return response.body.data;
    }
    await system.sleep(30000);
  }
  throw new Error(
    `Le run ${runId} n’est pas terminé après 110 minutes : le suivre avec watch ${runId}.`,
  );
}

async function readActions(api, runId) {
  const actions = await listAll(api, `ciBuildRuns/${runId}/actions?limit=50`, "les actions du run");
  return Promise.all(
    actions.map(async (action) => {
      const failed = !["SUCCEEDED", undefined, null].includes(action.attributes.completionStatus);
      const issues = failed
        ? expectOk(await api.get(`ciBuildActions/${action.id}/issues?limit=20`), "les erreurs").data
        : [];
      return {
        id: action.id,
        name: action.attributes.name,
        type: action.attributes.actionType,
        status: action.attributes.completionStatus,
        seconds: seconds(action.attributes.startedDate, action.attributes.finishedDate),
        issues: issues.map(
          (issue) => `${issue.attributes.issueType} : ${issue.attributes.message}`,
        ),
      };
    }),
  );
}

async function waitForBuild(api, system, runId) {
  for (let waited = 0; waited < 40 * 60; waited += 30) {
    const builds = expectOk(
      await api.get(`ciBuildRuns/${runId}/builds?limit=10`),
      "les builds du run",
    ).data;
    const failed = builds.find((build) =>
      ["FAILED", "INVALID"].includes(build.attributes.processingState),
    );
    if (failed)
      throw new Error(
        `Apple a rejeté le build ${failed.id} : ${failed.attributes.processingState}.`,
      );
    const valid = builds.find((build) => build.attributes.processingState === "VALID");
    if (valid) return valid;
    if (builds.length === 0 && waited >= 15 * 60)
      throw new Error(
        "Le run a réussi sans créer de build App Store Connect : vérifier la préparation « TestFlight (Internal Testing Only) » de l’action d’archive.",
      );
    await system.sleep(30000);
  }
  throw new Error("Le traitement Apple du build dépasse 40 minutes.");
}

function lastJsonLine(output) {
  return JSON.parse(output.trim().split("\n").at(-1));
}

async function proveDelivery(api, system, run, context) {
  const number = run.attributes.number;
  const actions = await readActions(api, run.id);
  const record = {
    runId: run.id,
    runNumber: number,
    workflow: context.workflow,
    branch: context.branch,
    sourceCommit: run.attributes.sourceCommit?.commitSha,
    startReason: run.attributes.startReason,
    createdAt: run.attributes.createdDate,
    startedAt: run.attributes.startedDate,
    finishedAt: run.attributes.finishedDate,
    completionStatus: run.attributes.completionStatus,
    wallSeconds: seconds(run.attributes.startedDate, run.attributes.finishedDate),
    computeSeconds: actions.reduce((total, action) => total + (action.seconds ?? 0), 0),
    actions,
  };
  system.writeProof(number, "xcode-cloud-run.json", `${JSON.stringify(record, null, 2)}\n`);
  if (run.attributes.completionStatus !== "SUCCEEDED") {
    for (const action of actions)
      for (const issue of action.issues) system.log(`${action.name} — ${issue}`);
    throw new Error(
      `Le run Xcode Cloud ${number} s’est terminé en ${run.attributes.completionStatus}.`,
    );
  }
  const build = await waitForBuild(api, system, run.id);
  let status = lastJsonLine(system.appStoreConnect("status", build.id));
  let distribution;
  if (!status.groupIds.includes(groupId)) {
    distribution = system.appStoreConnect(
      "distribute",
      build.id,
      "--confirm-app-id",
      appId,
      "--confirm-group-id",
      groupId,
    );
    system.writeProof(number, "apple-distribution.jsonl", distribution);
    status = lastJsonLine(system.appStoreConnect("status", build.id));
  }
  system.writeProof(number, "apple-final-status.json", `${JSON.stringify(status, null, 2)}\n`);
  const available =
    status.processingState === "VALID" &&
    !status.expired &&
    status.groupIds.includes(groupId) &&
    ["READY_FOR_BETA_TESTING", "IN_BETA_TESTING"].includes(status.beta?.internalBuildState);
  if (!available)
    throw new Error(
      `Le build ${status.buildNumber} n’est pas disponible pour ${groupName} : voir apple-final-status.json.`,
    );
  if (Number(status.buildNumber) !== number)
    throw new Error(`Numéro inattendu : run ${number}, build Apple ${status.buildNumber}.`);
  const deployment = {
    verifiedAt: system.now().toISOString(),
    channel: "xcode-cloud",
    version: status.version,
    build: number,
    appleBuildId: build.id,
    group: groupName,
    groupId,
    sourceCommit: record.sourceCommit,
    branch: context.branch,
    xcodeCloud: "xcode-cloud-run.json",
    status: "apple-final-status.json",
    ...(distribution ? { distribution: "apple-distribution.jsonl" } : {}),
    autoNotifyEnabled: status.beta?.autoNotifyEnabled,
  };
  const path = system.writeProof(
    number,
    "deployment.json",
    `${JSON.stringify(deployment, null, 2)}\n`,
  );
  system.log(`Build ${status.version} (${number}) disponible pour ${groupName}. Preuve : ${path}`);
  return deployment;
}

function parseOptions(args) {
  const options = { positional: [] };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--dry-run") options.dryRun = true;
    else if (["--branch", "--workflow", "--confirm-app-id"].includes(arg))
      options[arg] = args[++index];
    else if (arg.startsWith("--")) throw new Refusal(`Option inconnue : ${arg}.\n${usage}`);
    else options.positional.push(arg);
  }
  return options;
}

export async function run(argv, api, system) {
  const [command = "check", ...rest] = argv;
  const options = parseOptions(rest);
  const runId = options.positional[0];
  if (!["check", "deliver", "watch", "status"].includes(command)) throw new Refusal(usage);
  if (["watch", "status"].includes(command) && !/^[a-f0-9-]{36}$/i.test(runId ?? ""))
    throw new Refusal("Indiquer l’identifiant du run Xcode Cloud.");
  if (
    ["deliver", "watch"].includes(command) &&
    !options.dryRun &&
    options["--confirm-app-id"] !== appId
  )
    throw new Refusal(`La livraison exige --confirm-app-id ${appId}.`);

  if (command === "status") {
    const data = expectOk(await api.get(`ciBuildRuns/${runId}`), "le run").data;
    system.log(
      JSON.stringify({ runId, ...data.attributes, actions: await readActions(api, runId) }),
    );
    return;
  }
  if (command === "watch") {
    const current = await followRun(api, system, runId);
    const workflow = expectOk(
      await api.get(`ciBuildRuns/${runId}?include=workflow,sourceBranchOrTag`),
      "le run",
    );
    const name = (type) => workflow.included?.find((item) => item.type === type)?.attributes.name;
    return proveDelivery(api, system, current, {
      workflow: name("ciWorkflows"),
      branch: name("scmGitReferences"),
    });
  }

  const product = await readProduct(api);
  if (command === "check") {
    const xcodeVersions = expectOk(
      await api.get("ciXcodeVersions?limit=200"),
      "les versions de Xcode",
    ).data;
    const report = {
      appId,
      product: product ? { id: product.id, name: product.attributes.name } : null,
      xcodeVersionsOffered: xcodeVersions.map((version) => version.attributes.name),
    };
    if (product) {
      report.workflows = (await readWorkflows(api, product.id)).map(
        ({ raw: _raw, ...rest }) => rest,
      );
      report.repository = (await readRepository(api, product.id)).attributes.httpCloneUrl;
      report.latestTestFlightBuild = await latestTestFlightBuildNumber(api);
    }
    system.log(JSON.stringify(report, null, 2));
    if (!product)
      system.log("Produit Xcode Cloud absent : le premier workflow se crée dans Xcode.");
    return report;
  }

  const source = readSource(system, options["--branch"]);
  if (!product)
    throw new Refusal(
      "Produit Xcode Cloud absent : créer le premier workflow dans Xcode avant de livrer.",
    );
  const workflow = chooseWorkflow(await readWorkflows(api, product.id), options["--workflow"]);
  const repo = await readRepository(api, product.id);
  const references = await listAll(
    api,
    `scmRepositories/${repo.id}/gitReferences?limit=200`,
    "les branches",
  );
  const reference = references.find(
    (item) =>
      item.attributes.kind === "BRANCH" &&
      item.attributes.name === source.branch &&
      !item.attributes.isDeleted,
  );
  if (!reference)
    throw new Refusal(`Xcode Cloud ne connaît pas la branche ${source.branch} de ${repository}.`);
  const latestBuild = await latestTestFlightBuildNumber(api);
  const previousRuns = expectOk(
    await api.get(`ciProducts/${product.id}/buildRuns?sort=-number&limit=1`),
    "les runs précédents",
  ).data;
  const lastRunNumber = previousRuns[0]?.attributes.number;
  if (lastRunNumber !== undefined && lastRunNumber + 1 <= latestBuild)
    throw new Refusal(
      `Le prochain numéro Xcode Cloud (${lastRunNumber + 1}) ne dépasse pas le dernier build TestFlight (${latestBuild}) : régler « Next Build Number » à ${latestBuild + 1} dans App Store Connect.`,
    );
  const body = {
    data: {
      type: "ciBuildRuns",
      attributes: {},
      relationships: {
        workflow: { data: { type: "ciWorkflows", id: workflow.id } },
        sourceBranchOrTag: { data: { type: "scmGitReferences", id: reference.id } },
      },
    },
  };
  system.log(
    JSON.stringify({
      workflow: workflow.name,
      xcode: workflow.xcode,
      ...source,
      latestTestFlightBuild: latestBuild,
      lastRunNumber,
    }),
  );
  if (options.dryRun) {
    system.log(`Essai à blanc : POST ciBuildRuns non envoyé.\n${JSON.stringify(body, null, 2)}`);
    return { dryRun: true, body };
  }
  const started = expectOk(await api.post("ciBuildRuns", body), "le lancement du build").data;
  system.log(
    `Run ${started.attributes.number} lancé : ${started.id}. Reprise possible avec watch ${started.id}.`,
  );
  if (started.attributes.number <= latestBuild)
    system.log(
      `ATTENTION : le numéro ${started.attributes.number} ne dépasse pas ${latestBuild} ; Apple refusera l’envoi. Annuler ce run dans App Store Connect et régler « Next Build Number ».`,
    );
  const finished = await followRun(api, system, started.id);
  return proveDelivery(api, system, finished, { workflow: workflow.name, branch: source.branch });
}

if (process.argv[1] && NodeURL.pathToFileURL(process.argv[1]).href === import.meta.url) {
  Promise.resolve()
    .then(() => run(process.argv.slice(2), createApi(), createSystem()))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
