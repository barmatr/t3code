#!/bin/bash
# Xcode Cloud post-clone step: rebuilds apps/mobile/ios from the Expo config, as
# ios-local.sh does on the Mac. Signing and upload belong to Xcode Cloud.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
MOBILE="${ROOT}/apps/mobile"
IOS="${MOBILE}/ios"
SCHEME="T4Mobile"
TOOLCHAIN="${T4_XCODE_CLOUD_TOOLCHAIN_DIR:-${HOME}/.t4-xcode-cloud}"
STARTED="${SECONDS}"
# Xcode Cloud starts in ios/ci_scripts, which prebuild deletes and recreates.
cd "${ROOT}"

export APP_VARIANT=production EXPO_NO_DOTENV=1 EXPO_NO_GIT_STATUS=1 EXPO_NO_TELEMETRY=1 CI=1
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=6144}"
export HOMEBREW_NO_AUTO_UPDATE=1 HOMEBREW_NO_INSTALL_CLEANUP=1

step() { printf '\n== [%4ss] %s\n' "$((SECONDS - STARTED))" "$1"; }
fail() { echo "Xcode Cloud T4 : $1" >&2; exit 1; }
retry() {
  local attempt
  for attempt in 1 2 3; do
    "$@" && return 0
    echo "Tentative ${attempt}/3 échouée : $*" >&2
    sleep $((attempt * 10))
  done
  return 1
}
manifest_value() { sed -n "s/.*\"$1\": *\"\\([^\"]*\\)\".*/\\1/p" "${ROOT}/package.json" | head -1; }

step "Variables du workflow"
[[ "${CI_BUILD_NUMBER:-}" =~ ^[0-9]+$ ]] || fail "CI_BUILD_NUMBER absent ou non numérique."
export T4_IOS_BUILD_NUMBER="${CI_BUILD_NUMBER}"
for name in T4_AMPHETAMINE_STATUS_ORIGIN T4_AMPHETAMINE_ENVIRONMENT_ID; do
  [[ -n "${!name:-}" ]] || fail "variable secrète ${name} absente du workflow."
  # The workflow is created with this placeholder; Raoul types the real values.
  [[ "${!name}" != A_REMPLACER ]] || fail "variable secrète ${name} encore à sa valeur de remplissage."
done
# Xcode build phases start from a fresh environment: app.config.ts reads this
# file again when the app manifest is embedded. Values are never printed.
(
  umask 077
  {
    printf 'T4_AMPHETAMINE_STATUS_ORIGIN=%s\n' "${T4_AMPHETAMINE_STATUS_ORIGIN}"
    printf 'T4_AMPHETAMINE_ENVIRONMENT_ID=%s\n' "${T4_AMPHETAMINE_ENVIRONMENT_ID}"
    printf 'T4_IOS_BUILD_NUMBER=%s\n' "${T4_IOS_BUILD_NUMBER}"
  } > "${ROOT}/.env.local"
)
echo "Build ${T4_IOS_BUILD_NUMBER}, commit ${CI_COMMIT:-inconnu}, Xcode $(xcodebuild -version | head -1 | cut -d' ' -f2)."

step "Node et pnpm"
NODE_VERSION="$(manifest_value node)"
PNPM_VERSION="$(manifest_value packageManager)"
PNPM_VERSION="${PNPM_VERSION#pnpm@}"
[[ -n "${NODE_VERSION}" && -n "${PNPM_VERSION}" ]] || fail "versions de Node ou de pnpm illisibles dans package.json."
case "$(uname -m)" in
  arm64) NODE_ARCH=arm64 ;;
  x86_64) NODE_ARCH=x64 ;;
  *) fail "architecture $(uname -m) non prévue." ;;
