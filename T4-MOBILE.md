# T4 Mobile

Client personnel de Raoul, installé à côté de `../t4code` (front PC). Ce dépôt est
indépendant : ses modifications ne changent ni T4 PC ni l’app T3 officielle.
Le monorepo complet est conservé, car le mobile utilise les contrats et le runtime
partagés. Les noms internes `@t3tools/*` restent compatibles.

## Identité et fonctionnement

- Application : **T4 Mobile**, icône verte T4, schéma `t4code`.
- iOS et Android : `fr.emaxconseils.t4`. Dev : suffixe `.dev`, preview : `.preview`.
- Signature iOS : équipe `emax conseils`, `GY9P9U75F3`.
- Première version locale : `0.1.0`, build `1` (modifiable avec `T4_IOS_BUILD_NUMBER`).
- Sources : depuis le build 7, branche `t4-mobile-4515`, partie de T3
  `v0.1.9-nightly.20261111.4515` avec les seules personnalisations mobiles reprises
  (commit du build 6 `7cc84fd38a`, tag `t4-mobile-build-6`). Les builds 1 à 6
  venaient du commit T4 PC `268dbc1988`, aligné sur `v0.1.8-nightly.20261104.4165`.
  Les changements PC ne deviennent pas automatiquement des changements mobiles.

T3 et T4 ont des identifiants, schémas et espaces de stockage distincts. Les liens
universels du domaine officiel restent réservés à T3. Pour connecter T4, utiliser
le formulaire ou le scan QR dans l’app, avec un nouvel appairage par environnement.
Les liens/QR d’appairage officiels T3 sont lisibles par le scan T4. Un lien `t4code://`
peut ouvrir directement T4. Ne pas publier de lien d’appairage contenant un jeton.

Le client conserve le flux de conversation temps réel lorsque l’app est active ;
son fonctionnement sur l’iPhone de Raoul reste à vérifier. Cette
version ne déclare pas les capacités push, widgets, Live Activities, réception par
extension ou Sign in with Apple. L’app officielle conserve ces usages. Le service
T3 Connect/Clerk et la télémétrie cloud ne sont pas configurés ici. Si un serveur
n’est accessible que via T3 Connect, son accès depuis ce build reste à valider ;
prévoir une route directe accessible à l’iPhone (réseau local, VPN/tailnet ou HTTPS).
Aucun serveur ni appairage existant n’a été modifié pendant cette préparation.

Les mises à jour Expo de T3 sont désactivées et leur projet EAS a été retiré.
Chaque mise à jour de T4 se fait par un nouveau build. Aucun profil EAS hérité ne
permet d’envoyer accidentellement ce client vers la fiche d’app officielle.

## Préparer et compiler sur le Mac

Depuis la racine :

```bash
vp i --frozen-lockfile
vp run t4:ios:doctor
vp run t4:ios:prebuild
vp run t4:ios:archive
vp run t4:ios:export
```

`doctor` vérifie la configuration, Xcode, CocoaPods, le certificat avec clé privée
et un profil App Store **propre à T4**. `prebuild` génère le projet iOS sans `--clean`,
vérifie les identifiants, capacités et mises à jour natives, puis installe les pods.
`archive` ne contacte pas Apple pour créer des identifiants ou des profils. Il utilise
le profil installé, la signature manuelle EMAX et une configuration Release autonome.
Les archives vont dans `~/Library/Developer/Xcode/Archives/` (Organizer Xcode).
Les logs et données de compilation sont dans `build/ios-local/` (ignoré par Git).

Pour vérifier la compilation avant que le profil existe :

```bash
vp run t4:ios:archive:unsigned
```

Cette archive non signée ne s’installe pas sur l’iPhone et ne part pas à TestFlight.
`export` refuse une archive non signée ou un identifiant différent ; il exporte une
IPA locale avec l’option TestFlight interne. Il n’effectue **aucun upload**.
`IOS_ARCHIVE_PATH` permet de choisir explicitement une archive.

La commande amont `ios:release` lance une app sur un appareil ; pour créer une
archive de distribution T4, employer les commandes `t4:ios:*` ci-dessus.

