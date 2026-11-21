#!/usr/bin/env bash
# Local preparation only: no Apple upload, no EAS build, no provisioning mutation.
set -euo pipefail

ACTION="${1:-doctor}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MOBILE="${ROOT}/apps/mobile"
BUILD="${T4_IOS_BUILD_DIR:-${ROOT}/build/ios-local}"
DERIVED_DATA="${T4_IOS_DERIVED_DATA_PATH:-${BUILD}/DerivedData}"
TEAM="GY9P9U75F3"
BUNDLE="fr.emaxconseils.t4"
CERTIFICATE="Apple Distribution: emax conseils (${TEAM})"
SCHEME="T4Mobile"
export APP_VARIANT=production EXPO_NO_DOTENV=1 CI=1
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=6144}"

validate_config() {
  mkdir -p "${BUILD}"
  (cd "${MOBILE}" && vp exec expo config --type public --json) > "${BUILD}/expo-config.json"
  node "${ROOT}/scripts/t4/verify-mobile-config.mjs" "${BUILD}/expo-config.json"
}

doctor() {
  validate_config
  xcodebuild -version
  command -v pod >/dev/null
  security find-identity -v -p codesigning | grep -F "${CERTIFICATE}" >/dev/null || {
    echo "Certificat EMAX avec clé privée absent du Trousseau." >&2
    return 1
  }
  echo "Certificat EMAX présent."
  python3 "${ROOT}/scripts/t4/ios-signing.py"
}

prebuild() {
  validate_config
  (cd "${MOBILE}" && vp exec expo prebuild --platform ios --no-install)
  node "${ROOT}/scripts/t4/verify-native-ios.mjs" "${MOBILE}/ios"
  pod install --project-directory="${MOBILE}/ios"
  node "${ROOT}/scripts/t4/verify-native-ios.mjs" "${MOBILE}/ios"
}

archive() {
  local signed="$1"
  local signing_args=(CODE_SIGNING_ALLOWED=NO)
  if [[ "${signed}" == "yes" ]]; then
    doctor
    local profile_uuid
    profile_uuid="$(python3 "${ROOT}/scripts/t4/ios-signing.py" --uuid)"
    signing_args=()
  fi
  prebuild
  if [[ "${signed}" == "yes" ]]; then
    # A command-line profile would also reach Swift Package resource bundles.
    # Keep distribution signing on the application target only.
    ruby - "${MOBILE}/ios/${SCHEME}.xcodeproj" "${SCHEME}" "${BUNDLE}" \
      "${TEAM}" "${CERTIFICATE}" "${profile_uuid}" <<'RUBY'
require 'xcodeproj'
path, scheme, bundle, team, certificate, profile = ARGV
project = Xcodeproj::Project.open(path)
target = project.targets.find { |item| item.name == scheme }
abort 'Cible de signature T4 introuvable.' unless target
release = target.build_configurations.find { |item| item.name == 'Release' }
abort 'Configuration Release T4 inattendue.' unless release && release.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] == bundle
release.build_settings['CODE_SIGN_STYLE'] = 'Manual'
release.build_settings['DEVELOPMENT_TEAM'] = team
release.build_settings['CODE_SIGN_IDENTITY'] = certificate
release.build_settings['CODE_SIGN_IDENTITY[sdk=iphoneos*]'] = certificate
release.build_settings['PROVISIONING_PROFILE'] = profile
release.build_settings['PROVISIONING_PROFILE_SPECIFIER'] = profile
project.save
puts 'Signature de distribution configurée uniquement sur la cible T4 Mobile.'
RUBY
  fi
  local archive_path
  archive_path="${IOS_ARCHIVE_PATH:-${HOME}/Library/Developer/Xcode/Archives/$(date +%F)/T4 Mobile $(date +%H.%M.%S).xcarchive}"
  mkdir -p "$(dirname "${archive_path}")"
  xcodebuild -workspace "${MOBILE}/ios/${SCHEME}.xcworkspace" -scheme "${SCHEME}" \
    -jobs "${IOS_BUILD_JOBS:-4}" \
    -configuration Release -destination 'generic/platform=iOS' \
    -derivedDataPath "${DERIVED_DATA}" -archivePath "${archive_path}" \
    ${signing_args[@]+"${signing_args[@]}"} archive > "${BUILD}/archive.log" 2>&1 || {
      tail -65 "${BUILD}/archive.log" >&2
      return 1
    }
  printf '%s\n' "${archive_path}" > "${BUILD}/latest-archive.txt"
  if [[ "${signed}" == "yes" ]]; then
    codesign --verify --deep --strict "${archive_path}/Products/Applications/${SCHEME}.app"
    echo "Archive signée : ${archive_path}"
  else
    echo "Archive NON SIGNÉE : ${archive_path} (preuve de compilation uniquement)."
  fi
}

