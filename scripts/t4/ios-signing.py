#!/usr/bin/env python3
"""Find an installed App Store profile for T4 without reading private keys."""

import datetime
import json
import plistlib
import subprocess
import sys
from pathlib import Path

TEAM = "GY9P9U75F3"
BUNDLE = "fr.emaxconseils.t4"
profiles = []
for folder in (
    "~/Library/MobileDevice/Provisioning Profiles",
    "~/Library/Developer/Xcode/UserData/Provisioning Profiles",
):
    for path in Path(folder).expanduser().glob("*.mobileprovision"):
        result = subprocess.run(
            ["security", "cms", "-D", "-i", str(path)], capture_output=True
        )
        if result.returncode:
            continue
        data = plistlib.loads(result.stdout)
        entitlements = data.get("Entitlements", {})
        if (
            TEAM in data.get("TeamIdentifier", [])
            and entitlements.get("application-identifier") == f"{TEAM}.{BUNDLE}"
            and not entitlements.get("get-task-allow", False)
            and not data.get("ProvisionedDevices")
            and not data.get("ProvisionsAllDevices", False)
            and data.get("ExpirationDate", datetime.datetime.min)
            > datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
        ):
            profiles.append(data)

if not profiles:
    print(
        f"Profil App Store manquant pour {BUNDLE}, équipe {TEAM}. "
        "Créer cet identifiant et son profil de distribution dans le compte Apple EMAX, "
        "puis installer le .mobileprovision sur ce Mac. Le profil de Plume ne convient pas.",
        file=sys.stderr,
    )
    sys.exit(1)

profile = max(profiles, key=lambda item: item["ExpirationDate"])
if "--uuid" in sys.argv:
    print(profile["UUID"])
else:
    print(json.dumps({"profile": profile["Name"], "expires": str(profile["ExpirationDate"])}))