## Compte Apple et TestFlight

Préparation Apple effectuée le 10 novembre 2026 : l’App ID explicite
`fr.emaxconseils.t4` est enregistré, la fiche **T4 Mobile** existe sous l’Apple ID
`6832960692`, et le groupe **T4 Interne** est créé sans distribution automatique.
Le profil **T4 Mobile App Store 2026-11** est installé et correspond au certificat
EMAX présent avec sa clé privée dans le Trousseau. `t4:ios:doctor` passe.
Le certificat et ce profil expirent le **4 décembre 2026**.

La clé d’équipe **T4 Mobile CLI**, rôle Admin, a été créée après confirmation
écrite de Raoul. Sa clé privée est stockée hors dépôt sur ce Mac ; sa configuration
est dans `.env.app-store-connect.local`, ignorée par Git. L’authentification API et
CLI a été vérifiée sur la fiche T4. La clé de signature EMAX n’a pas été exportée.

Les commandes de reprise, les emplacements privés, les preuves et les limites sont
dans [T4-TESTFLIGHT-REPRISE.md](T4-TESTFLIGHT-REPRISE.md). Le premier build signé
**0.1.0 (1)** a été validé puis envoyé à Apple sans erreur à 12:38:45 (Paris),
le 10 novembre, sur autorisation de Raoul. Apple confirme **VALID**, audience
**INTERNAL_ONLY**, état interne **READY_FOR_BETA_TESTING** ; l’association au groupe
**T4 Interne** est vérifiée par API. Le groupe contient **1 testeur**, le compte
TestFlight de Raoul ajouté par Computer Use sur sa demande explicite de finaliser
l’accès. L’état **Invité / INVITED** est confirmé dans la console et par API.
Les avis sur les contrats commerciaux et le statut de commerçant
UE sont restés inchangés ; aucun accord n’a été accepté.