export_ipa() {
  doctor
  local archive_path="${IOS_ARCHIVE_PATH:-}"
  if [[ -z "${archive_path}" && -f "${BUILD}/latest-archive.txt" ]]; then
    archive_path="$(cat "${BUILD}/latest-archive.txt")"
  fi
  [[ -d "${archive_path}" ]] || { echo "Archive T4 introuvable." >&2; return 1; }
  local app="${archive_path}/Products/Applications/${SCHEME}.app"
  [[ "$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "${app}/Info.plist")" == "${BUNDLE}" ]] || {
    echo "L’archive ne correspond pas à T4 Mobile." >&2; return 1;
  }
  codesign --verify --deep --strict "${app}"
  local profile_uuid
  profile_uuid="$(python3 "${ROOT}/scripts/t4/ios-signing.py" --uuid)"
  cat > "${BUILD}/ExportOptions.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>method</key><string>app-store-connect</string>
  <key>destination</key><string>export</string>
  <key>teamID</key><string>${TEAM}</string>
  <key>signingStyle</key><string>manual</string>
  <key>signingCertificate</key><string>Apple Distribution</string>
  <key>provisioningProfiles</key><dict><key>${BUNDLE}</key><string>${profile_uuid}</string></dict>
  <key>testFlightInternalTestingOnly</key><true/>
  <key>manageAppVersionAndBuildNumber</key><true/>
</dict></plist>
PLIST
  xcodebuild -exportArchive -archivePath "${archive_path}" \
    -exportPath "${BUILD}/export" -exportOptionsPlist "${BUILD}/ExportOptions.plist"
  echo "IPA exportée localement ; aucun envoi effectué."
}

# Frees the disk once a build is confirmed available in TestFlight: compilation
# products are temporary. The newest archive and the newest IPA stay, so the live
# build can be sent again and its crash reports symbolicated.
clean() {
  local dry_run="no"
  [[ "${1:-}" == "--dry-run" ]] && dry_run="yes"
  local local_root="${ROOT}/build/ios-local"
  local derived="${T4_IOS_DERIVED_DATA_PATH:-${local_root}/DerivedData}"
  local archives="${T4_IOS_ARCHIVES_DIR:-${HOME}/Library/Developer/Xcode/Archives}"
  [[ "$(basename "${derived}")" == "DerivedData" ]] || {
    echo "Dossier de compilation inattendu : ${derived}" >&2; return 1;
  }
  if pgrep -x xcodebuild >/dev/null; then
    echo "Un build Xcode est en cours : relancer le nettoyage une fois ce build terminé." >&2
    return 1
  fi

  remove() {
    [[ -e "$1" ]] || return 0
    local size
    size="$(du -sh "$1" | cut -f1 | tr -d ' ')"
    if [[ "${dry_run}" == "yes" ]]; then
      echo "À supprimer (${size}) : $1"
    else
      rm -rf -- "$1"
      echo "Supprimé (${size}) : $1"
    fi
  }
  free_gb() { df -k "${ROOT}" | awk 'NR==2 { printf "%.1f", $4 / 1048576 }'; }

  local before item
  before="$(free_gb)"
  remove "${derived}"
  remove "${MOBILE}/ios/Pods"
  remove "${MOBILE}/ios/build"

  # Archive names carry their date and time, so the sorted glob ends on the newest.
  local t4_archives=()
  for item in "${archives}"/*/"T4 Mobile "*.xcarchive; do
    [[ -d "${item}" ]] || continue
    [[ "$(/usr/libexec/PlistBuddy -c 'Print :ApplicationProperties:CFBundleIdentifier' \
      "${item}/Info.plist" 2>/dev/null)" == "${BUNDLE}" ]] || continue
    t4_archives+=("${item}")
  done
  local count="${#t4_archives[@]}" index
  for ((index = 0; index < count - 1; index++)); do
    remove "${t4_archives[index]}"
    [[ "${dry_run}" == "yes" ]] || rmdir "$(dirname "${t4_archives[index]}")" 2>/dev/null || true
  done
  ((count == 0)) || echo "Archive gardée : ${t4_archives[count - 1]}"

  local newest_ipa=""
  for item in "${local_root}"/export/*.ipa "${local_root}"/*/export/*.ipa; do
    [[ -f "${item}" ]] || continue
    [[ -z "${newest_ipa}" || "${item}" -nt "${newest_ipa}" ]] && newest_ipa="${item}"
  done
  for item in "${local_root}"/export/*.ipa "${local_root}"/*/export/*.ipa; do
    [[ -f "${item}" && "${item}" != "${newest_ipa}" ]] || continue
    remove "${item}"
  done
  [[ -z "${newest_ipa}" ]] || echo "IPA gardée : ${newest_ipa}"

  if [[ "${dry_run}" == "yes" ]]; then
    echo "Simulation : rien n’a été supprimé. Espace libre : ${before} Go."
  else
    echo "Espace libre : ${before} Go avant, $(free_gb) Go après."
  fi
}

case "${ACTION}" in
  doctor) doctor ;;
  prebuild) prebuild ;;
  archive) archive yes ;;
  archive-unsigned) archive no ;;
  export) export_ipa ;;
  clean) clean "${2:-}" ;;
  *) echo "Usage : $0 {doctor|prebuild|archive|archive-unsigned|export|clean [--dry-run]}" >&2; exit 2 ;;
esac
