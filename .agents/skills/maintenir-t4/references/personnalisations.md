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
- « All recent projects » efface le filtre et ferme la liste ; une sélection vide signifie les projets récents (demande de Raoul du 29 octobre 2026).
- Un projet est récent si un humain a écrit dans l'une de ses conversations depuis moins de 14 jours. Seule la date du dernier message humain (`latestUserAuthoredMessageAt`) date une conversation : snooze, réveil, réponses d'agent, clôture ou création n'y changent rien. Conversations archivées, supprimées et sous-agents exclus. Un projet est aussi récent s'il a été ajouté depuis moins de 14 jours. Le projet de la conversation ouverte reste visible même s'il est ancien. Sans aucun projet récent, le filtre vide montre tout et le libellé redevient « All projects ».
- Le shell ne transmet que les 25 dernières conversations terminées : `useRecentProjectKeys` lit les pages plus anciennes (`olderSettledThreads.pagesAtom`) jusqu'à sortir de la fenêtre. Une conversation se termine après son dernier message, donc rien de récent n'est manqué.
- Menu : « All recent projects » en tête, puis les projets récents, puis « Older projects », cliquable et de même présentation. Cliquer sur ce dernier sélectionne exclusivement tous les projets anciens, efface le focus et ferme le menu ; ces coches délimitent aussi la recherche de conversations et ⌥Tab.
- Les projets anciens sont repliés par défaut. Le chevron à côté de « Older projects » déplie ou replie uniquement leur liste sans changer les coches, le focus ou le menu ouvert. Ce choix reste en mémoire pendant la session ; les flèches droite/gauche font de même lorsque la ligne est surlignée au clavier. Une recherche de projet parcourt aussi les anciens repliés, puis retrouve l'état de repli en effaçant la recherche. Sans projet récent, conserver le repli existant vers « All projects » et la liste complète.
- Chaque groupe suit un tri alphanumérique naturel français, insensible à la casse, avec les nombres comparés numériquement. Depuis la base `4080`, les projets épinglés upstream passent en tête de leur groupe ; les projets archivés upstream sortent du menu et du filtre (`pickableProjectGroups`).
- Depuis la base `4080`, le menu repose sur le Combobox à valeur simple d'upstream : le Shift-clic annule la validation de Base UI (`eventDetails.cancel()`) et bascule la coche ; la ligne « Older projects » reçoit son chevron dans la ligne upstream (badge de sélection, épingle).
- Le filtre vide limite aussi la recherche de conversations et les candidats ⌥Tab aux projets récents ; la sortie du focus s'appelle alors « All recent projects ».
- Ce tri concerne le menu entonnoir. Il ne modifie ni le tri de la barre latérale ni l'ordre des projets récemment utilisés par ⌥Tab.
- La liste montre jusqu'à « All projects » et 19 projets avant de défiler (popup `size="tall"`, 40rem au plus), dans la limite de la hauteur de la fenêtre. Demande de Raoul du 29 octobre 2026 ; upstream s'arrête à environ 9 projets.
- Les coches sont persistantes. Modifier ce filtre efface le focus secondaire éventuel.
- Créer une conversation conserve les projets cochés. Si son projet n'est pas coché, l'ajouter à la sélection dès l'ouverture du brouillon, y compris lorsqu'un brouillon existant est réutilisé. Même règle pour une conversation ouverte depuis l'historique, la palette ou un lien : ne jamais vider les coches pour la rendre visible. Une sélection vide garde son sens implicite de projets récents. Demande de Raoul du 29 octobre 2026.
- Ouvrir une conversation fait sortir du focus temporaire s'il masque son projet ; conserver le focus s'il correspond à ce projet. Ce choix adapte au multi-projets la révélation upstream (`sidebar/routeReveal.ts`), qui repasse le filtre à tous les projets.

Repères : [Sidebar.tsx](../../../../apps/web/src/components/Sidebar.tsx) et [uiStateStore.ts](../../../../apps/web/src/uiStateStore.ts). Vérifier la migration de l'ancien état monoprojet si elle est touchée.

## Raccourci ⌥Tab et focus