Apple autorise jusqu’à 100 testeurs internes disposant d’un rôle compatible dans
App Store Connect ; chaque build TestFlight est disponible 90 jours. Cela ne signifie
pas une publication publique : [documentation Apple](https://developer.apple.com/help/app-store-connect/test-a-beta-version/add-internal-testers).

## Maintenance

Branches `t4-mobile` (builds 1 à 6) et `t4-mobile-4515` (depuis le build 7), avec
les tags `t4-mobile-build-N`, poussées sur le fork `fork` (`barmatr/t3code`) depuis
le 11 novembre 2026, à côté de la branche `t4` de T4 PC. Les remotes de lecture
`desktop-source` et `upstream` gardent leur push neutralisé. Conserver les commits personnalisés mobile à part avant toute mise à jour,
puis reprendre une base compatible avec les serveurs T3 réellement utilisés.
Exécuter les vérifications ciblées après intégration ; éviter le script de mise à jour
PC hérité (`scripts/t4/update-t4.sh`), qui installe l’application desktop.
La licence MIT T3 est conservée dans `LICENSE`.

Méthode de mise à niveau suivie pour le build 7 : récupérer le tag nightly avec
`git -c fetch.negotiationAlgorithm=noop fetch upstream tag <tag> --no-tags` (le
dépôt vient d’un clone partiel), créer une branche depuis ce tag, puis
`git cherry-pick --no-commit` du seul commit mobile T4. Les écrans Pull Requests
restent dans le code mais sont ignorés par knip : l’onglet Agents les remplace.

Pièges de recette sur simulateur relevés le 11 novembre 2026 :

- lancer le backend isolé avec `T3CODE_HOME="$PWD/.t3" vp run dev` : ce dépôt
  n’est pas un worktree Git, et sans cette variable le serveur de dev écrit dans
  `~/.t3/dev` ;
- exporter `LANG=en_US.UTF-8` avant `vp run mobile:install`, sinon CocoaPods échoue ;
- `mobile:install` régénère `apps/mobile/ios` en variante dev (`T4MobileDev`) :
  relancer ensuite `vp run t4:ios:prebuild` (et non `ios-local.sh prebuild` depuis
  la racine, dont le `pod install` échoue), puis `vp run t4:ios:doctor`.

## Vérifications du 10 novembre 2026

Lors de la préparation initiale, les 62 tests ciblés (liens, appairage, capacités push, configuration cloud et outil
d’installation), le typecheck du package mobile et le lint des fichiers modifiés
passent. Les trois variantes Expo ont des identifiants T4 distincts.
Le bundle JavaScript iOS Release s’exporte et Xcode a terminé l’archive native
avec `ARCHIVE SUCCEEDED` sous Xcode 26.4.1.

L’archive de compilation initiale `T4 Mobile 09.56.37.xcarchive` portait
`fr.emaxconseils.t4`, version `0.1.0` (build `1`), sans signature. Elle a été
supprimée après validation des livraisons suivantes pour récupérer de l’espace ;
elle ne constituait pas une app distribuable. Les archives et IPA effectivement
livrées restent conservées.

Le profil Apple T4, l’accès API/CLI et la fiche d’app sont désormais vérifiés.
Une nouvelle archive **signée** du code actuel a réussi à `12.28.19`, suivie
de l’export IPA, de la validation Apple et de l’upload sans erreur. Son traitement
Apple et sa disponibilité pour le groupe interne sont vérifiés. La reprise
TestFlight ci-dessus donne les chemins et empreintes exacts. Les six tests ciblés
du filtre temporel et les typechecks mobile/runtime passent. Cet essai porte sur
la chaîne de déploiement ; l’installation sur l’iPhone et la connexion réelle
aux serveurs restent à valider.

Le build de développement iOS Simulator compile et s’installe également sous
`fr.emaxconseils.t4.dev`. Le premier lancement visuel est **validé** : l’écran
d’accueil T4 s’affiche sans erreur, avec l’état « No environments connected ».
La confirmation française d’ouverture a été acceptée en ciblant SpringBoard
avec l’outil Device. Le client utilise `http://localhost:8096`, car Metro écoute
sur la boucle locale IPv6 ; l’adresse `127.0.0.1` ne répondait pas.
Cette vérification couvre l’accueil sans serveur appairé, pas une conversation
réelle ni les notifications. La capture est conservée dans
`build/ios-local/validation/first-launch.png`. Le projet Xcode reste en variante
production après la vérification du client de développement déjà installé.
Le simulateur ouvert pour la recette et Metro ont été arrêtés après la capture.

Les comptes rendus de contrôle sont conservés localement dans
`build/ios-local/validation/status.json` et les journaux voisins, hors Git.

### All Ages — recette après la livraison du build 1

Le troisième filtre de la liste propose **All Ages** par défaut, puis les dernières
10 minutes, heure, journée ou semaine. Dans **Settings → General → Age filter**,
**Last agent reply** est la référence par défaut ; **Last conversation activity**
inclut aussi les messages utilisateur. La durée et la référence sont conservées
sur cet appareil. Les filtres de projet et d’environnement se combinent avec la durée.

La reprise a corrigé le cas des serveurs qui omettent le dernier message dans les
listes : le client consulte alors l’historique par pages, avec quatre lectures
simultanées au maximum. Une modification du titre ou des métadonnées ne devient
pas une nouvelle réponse. Les lectures en cours et les échecs sont signalés, avec
une action de réessai. Les anciennes pages non encore vérifiées restent accessibles
par **Check older conversations**. Le correctif livré dans le build 2 parcourt
automatiquement les pages nécessaires au filtre : une première page ancienne ne
masque plus les conversations récentes des pages suivantes. Un âge précis rend
les résultats visibles même si une étagère était repliée. Avec **All projects**,
ces résultats sont regroupés par projet, avec son nom et un séparateur horizontal.

Les six tests ciblés dans quatre fichiers, les typechecks mobile/client-runtime,
le lint et le formatage ciblés passent. Le client natif de développement a été
recompilé et installé sur iPhone 17 Simulator / iOS 26.4. La recette avec six
conversations simulées sur deux projets isolés couvre les quatre durées, leur
intersection avec le projet, les deux références, la liste vide et la conservation
de la durée et de la référence après fermeture et relance. Les tests automatisés
couvrent aussi l’expiration exacte, l’absence de réponse, la pagination, les erreurs
et le réessai. Compte rendu et captures : `build/all-ages/recette/RECETTE.md`.

Le correctif est livré dans TestFlight interne en **0.1.0 (2)**, état relu
**VALID / INTERNAL_ONLY / IN_BETA_TESTING**, groupe **T4 Interne**. Les 70 tests
ciblés et le typecheck mobile passent. Une seconde recette native avec 46 fils
simulés vérifie la pagination, les séparateurs, les changements de projet et la
persistance : `build/ios-local/build-2/visual/RECETTE.md`. Les preuves de l’envoi
sont dans `build/ios-local/build-2/validation/deployment.json`.
Le build 1 et son IPA sont conservés. L’iPhone physique, Android et les serveurs
réels ne sont pas validés par ces recettes. Le projet iOS généré est en variante
**production** après cet envoi.

### Onglet Agents — Direction agentique

La deuxième position de la barre de navigation affiche une tête de robot et
le nom **Agents**, à la place de PRs. Elle ouvre la liste des fils du seul projet
**Direction agentique** du MacBook confirmé par Raoul. La correspondance repose
sur les identifiants exacts du projet et de l’environnement, définis dans
`apps/mobile/src/features/home/agents-project.ts`. Un homonyme sur une autre
machine ne constitue pas une correspondance.

Cet onglet ouvre toutes les dates de ce projet ; sa recherche et sa position
de lecture sont indépendantes de Chats. Ouvrir puis quitter un fil revient
à Agents. Les filtres mémorisés de Chats restent conservés. En l’absence du
projet cible, une carte explique comment retrouver la connexion au MacBook.
La clé interne historique du deuxième onglet est conservée pour les préférences
de navigation existantes. Les fonctions Git des conversations restent accessibles.

Les 40 tests de portée/navigation et les 70 tests du filtre temporel passent,
ainsi que le typecheck mobile, le lint et le formatage ciblés. Le client natif a
été recompilé et vérifié sur iPhone 17 Simulator / iOS 26.4 : icône, liste ciblée,
recherche, ouverture/retour, indépendance des filtres et persistance après relance.
La recette utilise deux fils cibles et 44 autres fils simulés isolés. Voir
`build/ios-local/build-3/visual/RECETTE.md` pour les parcours et leurs limites.
Le build **0.1.0 (3)** est livré à **T4 Interne**, état Apple relu
**VALID / INTERNAL_ONLY / IN_BETA_TESTING**, UUID
`2d5bb281-fa68-4c66-8705-5dd8dd550eeb`. Preuve :
`build/ios-local/build-3/validation/deployment.json`. La prévalidation altool a
rencontré une erreur puis une attente prolongée ; l’envoi normal a réussi et
Apple a ensuite validé et distribué le même fichier. Les journaux distinguent
ces étapes. Projet iOS en production ; connexion simulée, Device, Metro et
backend de recette fermés. L’installation physique de ce build reste à confirmer.

### Feu bleu au retour au premier plan

Le titre **T4 Code BETA** s’entoure brièvement du même feu bleu que le changement
de projet Option + Tab de T4 Mac : palette, bruit ascendant, lueur et durée de
**1,4 seconde** repris du moteur actuel, avec un contour adapté au titre mobile.
L’effet suit un vrai retour depuis l’arrière-plan ; une alerte, le Centre de contrôle
ou un changement d’onglet ne le déclenche pas. Il respecte Réduire les animations,
s’interrompt quand le titre n’est plus actif et laisse passer les touchers.
La vue Canvas locale n’existe que pendant la flambée et ne charge aucune ressource
réseau ; elle est supprimée à la fin ou en cas d’erreur, avec une borne de secours.

Le build **0.1.0 (4)** est livré à **T4 Interne**, état relu par API
**VALID / INTERNAL_ONLY / IN_BETA_TESTING**, UUID
`4cbcce85-78d4-453f-b85a-20ee270c3293`. Prévalidation et envoi Apple réussis sans erreur.
Preuve : `build/ios-local/build-4/validation/deployment.json` ; recette et vidéos :
`build/ios-local/build-4/visual/RECETTE.md`. **122 tests ciblés**, typecheck mobile,
lint et formatage ciblés passent. Rendu observé en modes clair et sombre sur iPhone
17 Simulator / iOS 26.4, données simulées isolées ; l’installation sur l’iPhone,
Android, iPad et les serveurs réels restent hors de cette recette. La réduction des
animations est vérifiée par les tests, sans manipulation des Réglages natifs.
Les fonctions et anciens builds sont conservés. Projet iOS en production ; connexion
de recette retirée, Device, Metro et backend fermés, cache Xcode régénérable supprimé.

### Clignotement des fils — build 5

Le build **0.1.0 (5)** est livré à **T4 Interne**, état relu par API
**VALID / INTERNAL_ONLY / IN_BETA_TESTING** ; UUID
`4dec2f33-0a73-4b95-8f74-6e3eea1c480e`. Les notifications automatiques sont
désactivées. Il conserve les dates vérifiées pendant les relectures et les erreurs,
pour éviter les retraits temporaires de lignes et de groupes. Le bandeau d'attente
est réservé aux dates inconnues ; les erreurs et Retry restent visibles. Les
réponses autoritaires et l'expiration réelle continuent d'actualiser les résultats.

Les diagnostics indépendants Opus 5.5 High et Astra High convergent ; les
reproductions initialement rouges passent après correction. **132 tests ciblés**,
typecheck mobile, lint, formatage, signature et contrôle ZIP passent ; 83 empreintes
figées sont vérifiées. Preuve : `build/ios-local/build-5/validation/deployment.json`.
Recette et limites : `build/diagnostics/thread-flicker/main/RECETTE.md`. La recette
native principale précède le dernier changement limité au bandeau ; le dernier
appairage automatique de recette n'a pas abouti après ce changement, couvert par
les tests. iPhone physique et serveurs réels restent à confirmer ; aucune baisse
mesurée du trafic n'est annoncée. Les archives et IPA 1 à 5 sont conservées.

### HOT et listes prioritaires — build 6

Le build **0.1.0 (6)** est distribué à **T4 Interne** depuis le 11 novembre 2026,
avec l’état Apple relu **VALID / INTERNAL_ONLY / IN_BETA_TESTING**. UUID :
`2aa30a41-5d8d-4790-8b6a-f8884cf13649`. Les notifications automatiques restent
désactivées ; aucune nouvelle invitation, aucun ancien build expiré.

Le bouton **hot** conserve les fils demandant une action, les Done non lus et les
agents en cours ou en attente. Il ignore temporairement l’âge et restaure le choix
précédent lorsqu’on le désactive ; machine, projet et recherche restent appliqués.
Son état persiste séparément dans Chats et Agents. La flamme bleue continue au
premier plan respecte la réduction des animations. Le tri privilégie actions,
Done non lus puis travail en cours ; les groupes sont plus compacts, leurs titres
en gras, et le modèle rejoint la ligne de statut quand une seule machine apparaît.
**All env** remplace All environments. Le projet Direction agentique du Mac est
réservé à Agents ; un homonyme d’un autre environnement reste visible dans Chats.

La recette a aussi révélé puis fait corriger le bouton HOT mal placé lorsque
Agents est indisponible et la suspension erronée des mises à jour après changement
d’onglet. La reprise des nouveaux fils a été observée sur les sources finales,
après retour de l’onglet Agents et après reconnexion, sans passage par Settings.
Le correctif de revalidation du filtre d’âge du build 5 reste inchangé.

**107 tests / 9 fichiers**, typecheck, lint, formatage, signature, ZIP et 1 707
empreintes de sources/ressources vérifiés. Preuve et rapports :
`build/ios-local/build-6/validation/deployment.json` et
[T4-TESTFLIGHT-REPRISE.md](T4-TESTFLIGHT-REPRISE.md). Recette iPhone 17 Simulator,
iOS 26.4, sur données isolées ; iPhone physique, serveurs réels, Android, iPad et
consommation non vérifiés. Connexions de recette retirées, Device/Metro/backends
fermés. Projet iOS en production, cache Xcode conservé, archives et IPA 1 à 6 conservées.