esac
NODE_NAME="node-v${NODE_VERSION}-darwin-${NODE_ARCH}"
NODE_HOME="${TOOLCHAIN}/${NODE_NAME}"
if [[ ! -x "${NODE_HOME}/bin/node" ]]; then
  # Homebrew no longer ships bottles for Intel runners; the official archive works on both.
  mkdir -p "${TOOLCHAIN}"
  retry curl -fsSL --retry 3 -o "${TOOLCHAIN}/${NODE_NAME}.tar.gz" \
    "https://nodejs.org/dist/v${NODE_VERSION}/${NODE_NAME}.tar.gz"
  retry curl -fsSL --retry 3 -o "${TOOLCHAIN}/SHASUMS256.txt" \
    "https://nodejs.org/dist/v${NODE_VERSION}/SHASUMS256.txt"
  (cd "${TOOLCHAIN}" && grep " ${NODE_NAME}.tar.gz\$" SHASUMS256.txt | shasum -a 256 -c -)
  tar -xzf "${TOOLCHAIN}/${NODE_NAME}.tar.gz" -C "${TOOLCHAIN}"
  rm -f "${TOOLCHAIN}/${NODE_NAME}.tar.gz" "${TOOLCHAIN}/SHASUMS256.txt"
fi
export PATH="${NODE_HOME}/bin:${PATH}"
[[ "$(node --version)" == "v${NODE_VERSION}" ]] || fail "Node $(node --version) au lieu de v${NODE_VERSION}."
if [[ "$(pnpm --version 2>/dev/null || true)" != "${PNPM_VERSION}" ]]; then
  retry npm install --global --no-fund --no-audit "pnpm@${PNPM_VERSION}"
fi
echo "Node $(node --version), pnpm $(pnpm --version), $(uname -m)."

step "Dépendances JavaScript"
(cd "${ROOT}" && retry pnpm install --frozen-lockfile --filter '@t3tools/mobile...')

step "Configuration Expo"
CONFIG_JSON="$(mktemp)"
trap 'rm -f "${CONFIG_JSON}"' EXIT
(cd "${MOBILE}" && pnpm exec expo config --type public --json) > "${CONFIG_JSON}"
node "${ROOT}/scripts/t4/verify-mobile-config.mjs" "${CONFIG_JSON}"

step "Projet iOS"
(cd "${MOBILE}" && pnpm exec expo prebuild --platform ios --no-install)
node "${ROOT}/scripts/t4/verify-native-ios.mjs" "${IOS}"
[[ -x "${IOS}/ci_scripts/ci_post_clone.sh" ]] || fail "le lanceur ios/ci_scripts n’a pas été régénéré."
[[ -f "${IOS}/${SCHEME}.xcodeproj/xcshareddata/xcschemes/${SCHEME}.xcscheme" ]] || fail "schéma partagé ${SCHEME} absent."
printf 'export NODE_BINARY=%s\n' "${NODE_HOME}/bin/node" > "${IOS}/.xcode.env.local"

step "CocoaPods"
command -v pod >/dev/null || retry brew install cocoapods
echo "CocoaPods $(pod --version)."
# The Podfile resolves expo and react-native from its own directory.
(cd "${IOS}" && retry pod install)
node "${ROOT}/scripts/t4/verify-native-ios.mjs" "${IOS}"

if [[ "${T4_XCODE_CLOUD_UNSIGNED_ARCHIVE:-}" == 1 ]]; then
  step "Archive non signée (repli)"
  # Fallback if the ad hoc archive stops at "entitlements that require signing with
  # a development certificate", as it does on a Mac with Xcode 27.2. The export
  # then signs the app without keychain-access-groups.
  PBXPROJ="${IOS}/${SCHEME}.xcodeproj/project.pbxproj"
  ENTITLEMENTS="CODE_SIGN_ENTITLEMENTS = ${SCHEME}/${SCHEME}.entitlements;"
  sed -i '' "s|${ENTITLEMENTS}|${ENTITLEMENTS} CODE_SIGNING_ALLOWED = NO;|" "${PBXPROJ}"
  [[ "$(grep -c "${ENTITLEMENTS} CODE_SIGNING_ALLOWED = NO;" "${PBXPROJ}")" == 2 ]] ||
    fail "réglage de signature introuvable dans le projet généré."
fi

step "Paquets Swift"
# Xcode Cloud resolves packages with automatic resolution off: without this file
# the build stops at "a resolved file is required".
mkdir -p "${IOS}/${SCHEME}.xcworkspace/xcshareddata/swiftpm"
cp "${ROOT}/scripts/t4/xcode-cloud/Package.resolved" \
  "${IOS}/${SCHEME}.xcworkspace/xcshareddata/swiftpm/Package.resolved"

step "Projet prêt pour l’archive"
