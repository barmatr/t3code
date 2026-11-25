# Alertes dans l’app — T4 Mobile

Demande de Raoul du 25 novembre 2026 : voir dans T4 Mobile, à l’écran et sans
notification push, ce que le Mac signale déjà. Première livraison dans le build **0.1.0 (29)**,
commits `123df6888e` (fonction) et `62f2c2be05` (correctif), branche
`t4-mobile-4682` poussée sur `fork` (`barmatr/t3code`).

Le build **0.1.0 (30)** prolonge les bandeaux et leur ajoute un liseré coloré
(commit `10cf1dbd21`). [Livraison TestFlight](../../../T4-TESTFLIGHT-REPRISE.md).

- [Étude de faisabilité](etude-alertes-t4-mobile.md), révisée après challenge.
- [Diaporama de conception](diaporama-alertes-t4-mobile.html) : maquettes du
  bandeau, de la pastille et des réglages, impact design, choix validés.
- [Annexe Apple et Tailscale](sources-apple-tailscale.md).

Choix de Raoul, le 25 novembre 2026 : bandeau en haut (variante A), pastille sur
Discussions, vibration légère réglable. La ligne « Depuis … » au retour dans l’app
est reportée.

## Ce que l’on voit

**Bandeau.** Pendant que T4 est ouvert, un bandeau descend en haut de l’écran,
au-dessus de tout, feuilles natives comprises. Il annonce :

| Événement            | Titre                         | Durée |
| -------------------- | ----------------------------- | ----- |
| Validation demandée  | Approbation requise           | 16 s  |
| Question de l’agent  | Réponse requise               | 16 s  |
| Message d’un invité  | Demande d’invité              | 16 s  |
| Échec du tour        | Échec du fil                  | 16 s  |
| Limite d’utilisation | Limite d’utilisation atteinte | 16 s  |
| Fin de tour          | Fil terminé                   | 10 s  |

Un liseré de 2 points entoure le bandeau et reprend la couleur de son icône,
verte pour une fin de tour. Il suit le thème clair ou sombre, y compris pour
les alertes groupées. Le bandeau donne le titre du fil, puis le projet, ou
l’erreur pour un échec.
Toucher ouvre le fil. Plusieurs alertes de même nature se regroupent (« 3 fils
t’attendent ») et le bouton **Voir** ouvre Discussions. Ordre de passage : ce qui
attend Raoul, puis les échecs, puis les fins de tour. Glisser vers le haut ferme
le bandeau ; une vibration légère l’accompagne et VoiceOver l’annonce. Une demande
traitée ailleurs, sur le Mac par exemple, retire son bandeau aussitôt.

**Pastille sur l’onglet Discussions** (iPhone) : le nombre de fils qui attendent
Raoul (validation, question, invité, échec, limite), plafonné à « 99+ ». Quand
il ne reste qu’une fin de tour non lue, une pastille sans chiffre. Les fils reportés
ne comptent pas.

**Réglages → Notifications dans l’app** : afficher un bandeau, choix des familles
(approbations et questions, fins de tour, erreurs), vibration légère, pastille.
Tout est activé par défaut. Préférence locale `inAppAlerts` dans
`mobile-preferences.ts`.

**Pas d’alerte** pour le fil déjà à l’écran, au lancement, au retour au premier
plan, ni pour ce qui arrive app fermée : tout cela attend en tête de Discussions,
avec la pastille. Rien non plus pour un fil archivé, reporté, masqué par le
filtre de tags, arrêté volontairement, ni pour un sous-agent, qui s’exprime par
son fil parent comme sur le Mac.

## Fonctionnement

Aucun service ni push : T4 lit l’état des fils dans le flux que l’app ouvre déjà
vers chaque environnement (`orchestration.subscribeShell`), via Tailscale. À
chaque mise à jour, le coordinateur compare l’état précédent et le nouvel état de
chaque fil, puis le filtre décide s’il y a une alerte.

Ce filtre reprend **à l’identique** celui du client T3 du Mac, pour alerter dans
les mêmes cas : une demande s’annonce une fois par identifiant, une fin de tour une
fois par heure de fin, et une fin liée à un réveil d’arrière-plan attend 5 s qu’un
autre réveil ne la remplace pas.

Retour au premier plan : le premier état reçu sert de point de départ silencieux.
Une reconnexion dans la minute qui suit fait de même.

