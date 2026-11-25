# Statut Amphetamine dans T4 Mobile

T4 Mobile peut afficher **Amphetamine · Mac** sous **Réglages → Connexions** lorsque le Mac appairé est connecté et inclus dans le filtre d’environnement. Dans une sélection Linux seule, la ligne est absente. Le service s’exécute dans la session macOS de l’utilisateur et son accès HTTPS passe par Tailscale Serve.

## Préparer le service

Depuis la racine de `t4mobile`, dans la session du Mac. Il faut les outils de compilation Swift et le Python 3 fourni par les outils Apple (`/usr/bin/python3`).

```bash
mac_environment_id="$(curl -fsS http://127.0.0.1:3773/.well-known/t3/environment | jq -er '.environmentId')"
scripts/t4/amphetamine/prepare.sh build/amphetamine-status "$mac_environment_id"
```

Adapter le port `3773` dans la lecture si le port du serveur T3 local change. La commande produit une app de lecture macOS, ses droits de signature et un LaunchAgent. Le plist est généré pour le compte qui lance la préparation. Utiliser un autre dossier de sortie pour reconstruire le kit.

## Installer et autoriser la lecture sur le Mac

Depuis le dossier de livraison, signer le kit avec une identité macOS disponible dans le Trousseau. Une identité Apple Development convient pour une installation locale sur le Mac de développement. Garder l’identité et le chemin stables pour les mises à jour de la sonde.

```bash
app='T4 Amphetamine Status.app'
label='fr.emaxconseils.t4.amphetamine-status'
codesign --force --sign "$T4_MAC_SIGNING_IDENTITY" --options runtime --timestamp=none \
  --entitlements automation.entitlements "$app"
codesign --verify --strict "$app"
mkdir -p "$HOME/Applications" "$HOME/Library/LaunchAgents"
ditto "$app" "$HOME/Applications/$app"
open -W "$HOME/Applications/$app" --args --authorize
cp "$label.plist" "$HOME/Library/LaunchAgents/$label.plist"
launchctl bootstrap "gui/$(id -u)" "$HOME/Library/LaunchAgents/$label.plist"
curl -fsS http://127.0.0.1:18773/v1/amphetamine
```

Avec Amphetamine lancé, valider la demande « Automatisation » si macOS l’affiche. L’état `unavailable` indique que la lecture n’a pas abouti. Vérifier d’abord l’autorisation d’automatisation et la session graphique qui exécute le LaunchAgent. En cas de mise à jour d’un service déjà installé, le décharger avant de remplacer l’app puis le charger à nouveau.

## Rendre le statut accessible à l’iPhone

Vérifier dans `tailscale serve status` que le port HTTPS `18443` est libre. Restreindre son accès dans la politique du tailnet aux appareils ou comptes autorisés à lire le statut. Le client ne transmet aucun identifiant d’accès T3 au service. Activer HTTPS sur le tailnet si nécessaire.

```bash
tailscale serve --bg --https=18443 http://127.0.0.1:18773
tailscale serve status
```

Utiliser le nom DNS HTTPS affiché par Tailscale. Depuis l’iPhone connecté à Tailscale, avec le Wi-Fi du Mac hors du parcours de test, l’URL `https://<nom-tailscale>:18443/v1/amphetamine` doit renvoyer le même environnement et le même état que le contrôle local.

Renseigner les deux valeurs dans le `.env.local` ignoré à la racine du dépôt, ou dans l’environnement de compilation de T4 Mobile. Elles sont embarquées dans l’app et identifient la route et le Mac. Elles ne donnent aucun droit d’accès au tailnet.

```dotenv
T4_AMPHETAMINE_STATUS_ORIGIN=https://<nom-tailscale>:18443
T4_AMPHETAMINE_ENVIRONMENT_ID=<identifiant-renvoyé-par-le-serveur-T3-du-Mac>
```

Suivre la [procédure TestFlight](../../../T4-TESTFLIGHT-REPRISE.md) pour le build signé et la diffusion à **T4 Interne**. Vérifier la ligne sur l’iPhone avec le filtre Mac, puis sélectionner le distant Linux seul et vérifier qu’elle disparaît. Pour retirer le service, désactiver son port et décharger le LaunchAgent.

```bash
tailscale serve --https=18443 off
launchctl bootout "gui/$(id -u)/fr.emaxconseils.t4.amphetamine-status"
rm "$HOME/Library/LaunchAgents/fr.emaxconseils.t4.amphetamine-status.plist"
```

[Tailscale Serve](https://tailscale.com/docs/reference/tailscale-cli/serve) · [Autorisation Apple Events](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.security.automation.apple-events)

## Protocole et fréquence

`GET /v1/amphetamine` renvoie une réponse JSON versionnée avec `environmentId` et `status`. Le service écoute sur `127.0.0.1:18773`. Un accès concurrent réutilise le même relevé pendant dix minutes. Le service lit la session à la demande et attend sans minuterie de lecture entre les requêtes.

- `timed` contient aussi `remainingSeconds`. Un compteur arrivé à zéro entre deux relevés signifie « Fin estimée atteinte ».
- `unlimited`, `trigger`, `conditional`, `inactive` et `closed` reflètent les états documentés par Amphetamine et la présence du processus.
- `unavailable` couvre les erreurs de lecture. Le mobile affiche aussi cet état si l’URL est injoignable ou si le serveur renvoie un identifiant d’environnement différent.

Le mobile lit à l’ouverture des Réglages si le dernier relevé date d’au moins dix minutes. Tant que la page est visible et l’app au premier plan, il relit toutes les dix minutes et actualise le décompte à la minute.

## Vérifier en local

```bash
PYTHONDONTWRITEBYTECODE=1 /usr/bin/python3 -m unittest discover -s scripts/t4/amphetamine -v
(cd apps/mobile && vp test run --project unit src/features/settings/amphetamine-status.test.ts)
(cd apps/mobile && vp test run --project react src/features/settings/AmphetamineSettingsRow.test.tsx)
```
