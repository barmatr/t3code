#!/usr/bin/env node
import * as NodeCrypto from "node:crypto";
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeChildProcess from "node:child_process";
import * as NodeURL from "node:url";

const root = NodePath.resolve(NodePath.dirname(NodeURL.fileURLToPath(import.meta.url)), "../..");
const appId = "6832960692";
const bundleId = "fr.emaxconseils.t4";
const issuerId = "091aa7cb-a286-4f8a-a612-52d3fc18387e";
const groupId = "2caea9a3-c476-464e-a0f9-0be680a5b06a";
const [command = "check", ipaArgument, confirmation, confirmedId, ...options] =
  process.argv.slice(2);

async function main() {
  if (!["check", "validate", "upload", "status", "distribute"].includes(command)) {
    throw new Error(
      "Usage : node scripts/t4/app-store-connect.mjs {check|validate IPA|upload IPA --confirm-app-id 6832960692|status BUILD_ID|distribute BUILD_ID --confirm-app-id 6832960692 [--confirm-group-id 2caea9a3-c476-464e-a0f9-0be680a5b06a]}",
    );
  }
  if (
    ["upload", "distribute"].includes(command) &&
    (confirmation !== "--confirm-app-id" || confirmedId !== appId)
  ) {
    throw new Error(
      "L’envoi exige --confirm-app-id 6832960692 et une autorisation explicite de Raoul.",
    );
  }
  if (["status", "distribute"].includes(command) && !/^[a-f0-9-]{36}$/i.test(ipaArgument ?? ""))
    throw new Error("Indiquer l’UUID Apple du build.");
  const confirmedGroup =
    command === "distribute" &&
    options.length === 2 &&
    options[0] === "--confirm-group-id" &&
    options[1] === groupId;
  if (options.length !== 0 && !confirmedGroup)
    throw new Error("Options inconnues ou groupe interne T4 non confirmé.");
  let ipa;
  if (["validate", "upload"].includes(command)) {
    if (!ipaArgument) throw new Error("Indiquer le chemin de l’IPA T4.");
    ipa = NodePath.resolve(ipaArgument);
    const inspection = NodeChildProcess.spawnSync(
      "python3",
      [
        "-c",
        `
import json, plistlib, re, sys, zipfile
with zipfile.ZipFile(sys.argv[1]) as z:
    matches = [n for n in z.namelist() if re.fullmatch(r'Payload/[^/]+[.]app/Info[.]plist', n)]
    if len(matches) != 1:
        raise SystemExit('IPA invalide : une seule app principale est attendue.')
    p = plistlib.loads(z.read(matches[0]))
    print(json.dumps({k:p.get(k) for k in ('CFBundleIdentifier','CFBundleShortVersionString','CFBundleVersion')}))
`,
        ipa,
      ],
      { encoding: "utf8" },
    );
    if (inspection.status !== 0) throw new Error(inspection.stderr.trim() || "IPA illisible.");
    const metadata = JSON.parse(inspection.stdout);
    if (metadata.CFBundleIdentifier !== bundleId)
      throw new Error("Refus : cette IPA ne correspond pas à T4 Mobile.");
    console.log(JSON.stringify({ ipa, ...metadata }));
  }
  const envFile = NodePath.resolve(root, ".env.app-store-connect.local");
  if ((NodeFS.statSync(envFile).mode & 0o077) !== 0)
    throw new Error("Le fichier .env.app-store-connect.local doit être en mode 600.");
  const config = Object.fromEntries(
    NodeFS.readFileSync(envFile, "utf8")
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const separator = line.indexOf("=");
        if (separator < 1) throw new Error("Configuration App Store Connect invalide.");
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
  if (
    config.ASC_ISSUER_ID !== issuerId ||
    config.ASC_APP_ID !== appId ||
    config.ASC_BUNDLE_ID !== bundleId
  ) {
    throw new Error("Refus : configuration différente du compte EMAX et de la fiche T4 attendus.");
  }
  const keyPath = config.ASC_PRIVATE_KEY_PATH;
  if (!keyPath || !/^[A-Z0-9]{10}$/.test(config.ASC_KEY_ID ?? ""))
    throw new Error("Clé API non configurée.");
  if ((NodeFS.statSync(keyPath).mode & 0o077) !== 0)
    throw new Error("La clé privée doit être en mode 600.");
  const key = NodeCrypto.createPrivateKey(NodeFS.readFileSync(keyPath));
  if (key.asymmetricKeyDetails?.namedCurve !== "prime256v1") throw new Error("Clé ES256 attendue.");
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${encode({ alg: "ES256", kid: config.ASC_KEY_ID, typ: "JWT" })}.${encode({ iss: issuerId, iat: now - 5, exp: now + 600, aud: "appstoreconnect-v1" })}`;
  const token = `${unsigned}.${NodeCrypto.sign("sha256", Buffer.from(unsigned), { key, dsaEncoding: "ieee-p1363" }).toString("base64url")}`;
  async function get(path) {
    const response = await fetch(`https://api.appstoreconnect.apple.com/v1/${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok)
      throw new Error(`App Store Connect : HTTP ${response.status} pour ${path.split("?")[0]}.`);
    return response.json();
  }
  const app = (await get(`apps/${appId}`)).data;
  if (app.id !== appId || app.attributes.bundleId !== bundleId)
    throw new Error("La fiche Apple ne correspond pas à T4.");
  console.log(JSON.stringify({ authenticated: true, appId, bundleId, name: app.attributes.name }));
  if (command === "check") {
    const groups = (await get(`apps/${appId}/betaGroups`)).data;
    const builds = (await get(`builds?filter[app]=${appId}&limit=10`)).data;
    console.log(
      JSON.stringify({
        groups: groups.map(({ id, attributes: a }) => ({
          id,
          name: a.name,
          internal: a.isInternalGroup,
          automaticDistribution: a.hasAccessToAllBuilds,
          publicLinkEnabled: a.publicLinkEnabled,
        })),
        builds: builds.map(({ id, attributes: a }) => ({
          id,
          version: a.version,
          processingState: a.processingState,
        })),
      }),
    );
    return;
  }
  if (["status", "distribute"].includes(command)) {
    const buildId = ipaArgument;
    const result = await get(
      `builds/${buildId}?include=app,buildBetaDetail,preReleaseVersion,betaGroups`,
    );
    const build = result.data;
    if (build.relationships.app.data.id !== appId)
      throw new Error("Refus : ce build n’appartient pas à T4.");
    const included = result.included ?? [];
    const betaDetail = included.find((item) => item.type === "buildBetaDetails");
    const beta = betaDetail?.attributes;
    const release = included.find((item) => item.type === "preReleaseVersions")?.attributes;
    console.log(
      JSON.stringify({
        buildId,
        version: release?.version,
        buildNumber: build.attributes.version,
        processingState: build.attributes.processingState,
        audience: build.attributes.buildAudienceType,
        expired: build.attributes.expired,
        usesNonExemptEncryption: build.attributes.usesNonExemptEncryption,
        beta,
        groupIds: build.relationships.betaGroups.data.map((item) => item.id),
      }),
    );
    if (command === "status") return;
    if (build.attributes.processingState !== "VALID" || build.attributes.expired) {
      throw new Error(
        "Le build doit être traité, valide et non expiré avant distribution interne.",
      );
    }
    if (build.attributes.buildAudienceType !== "INTERNAL_ONLY" || !betaDetail) {
      throw new Error("Refus : seul un build TestFlight interne T4 peut être distribué ici.");
    }
    const group = (await get(`betaGroups/${groupId}?include=app,betaTesters`)).data;
    if (group.relationships.app.data.id !== appId || !group.attributes.isInternalGroup) {
      throw new Error("Refus : le groupe cible n’est pas le groupe interne T4 attendu.");
    }
    const testerCount = group.relationships.betaTesters.data.length;
    if (testerCount !== 0 && !confirmedGroup) {
      throw new Error(
        "Le groupe contient des testeurs : confirmer aussi --confirm-group-id 2caea9a3-c476-464e-a0f9-0be680a5b06a après autorisation de livraison par Raoul.",
      );
    }
    if (beta.autoNotifyEnabled !== false) {
      const notificationResponse = await fetch(
        `https://api.appstoreconnect.apple.com/v1/buildBetaDetails/${betaDetail.id}`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            data: {
              type: "buildBetaDetails",
              id: betaDetail.id,
              attributes: { autoNotifyEnabled: false },
            },
          }),
          signal: AbortSignal.timeout(30000),
        },
      );
      if (!notificationResponse.ok)
        throw new Error(`Désactivation des notifications : HTTP ${notificationResponse.status}.`);
    }
    const verifiedBeta = (await get(`buildBetaDetails/${betaDetail.id}`)).data;
    if (
      verifiedBeta.attributes.autoNotifyEnabled !== false ||
      !["READY_FOR_BETA_TESTING", "IN_BETA_TESTING"].includes(
        verifiedBeta.attributes.internalBuildState,
      )
    ) {
      throw new Error(
        "Le build interne doit être prêt et ses notifications automatiques désactivées.",
      );
    }
    const response = await fetch(
      `https://api.appstoreconnect.apple.com/v1/betaGroups/${groupId}/relationships/builds`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ data: [{ type: "builds", id: buildId }] }),
        signal: AbortSignal.timeout(30000),
      },
    );
    if (response.status !== 204)
      throw new Error(`Association au groupe interne : HTTP ${response.status}.`);
    const linked = (await get(`betaGroups/${groupId}/relationships/builds`)).data;
    if (!linked.some((item) => item.id === buildId))
      throw new Error("L’association du build reste non vérifiée.");
    console.log(
      JSON.stringify({
        buildId,
        groupId,
        associated: true,
        testerCount,
        autoNotifyEnabled: false,
        groupBuildIds: linked.map((item) => item.id),
      }),
    );
    return;
  }
  const args = command === "validate" ? ["--validate-app", ipa] : ["--upload-app", "-f", ipa];
  const result = NodeChildProcess.spawnSync(
    "xcrun",
    [
      "altool",
      ...args,
      "--api-key",
      config.ASC_KEY_ID,
      "--api-issuer",
      issuerId,
      "--p8-file-path",
      keyPath,
      "--output-format",
      "json",
    ],
    {
      stdio: "inherit",
      env: { ...process.env, API_PRIVATE_KEYS_DIR: NodePath.dirname(keyPath) },
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`altool a échoué (code ${result.status}).`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