## Code

| Fichier (`apps/mobile/src/`)                            | Rôle                                                                               |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `features/in-app-alerts/inAppAlertGate.ts`              | Copie conforme de `apps/web/src/components/ThreadNotificationCoordinator.logic.ts` |
| `features/in-app-alerts/inAppAlertModel.ts`             | Logique pure : lecture d’un fil, file d’attente, regroupement, réglages, pastille  |
| `features/in-app-alerts/inAppAlerts.ts`                 | Coordinateur : environnements suivis, premier plan, fil à l’écran, ouverture       |
| `features/in-app-alerts/InAppAlertBanner.tsx`           | Bandeau (`FullWindowOverlay` sur iOS)                                              |
| `features/in-app-alerts/useDiscussionsBadge.ts`         | Valeur de la pastille                                                              |
| `features/settings/SettingsInAppAlertsRouteScreen.tsx`  | Page de réglages, route `settings/in-app-notifications`                            |
| `App.tsx`                                               | Installation du coordinateur, chemin courant, montage du bandeau                   |
| `features/layout/workspace/WorkspaceNativeTabs.ios.tsx` | Pastille et ouverture de Discussions                                               |

Tests : `inAppAlertGate.test.ts` (copie du test web), `inAppAlertModel.test.ts`,
`inAppAlerts.test.ts`.

```bash
cd apps/mobile && vp test run --project unit src/features/in-app-alerts
```

## À chaque mise à niveau de T3

Le filtre est copié pour ne pas déplacer de fichier amont. Après l’intégration
d’une Nightly, vérifier qu’il reste identique, et reporter tout écart :

```bash
diff <(tail -n +4 apps/mobile/src/features/in-app-alerts/inAppAlertGate.ts) \
  apps/web/src/components/ThreadNotificationCoordinator.logic.ts
```

Relire aussi `observeThreads` et `watchEnvironment` dans
`apps/web/src/components/ThreadNotificationCoordinator.tsx` : `inAppAlerts.ts` et
`observeThreadForAlerts` en reprennent le déroulé.

## Vérifications et recette

Faits le 25 novembre 2026 : 32 tests des alertes, dont un test du correctif vérifié
en échec sans lui ; typecheck mobile, lint, formatage et `i18n:check` ; textes
traduits dans les 10 langues. Suite mobile complète : seuls échouent les 4 tests de
`app.config.test.ts`, qui attendent les identifiants T3 au lieu de
`fr.emaxconseils.t4` (échec antérieur). L’IPA du build 29 contient le code des
alertes ([preuve](../../../build/ios-local/build-29/verification-ipa.json), dossier
local non versionné).

Raoul a vu le bandeau du build 29 sur son Duo, depuis Discussions puis en lisant
un autre fil. Pour le build 30, les 32 tests des alertes et le contrôle de types
passent. La comparaison des deux IPA confirme le passage de 5 à 10 secondes et
de 8 à 16 secondes. Le contraste du liseré sur l’écran du Duo reste à vérifier.

**Recette sur iPhone**

1. Fin de tour d’un fil lancé depuis le Mac, T4 ouvert sur un autre fil : bandeau
   « Fil terminé », toucher ouvre le fil.
2. Même chose avec le fil ouvert dans T4 : aucun bandeau.
3. Validation demandée, puis acceptée sur le Mac : le bandeau disparaît.
4. Deux fins de tour rapprochées : un seul bandeau « 2 fils terminés », **Voir**
   ouvre Discussions.
5. Fermer T4, laisser un fil finir, revenir : aucun bandeau ; la pastille et
   Discussions montrent le fil.
6. Réglages → Notifications dans l’app : couper les fins de tour, puis la
   vibration ; couper la pastille.
7. Aspect de la pastille sans chiffre sur iOS (fin de tour non lue).

## Limites

- Rien n’arrive quand T4 est fermé ou en arrière-plan : iOS suspend l’app et le
  flux. Les notifications système exigeraient le circuit push, absent de T4.
- La pastille est posée sur la barre d’onglets de l’iPhone. La colonne d’onglets
  latérale (iPad, Duo) ne l’affiche pas encore.
- Sur iOS, la pastille sans chiffre est une pastille rouge vide : React Native
  Screens refuse une valeur vide, T4 passe une espace.
- Android est compilé mais non testé : T4 n’est livré que sur iOS.
