#!/bin/bash
set -euo pipefail

if [[ $# != 2 || -z "$2" ]]; then
  printf 'Usage : %s <dossier de sortie> <identifiant de l’environnement T3 du Mac>\n' "$0" >&2
  exit 2
fi

source_dir="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$1"
output_dir="$(cd "$1" && pwd)"
app_name="T4 Amphetamine Status.app"
app="$output_dir/$app_name"
launch_agent="$output_dir/fr.emaxconseils.t4.amphetamine-status.plist"

if [[ -e "$app" || -e "$launch_agent" ]]; then
  printf 'Le dossier de sortie contient déjà un livrable T4 Amphetamine Status.\n' >&2
  exit 1
fi

mkdir -p "$app/Contents/MacOS" "$app/Contents/Resources"
cp "$source_dir/Info.plist" "$app/Contents/Info.plist"
cp "$source_dir/service.py" "$app/Contents/Resources/service.py"
cp "$source_dir/automation.entitlements" "$output_dir/automation.entitlements"
/usr/bin/swiftc -O "$source_dir/read-session.swift" -o "$app/Contents/MacOS/read-session"

/usr/bin/python3 -I - "$HOME/Applications/$app_name" "$2" "$launch_agent" <<'PYTHON'
import pathlib
import plistlib
import sys

installed_app, environment_id, output = sys.argv[1:]
contents = pathlib.Path(installed_app) / "Contents"
label = "fr.emaxconseils.t4.amphetamine-status"
with open(output, "xb") as file:
    plistlib.dump({
        "Label": label,
        "AssociatedBundleIdentifiers": [label],
        "ProgramArguments": [
            "/usr/bin/python3", "-I", str(contents / "Resources" / "service.py"),
            "--environment-id", environment_id,
            "--probe", str(contents / "MacOS" / "read-session"),
        ],
        "RunAtLoad": True,
        "KeepAlive": True,
        "LimitLoadToSessionType": "Aqua",
        "ProcessType": "Background",
        "ThrottleInterval": 30,
    }, file)
PYTHON

printf 'Livrables préparés dans %s\n' "$output_dir"
