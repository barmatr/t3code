# Personnalisations à préserver

Ces critères viennent des choix de Raoul dans le fil T4 et ont été recoupés avec le code le 27 octobre 2026. Une nouvelle demande explicite peut les faire évoluer. Les tests et le code indiquent l'implémentation actuelle ; cette référence conserve l'intention pour les prochains rebases.

## Identité et données

- Nom et logo **T4 Code**, icône verte distincte dans le Dock, bundle `fr.barmat.t4code` et schéma d'ouverture `t4code`.
- T4 utilise le serveur T3 connecté ; son environnement serveur local est désactivé par défaut. Les profils et données des deux applications restent séparés.
- Les réglages graphiques ont été repris de T3 une première fois. Une mise à jour préserve les réglages désormais présents dans T4 ; elle ne recopie pas systématiquement le profil de T3.

Repères : [DesktopEnvironment.ts](../../../../apps/desktop/src/app/DesktopEnvironment.ts), [DesktopConfig.ts](../../../../apps/desktop/src/app/DesktopConfig.ts), [DesktopStatePaths.ts](../../../../apps/desktop/src/app/DesktopStatePaths.ts), [DesktopUserData.ts](../../../../apps/desktop/src/app/DesktopUserData.ts), [DesktopAppSettings.ts](../../../../apps/desktop/src/settings/DesktopAppSettings.ts) et [construction de l'artefact](../../../../scripts/build-desktop-artifact.ts).

## Filtre entonnoir

- Un clic simple sélectionne exclusivement le projet cliqué et ferme la liste, même si ce projet était déjà coché.
- Shift-clic ajoute ou retire un projet et garde la liste ouverte.
- « All projects » efface le filtre et ferme la liste ; une sélection vide signifie tous les projets.
- « All projects » reste en tête. Les noms suivants suivent un tri alphanumérique naturel français, insensible à la casse, avec les nombres comparés numériquement.
- Ce tri concerne le menu entonnoir. Il ne modifie ni le tri de la barre latérale ni l'ordre des projets récemment utilisés par ⌥Tab.
- Les coches sont persistantes. Modifier ce filtre efface le focus secondaire éventuel.
- Une conversation ouverte depuis l'historique, la palette ou un lien alors que le focus la masque fait sortir du focus. Les coches ne sont effacées que si elles la masquent aussi. Ce choix adapte au multi-projets la révélation upstream (`sidebar/routeReveal.ts`), qui repasse le filtre à tous les projets.

Repères : [Sidebar.tsx](../../../../apps/web/src/components/Sidebar.tsx) et [uiStateStore.ts](../../../../apps/web/src/uiStateStore.ts). Vérifier la migration de l'ancien état monoprojet si elle est touchée.

## Raccourci ⌥Tab et focus

- Le raccourci natif est **Option + Tab**, actif lorsque T4 est au premier plan ; Command + Tab reste au système. Son activation se règle dans Settings → Keybindings → Projets T4.
- Les candidats sont les projets cochés dans l'entonnoir, ou tous les projets quand le filtre est vide.
- L'ordre suit les projets récemment utilisés : après A → B, une nouvelle pression puis un relâchement revient sur A. Les Tab supplémentaires parcourent les autres candidats ; l'ordre reste fixe pendant le maintien d'Option.
- Relâcher Option valide ; Shift + Tab recule ; Échap annule sans changer le focus ou la conversation.
- Choisir un projet sous-filtre la barre latérale sans modifier les coches du filtre principal. Le sélecteur ne doit pas ouvrir une table de sessions à la place du chat.
- Le choix ouvre aussi la conversation du projet dont `updatedAt` est le plus récent, en excluant les conversations archivées, supprimées et les sous-agents. Respecter l'environnement du projet, y compris pour les projets regroupés. Sans conversation éligible, ouvrir le brouillon via le gestionnaire existant.
- « Tous les projets sélectionnés » se trouve en fin de sélecteur et dans le bouton de sortie du focus. Sans filtre principal, le libellé devient « Tous les projets ». Cette sortie réaffiche les projets sans forcer un changement de conversation.

Limites actuelles : l'historique récent et le focus sont des états de session ; leur persistance après redémarrage n'a pas été demandée. La mécanique de focus cible la barre latérale moderne ; ne pas annoncer une couverture du mode historique sans la vérifier.

Repères : [ProjectSwitcher.tsx](../../../../apps/web/src/components/projectSwitcher/ProjectSwitcher.tsx), [logique et choix de conversation](../../../../apps/web/src/components/projectSwitcher/projectSwitcher.logic.ts), [raccourci natif](../../../../apps/desktop/src/window/ProjectSwitcherShortcuts.ts), [intégration de fenêtre](../../../../apps/desktop/src/window/DesktopWindow.ts) et [guide utilisateur](../../../../docs/user/thread-sidebar.md).

## Présentation du sélecteur

- Fond étoilé repris du haut de la barre latérale, bordure visible, cartes homogènes et sélection contrastée.
- Largeur maximale de 800 px, soit 25 % de plus que les 640 px initiaux, limitée à la place disponible.
- Cartes et icônes réduites d'un quart le 27 octobre 2026 : icône de 42 px, cartes de même largeur, 111 px au minimum. Une seule rangée tant qu'elle suffit, puis deux étages. Au-delà de deux rangées, la liste défile verticalement et laisse dépasser le haut de la troisième ; jamais de défilement horizontal.
- Mention « 🚀 Powered by Raobar » en bas à droite avec le portrait fourni, déjà stylisé, affiché en rond.
- Lisibilité en thème clair, sombre et fenêtre étroite ; respect de la réduction des animations.

Repères : [styles du sélecteur](../../../../apps/web/src/components/projectSwitcher/projectSwitcher.module.css), [portrait](../../../../apps/web/src/components/projectSwitcher/raobar-avatar.png) et [icône T4](../../../../assets/t4/t4-macos-1024.png).

## Choix de mise en veille (snooze)

- Demande de Raoul du 29 octobre 2026 : le menu **Snooze** propose, dans cet ordre, « This evening » à 19:00, « Tomorrow » à 9:00, « This weekend » le samedi à 8:00 et « Next week » le lundi à 9:00, puis « Custom… ». Les choix « In 1 hour » et « In 3 hours » d'upstream sont retirés.
- « This evening » disparaît à moins d'une heure de 19:00 ; « This weekend » n'est proposé que du lundi au vendredi ; « Next week » disparaît le dimanche, où il coïnciderait avec « Tomorrow ».
- La liste est commune au clic droit, à l'icône horloge, au menu d'actions et à l'app mobile.

Repères : [threadSettled.ts](../../../../packages/client-runtime/src/state/threadSettled.ts) (`resolveSnoozePresets`), [libellés web](../../../../apps/web/src/components/Sidebar.snooze.ts) et [tests](../../../../packages/client-runtime/src/state/threadSnoozed.test.ts).

## Pièges de construction déjà rencontrés

- **`node-pty`** : jusqu'à la base `3457`, la plage `^1.2.0-beta.15` pouvait résoudre une bêta plus récente que le patch local (`ERR_PNPM_UNUSED_PATCH`). Depuis la base `3754`, upstream fixe cette version dans les `overrides` de [pnpm-workspace.yaml](../../../../pnpm-workspace.yaml) (#23798) ; le correctif T4 a été retiré. Vérifier la cohérence du patch et des overrides si l'erreur réapparaît.
- **Runtime** : la base `3754` exige Node `26.12.1` (`engines` de [package.json](../../../../package.json)) et pnpm `12.14.0`. Installer le runtime manquant avec `vp env install node@<version>` avant `vp i`.
- **Espace disque** : le build a échoué en `ENOSPC` avec moins de 1 Go libre. Vérifier `df -h /System/Volumes/Data` avant de construire et garder au moins 3 Go libres : le serveur T3 actif écrit sur le même disque.
- **Relance depuis un agent** : un agent lancé par le serveur T3 hérite de `ELECTRON_RUN_AS_NODE=1`. `open -b fr.barmat.t4code` lance alors T4 comme un simple Node, qui se ferme aussitôt sans fenêtre ni journal. Relancer avec `env -u ELECTRON_RUN_AS_NODE open -b fr.barmat.t4code` (constaté le 29 octobre 2026).
