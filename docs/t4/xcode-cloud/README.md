# Build Xcode Cloud — T4 Mobile

Demande de Raoul du 25 novembre 2026 : livrer un build TestFlight sans compiler ni
signer sur le Mac. Préparé sur la branche `t4-mobile-xcode-cloud`.

**État au 25 novembre 2026 : préparé, pas en service.** Aucun produit Xcode Cloud
n’existe encore pour T4 Mobile. La chaîne locale de
[T4-TESTFLIGHT-REPRISE.md](../../../T4-TESTFLIGHT-REPRISE.md) reste la voie de
livraison tant qu’un build Xcode Cloud n’est pas arrivé **VALID** dans **T4 Interne**.

## Ce qui tourne où

| Étape                                   | Où                                                                          |
| --------------------------------------- | --------------------------------------------------------------------------- |
| Lancer le build, suivre, prouver        | Mac, `node scripts/t4/xcode-cloud.mjs`                                      |
| Cloner `barmatr/t3code`                 | Xcode Cloud                                                                 |
| Node, pnpm, prebuild Expo, CocoaPods    | Xcode Cloud, [post-clone.sh](../../../scripts/t4/xcode-cloud/post-clone.sh) |
| Archive, signature, envoi à TestFlight  | Xcode Cloud, certificats gérés par Apple                                    |
| Association à T4 Interne, notifications | Mac, `scripts/t4/app-store-connect.mjs` appelé par la commande              |

Xcode Cloud ne lit ses scripts que dans `ci_scripts`, à côté du workspace. Or
`expo prebuild` efface `apps/mobile/ios` à chaque passage. Le plugin
[withXcodeCloudScripts.cjs](../../../apps/mobile/plugins/withXcodeCloudScripts.cjs)
repose donc le lanceur `ios/ci_scripts/ci_post_clone.sh`, seul fichier d’`ios/`
suivi par Git. Le lanceur passe la main au script hors d’`ios/`.

Apple demande un projet « présent en permanence » dans le dépôt et prévient qu’un
projet généré « peut échouer »
([Setting up your project](https://developer.apple.com/documentation/xcode/setting-up-your-project-to-use-xcode-cloud)).
Le projet n’est pas commité : la chaîne locale le réécrit à chaque build (numéro,
signature manuelle), et d’autres dépôts Expo publics construisent ainsi.
Si le premier build échoue sur « Workspace … does not exist », commiter
`apps/mobile/ios` (sans `Pods` ni `build`) est le repli.

## Livrer

Le commit à livrer doit être poussé sur `fork` : Xcode Cloud ne construit que ce
qui est sur GitHub, et ce fork est public.

```bash
node scripts/t4/xcode-cloud.mjs check
node scripts/t4/xcode-cloud.mjs deliver --dry-run
node scripts/t4/xcode-cloud.mjs deliver --confirm-app-id 6832960692
```

- `check` ne lit que : produit, workflows, dépôt relié, versions de Xcode proposées.
- `deliver --dry-run` fait tous les contrôles et affiche la requête sans l’envoyer.
- `deliver` lance le workflow sur la branche courante, suit le run, attend le
  traitement Apple, associe le build à **T4 Interne** s’il ne l’est pas, puis écrit
  `build/xcode-cloud/build-N/` : `xcode-cloud-run.json` (durées, actions),
  `apple-final-status.json` et `deployment.json`.
- `watch RUN_ID --confirm-app-id 6832960692` reprend un run déjà lancé.
- Dans un worktree, `T4_ASC_ENV_FILE` désigne le `.env.app-store-connect.local` du
  dépôt principal.

L’API ne sait ni créer le produit, ni annuler un run, ni lire ou écrire les
variables d’environnement et les post-actions d’un workflow.

## Numéro de build

Xcode Cloud numérote lui-même et remplace `CFBundleVersion` à l’envoi. Son compteur
part de 1 : avant le premier build, régler **Next Build Number** à 33 dans App
Store Connect (fiche T4 Mobile → Xcode Cloud → Settings → Build Number). Chaque
run consomme un numéro, même en échec.

Les deux chaînes partagent la même suite. Après un build local, relever **Next
Build Number** au-dessus de son numéro ; avant un build local, choisir un numéro
supérieur au dernier run Xcode Cloud. `deliver` refuse de lancer un run dont le
numéro ne dépasserait pas le dernier build TestFlight.

## Réglages du workflow

- Workspace `apps/mobile/ios/T4Mobile.xcworkspace`, schéma `T4Mobile`.
- **Xcode 27.2**, fixé à la main : « Latest Release » a déjà basculé des projets
  Expo sans prévenir, et l’iPhone Duo exige Xcode 27.1 ou plus.
- Démarrage manuel seulement : un build à chaque push viderait les 25 heures.
- Action Archive, préparation **TestFlight (Internal Testing Only)**.
- Post-action **TestFlight Internal Testing**, groupe **T4 Interne** : c’est elle
  qui envoie le build à TestFlight. L’API ne la montre pas ; `deliver` constate son
  effet en attendant le build Apple du run.
- Variables **secrètes** `T4_AMPHETAMINE_STATUS_ORIGIN` et
  `T4_AMPHETAMINE_ENVIRONMENT_ID`, reprises de `.env.local`. Le script refuse de
  construire sans elles et ne les affiche jamais.

## Signature

Xcode Cloud archive avec une signature ad hoc, puis signe à l’export avec des
certificats gérés par Apple : ni le certificat ni le profil du Mac ne servent.

Rejouée sur le Mac avec Xcode 27.2, cette archive ad hoc s’arrête sur « "T4Mobile"
has entitlements that require signing with a development certificate ». Un projet
public au même réglage (fichier de droits, signature automatique) construit
pourtant sur Xcode Cloud avec Xcode 27.2
([ticket](https://github.com/Marcorable/app-recite_scripts/issues/103)) : seul le
premier build dira ce qu’il en est pour T4.

Si le premier build s’arrête sur ce message, ajouter au workflow la variable
`T4_XCODE_CLOUD_UNSIGNED_ARCHIVE=1` (non secrète) et relancer. L’archive n’est
alors plus signée et l’export signe l’application. Essayé sur le Mac : l’IPA
exportée est valide mais perd le droit `keychain-access-groups`. Le groupe déclaré
est celui que l’application reçoit par défaut ; vérifier quand même sur l’iPhone
que la session Clerk survit à la mise à jour avant d’en faire la voie normale.

## Mettre à jour après un changement de dépendances

[Package.resolved](../../../scripts/t4/xcode-cloud/Package.resolved) fige les
paquets Swift (Clerk, Nuke, PhoneNumberKit). Xcode Cloud résout sans résolution
automatique : sans ce fichier, ou s’il ne correspond plus aux pods, le build
s’arrête à la résolution. Après une montée de version des dépendances natives,
recopier celui qu’un build local a produit dans
`apps/mobile/ios/T4Mobile.xcworkspace/xcshareddata/swiftpm/`.
