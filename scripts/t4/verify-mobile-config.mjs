import * as NodeAssert from "node:assert/strict";
import * as NodeFS from "node:fs";

const config = JSON.parse(NodeFS.readFileSync(process.argv[2], "utf8"));
NodeAssert.equal(config.name, "T4 Mobile");
NodeAssert.equal(config.scheme, "t4code");
NodeAssert.equal(config.ios.bundleIdentifier, "fr.emaxconseils.t4");
NodeAssert.equal(config.ios.appleTeamId, "GY9P9U75F3");
NodeAssert.equal(config.android.package, "fr.emaxconseils.t4");
NodeAssert.match(config.ios.buildNumber, /^\d+$/);
NodeAssert.equal(config.updates.enabled, false);
NodeAssert.equal(config.updates.url, undefined);
NodeAssert.equal(config.extra.eas?.projectId, undefined);
NodeAssert.equal(config.owner, undefined);
NodeAssert.equal(config.extra.iosLocalOnlyBuild, true);
NodeAssert.equal(config.extra.relay.url, undefined);
NodeAssert.equal(config.extra.clerk.publishableKey, undefined);
NodeAssert.equal(config.extra.eas.observe.endpointUrl, "https://observe.invalid");
NodeAssert.deepEqual(config.ios.associatedDomains, []);
NodeAssert.deepEqual(config.android.intentFilters, []);
NodeAssert.deepEqual(config.ios.entitlements["keychain-access-groups"], [
  "$(AppIdentifierPrefix)fr.emaxconseils.t4",
]);
console.log("Configuration T4/EMAX vérifiée : identité, stockage, liens et mises à jour isolés.");
