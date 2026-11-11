import * as NodeAssert from "node:assert/strict";
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeChildProcess from "node:child_process";

const root = process.argv[2];
const plist = (path) =>
  JSON.parse(
    NodeChildProcess.execFileSync("plutil", ["-convert", "json", "-o", "-", path], {
      encoding: "utf8",
    }),
  );
const info = plist(NodePath.join(root, "T4Mobile/Info.plist"));
const schemes = info.CFBundleURLTypes.flatMap((entry) => entry.CFBundleURLSchemes ?? []);
NodeAssert.ok(schemes.includes("t4code"));
NodeAssert.ok(!schemes.some((scheme) => scheme.startsWith("t3code")));
NodeAssert.ok(!info.NSSupportsLiveActivities);
const entitlements = plist(NodePath.join(root, "T4Mobile/T4Mobile.entitlements"));
for (const key of [
  "aps-environment",
  "com.apple.developer.applesignin",
  "com.apple.security.application-groups",
  "com.apple.developer.associated-domains",
]) {
  NodeAssert.equal(entitlements[key], undefined, key);
}
const updates = plist(NodePath.join(root, "T4Mobile/Supporting/Expo.plist"));
NodeAssert.equal(updates.EXUpdatesEnabled, false);
NodeAssert.equal(updates.EXUpdatesURL, undefined);
const project = NodeFS.readFileSync(
  NodePath.join(root, "T4Mobile.xcodeproj/project.pbxproj"),
  "utf8",
);
NodeAssert.ok(project.includes("fr.emaxconseils.t4"));
NodeAssert.ok(project.includes("GY9P9U75F3"));
for (const forbidden of [
  "com.t3tools.t3code",
  "ARK85ZXQ4Z",
  "expo-sharing-extension",
  "ExpoWidgetsTarget",
]) {
  NodeAssert.ok(!project.includes(forbidden), forbidden);
}
console.log(
  "Projet Xcode T4 vérifié : équipe EMAX configurée, liens T4 et absence des extensions cloud.",
);