- Le raccourci natif est **Option + Tab**, actif lorsque T4 est au premier plan ; Command + Tab reste au système. Son activation se règle dans Settings → Keybindings → T4 projects.
- Les candidats sont les projets cochés dans l'entonnoir ; sans coche, ce sont les projets récents et le projet de la conversation ouverte (tous les projets si aucun n'est récent). Déplier ou replier « Older projects » ne modifie pas ces candidats.
- L'ordre suit les projets récemment utilisés : après A → B, une nouvelle pression puis un relâchement revient sur A. Les Tab supplémentaires parcourent les autres candidats ; l'ordre reste fixe pendant le maintien d'Option.
- Relâcher Option valide ; Shift + Tab recule ; Échap annule sans changer le focus ou la conversation.
- Choisir un projet sous-filtre la barre latérale sans modifier les coches du filtre principal. Le sélecteur ne doit pas ouvrir une table de sessions à la place du chat.
- Le choix ouvre aussi la conversation du projet dont `updatedAt` est le plus récent, en excluant les conversations archivées, supprimées et les sous-agents. Respecter l'environnement du projet, y compris pour les projets regroupés. Sans conversation éligible, ouvrir le brouillon via le gestionnaire existant.
- « All selected projects » se trouve en fin de sélecteur et dans le bouton de sortie du focus. Sans filtre principal, le libellé devient « All recent projects » (ou « All projects » si aucun n'est récent). Cette sortie réaffiche les projets sans forcer un changement de conversation.

Limites actuelles : l'historique récent et le focus sont des états de session ; leur persistance après redémarrage n'a pas été demandée. La mécanique de focus cible la barre latérale moderne ; ne pas annoncer une couverture du mode historique sans la vérifier.

Présentation du focus (demande de Raoul du 9 novembre 2026) : une carte « Project focus » en haut de la barre latérale, à l'accent indigo du sélecteur, nomme le projet et porte le bouton de sortie. Elle remplace la ligne « Focus: <projet> » et le texte centré, trop discrets pour être compris comme un focus de projet. Fichiers : [ProjectFocusCard.tsx](../../../../apps/web/src/components/projectSwitcher/ProjectFocusCard.tsx) et son module CSS.

Feu du focus (demande de Raoul du 9 novembre 2026) : à chaque mise au point sur un projet, tout le liseré de la carte s'embrase pendant 1,4 seconde, sans flamme qui court, à la vitesse de flammes retenue par Raoul sur maquette. Le feu est dessiné sur un canvas par [focusFire.ts](../../../../apps/web/src/components/projectSwitcher/focusFire.ts) : un bruit lissé qui défile vers le haut donne des flammes qui montent réellement, là où les filtres SVG essayés d'abord paraissaient figés. Le canvas se retire ensuite pour que rien ne tourne en continu. Le feu se rallume quand le focus change de projet et ne part pas au lancement, car le focus n'est pas restauré. La carte n'a plus de `overflow: hidden` pour laisser le feu déborder, et `prefers-reduced-motion` l'empêche de partir. Mêmes fichiers.

Repères : [ProjectSwitcher.tsx](../../../../apps/web/src/components/projectSwitcher/ProjectSwitcher.tsx), [logique et choix de conversation](../../../../apps/web/src/components/projectSwitcher/projectSwitcher.logic.ts), [raccourci natif](../../../../apps/desktop/src/window/ProjectSwitcherShortcuts.ts), [intégration de fenêtre](../../../../apps/desktop/src/window/DesktopWindow.ts) et [guide utilisateur](../../../../docs/user/thread-sidebar.md).

## Sections de la barre latérale

- Demande de Raoul du 9 novembre 2026 : **Working** est dépliée par défaut, **Snoozed** et **Settled** sont repliées. L'état n'est plus enregistré entre deux écrans ni entre deux lancements (les anciennes clés `t3code:sidebar:*-expanded` ne sont plus lues).
- Un clic sur l'en-tête bascule la section jusqu'au prochain changement d'écran. Tout changement de chemin de route (autre conversation, brouillon, Settings), de portée des projets ou de focus restaure les valeurs par défaut, y compris un clic sur une conversation à l'intérieur de la section.
- Un choix validé avec ⌥Tab les restaure aussi, même s'il ne change ni le focus ni la conversation ; Échap ne touche à rien. La conversation ouverte reste visible dans une section repliée.

Repères : [useSidebarShelves.ts](../../../../apps/web/src/components/sidebar/useSidebarShelves.ts), `sidebarShelfResetCount` dans [uiStateStore.ts](../../../../apps/web/src/uiStateStore.ts) et `choose` dans [ProjectSwitcher.tsx](../../../../apps/web/src/components/projectSwitcher/ProjectSwitcher.tsx).

## Présentation du sélecteur

- Fond étoilé repris du haut de la barre latérale, bordure visible, cartes homogènes et sélection contrastée.
- Largeur maximale de 800 px, soit 25 % de plus que les 640 px initiaux, limitée à la place disponible.
- Cartes et icônes réduites d'un quart le 27 octobre 2026 : icône de 42 px, cartes de même largeur, 111 px au minimum. Une seule rangée tant qu'elle suffit, puis deux étages. Au-delà de deux rangées, la liste défile verticalement et laisse dépasser le haut de la troisième ; jamais de défilement horizontal.
- Demande de Raoul du 2 novembre 2026 : le sélecteur, son réglage et le bouton de sortie du focus sont en anglais, comme T3. Les compteurs reprennent les mots et les icônes des lignes de conversation de la barre latérale, et non les anciennes pastilles « Completed » ou « Awaiting Input ».
- Chaque carte affiche sous le nom trois lignes (icône, libellé, nombre) : **Input** regroupe input, approbation et requête invité ; **Working** regroupe « Working » et « Waiting » ; **Done** compte les tours terminés non ouverts depuis. Les conversations archivées, supprimées et les sous-agents sont exclus ; échecs, limites et réveils ne sont pas comptés. Un zéro reste affiché, estompé. La dernière carte totalise les projets du sélecteur ; la ligne d'état du bas reprend les nombres de la carte sélectionnée.
- Les nombres sont relus à l'ouverture et à chaque Tab, sans abonnement tant que le sélecteur est fermé. Avec ces lignes, les cartes mesurent 180 px de haut et le sélecteur 660 px au plus, pour garder deux rangées entières.
- Mention « 🚀 Powered by Raobar » en bas à droite avec le portrait fourni, déjà stylisé, affiché en rond.
- Lisibilité en thème clair, sombre et fenêtre étroite ; respect de la réduction des animations.

Repères : [styles du sélecteur](../../../../apps/web/src/components/projectSwitcher/projectSwitcher.module.css), [portrait](../../../../apps/web/src/components/projectSwitcher/raobar-avatar.png) et [icône T4](../../../../assets/t4/t4-macos-1024.png).

## Choix de mise en veille (snooze)

- Demande de Raoul du 29 octobre 2026 : le menu **Snooze** propose, dans cet ordre, « This evening » à 19:00, « Tomorrow » à 9:00, « This weekend » le samedi à 8:00 et « Next week » le lundi à 9:00, puis « Custom… ». Les choix « In 1 hour » et « In 3 hours » d'upstream sont retirés.
- « This evening » disparaît à moins d'une heure de 19:00 ; « This weekend » n'est proposé que du lundi au vendredi ; « Next week » disparaît le dimanche, où il coïnciderait avec « Tomorrow ».
- La liste est commune au clic droit, à l'icône horloge et au menu d'actions de T4. Depuis la base `4080`, upstream propose un réglage serveur `snoozePresets`, partagé avec ses clients officiels : T4 l'ignore, car ce réglage ne sait exprimer ni « This weekend » ni la coupure à moins d'une heure de 19:00. L'app mobile officielle suit donc son propre menu.

Repères : [threadSettled.ts](../../../../packages/client-runtime/src/state/threadSettled.ts) (`resolveT4SnoozePresets`), [libellés web](../../../../apps/web/src/components/Sidebar.snooze.ts) et [tests](../../../../packages/client-runtime/src/state/threadSnoozed.test.ts).

## Bouton « hot » (filtre des conversations à suivre)

- Demande de Raoul du 29 octobre 2026 : un bouton, à gauche de l'entonnoir, filtre les conversations qui attendent Raoul : demande d'approbation ou d'input, requête invité, échec, limite d'usage, réveil de snooze non vu, ou fin de tour (« done ») non vue depuis la dernière visite.
- À la demande de Raoul du 29 octobre 2026, les conversations en cours (« Working ») restent visibles dans ce filtre, même déjà lues. Depuis sa demande du 2 novembre 2026, les conversations « Waiting » (en attente d'une autre conversation ou d'une tâche de fond) le restent aussi.
- Depuis sa demande du 12 novembre 2026, ce filtre reprend le bouton **hot** de T4 Mobile : pastille ronde « hot » grisée quand il est inactif, pleine (couleur primaire) quand il est actif, entourée en continu de la flamme bleue de la carte Project focus, en version réduite (`HOT_BUTTON_FIRE`). La flamme disparaît si le système demande de réduire les animations. L'état est conservé après un redémarrage (`localStorage`, clé `t4:sidebar-hot`), comme sur le mobile.
- Comme sur le mobile, une conversation ouverte depuis moins de 5 minutes reste listée, d'après l'heure d'ouverture enregistrée par le serveur (`opens.openedAt`). Le contrôle se fait à la minute : elle sort entre 5 et 6 minutes après l'ouverture.
- Le filtre ignore les projets cochés et le focus, sans modifier leur configuration (choix du 29 octobre conservé ; T4 Mobile garde, lui, ses filtres machine et projet).
- La conversation ouverte reste listée une fois lue, jusqu'à l'ouverture d'une autre.
- Limite connue : une conversation classée peut rester dans l'étagère « Settled » repliée.

Repères : [Sidebar.tsx](../../../../apps/web/src/components/Sidebar.tsx) (`hotOnly`), [HotFilterButton.tsx](../../../../apps/web/src/components/sidebar/HotFilterButton.tsx), [focusFire.ts](../../../../apps/web/src/components/projectSwitcher/focusFire.ts) (`burnFire`) et [Sidebar.logic.ts](../../../../apps/web/src/components/Sidebar.logic.ts) (`matchesUnreadThreadFilter`, `threadOpenedRecently`).

## Pièges de construction déjà rencontrés

- **`node-pty`** : jusqu'à la base `3457`, la plage `^1.2.0-beta.15` pouvait résoudre une bêta plus récente que le patch local (`ERR_PNPM_UNUSED_PATCH`). Depuis la base `3754`, upstream fixe cette version dans les `overrides` de [pnpm-workspace.yaml](../../../../pnpm-workspace.yaml) (#23798) ; le correctif T4 a été retiré. Vérifier la cohérence du patch et des overrides si l'erreur réapparaît.
- **Runtime** : les bases `3754` et `4080` exigent Node `26.12.1` (`engines` de [package.json](../../../../package.json)) et pnpm `12.14.0`. Installer le runtime manquant avec `vp env install node@<version>` avant `vp i`.
- **Espace disque** : le build a échoué en `ENOSPC` avec moins de 1 Go libre. Vérifier `df -h /System/Volumes/Data` avant de construire et garder au moins 3 Go libres : le serveur T3 actif écrit sur le même disque.
- **Navigateur des tests** : un nettoyage du disque peut effacer le Chromium de Playwright dans `~/Library/Caches/ms-playwright` ; les tests navigateur échouent alors au lancement (`Executable doesn't exist`). Le réinstaller avec `apps/web/node_modules/.bin/playwright install --only-shell chromium` (constaté le 2 novembre 2026).
- **Relance depuis un agent** : un agent lancé par le serveur T3 hérite de `ELECTRON_RUN_AS_NODE=1`. `open -b fr.barmat.t4code` lance alors T4 comme un simple Node, qui se ferme aussitôt sans fenêtre ni journal. Relancer avec `env -u ELECTRON_RUN_AS_NODE open -b fr.barmat.t4code` (constaté le 29 octobre 2026).
