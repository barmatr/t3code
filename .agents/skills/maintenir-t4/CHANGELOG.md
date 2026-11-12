# Changelog — maintenir-t4

## 2026-11-12 — Hot regroupe les conversations par projet

- **Demandeur :** Raoul Barmat, conversations d'un même projet rassemblées quand hot est actif, pour une barre plus lisible.
- **Auteur de l'implémentation :** Claude Code (Claude Opus 5.5).
- **Raison :** en hot, la liste à plat mélangeait les projets ; il fallait lire l'étiquette de chaque ligne.
- **Effet pratique :** hot affiche un dossier par projet, seulement pour les projets qui ont une conversation hot, ouverts par défaut et repliables pour la session. Le mode normal de la barre ne change pas.

## 2026-11-12 — Bouton « hot » dans la barre latérale

- **Demandeur :** Raoul Barmat, le bouton hot de T4 Mobile sur T4 Code : un bouton de feu qui filtre la barre de gauche.
- **Auteur de l'implémentation :** Claude Code (Claude Opus 5.5).
- **Raison :** retrouver sur le Mac le geste du mobile ; le filtre bulle « non lues, en cours, en attente » faisait déjà ce tri, sans le repère visuel ni la règle des 5 minutes.
- **Effet pratique :** le bouton bulle devient une pastille « hot », grisée au repos, pleine et entourée en continu de la flamme bleue de ⌥Tab quand elle filtre. Un fil ouvert depuis moins de 5 minutes reste listé, et l'état survit au redémarrage. Les projets cochés restent ignorés, comme avant. Livré le 12 novembre (tag `t4-livraison-2026-11-12-4165-bouton-hot`).

## 2026-11-09 — Feu de la carte « Project focus »

- **Demandeur :** Raoul Barmat, tout le liseré enflammé au lieu de flammes qui se courent après, en mouvement pendant qu'il brûle, deux fois moins vite que la première maquette et pendant 1,4 seconde.
- **Auteur de l'implémentation :** Claude Code (Claude Opus 5.5).
- **Raison :** la flamme qui fait trois tours ne plaisait plus, et les essais par filtre SVG donnaient un motif presque figé.
- **Effet pratique :** les personnalisations décrivent le feu dessiné sur canvas, son déclenchement et son retrait après 1,4 seconde.

## 2026-11-09 — Flamme de la carte « Project focus »

- **Demandeur :** Raoul Barmat, animation de flammes ou de nitro sur le liseré bleu de la carte au moment de la mise au point, assez rapide sans excès, pendant 5 secondes ; version posée, à 3 tours, choisie sur maquette.
- **Auteur de l'implémentation :** Claude Code (Claude Opus 5.5).
- **Raison :** rendre la mise au point sur un projet visible et plaisante à l'instant où elle se produit, sans changer l'affichage de la carte.
- **Effet pratique :** les personnalisations décrivent la flamme, son déclenchement et son retrait après 5 secondes.

## 2026-11-09 — Sections par défaut et carte « Project focus »

- **Demandeur :** Raoul Barmat, sections « Settled » et « Snoozed » toujours repliées et « Working » toujours dépliée par défaut, y compris après un changement d'écran ou ⌥Tab ; focus de projet plus visible.
- **Auteur de l'implémentation :** Claude Code (Claude Opus 5.5).
- **Raison :** l'état des sections était enregistré et suivait Raoul d'un écran à l'autre, et la ligne « Focus » ne se lisait pas comme un focus de projet.
- **Effet pratique :** les personnalisations décrivent la remise à zéro des sections et la carte « Project focus ».

## 2026-11-04 — Rebase sur la Nightly `4165`

- **Demandeur :** Raoul Barmat, installation de la mise à jour en gardant le snooze propre à T4.
- **Auteur de l'implémentation :** Claude Code (Claude Opus 5.5).
- **Raison :** la cible `4080` préparée le 2 novembre était dépassée ; upstream a aligné le menu du filtre sur son bouton et placé l'épingle avant le badge d'environnement.
- **Effet pratique :** T4 reprend ces deux retouches upstream ; les personnalisations restent inchangées.

## 2026-11-02 — Rebase sur la Nightly `4080`

- **Demandeur :** Raoul Barmat, mise à jour proposée par T3, à appliquer au front T4 et au serveur T3.
- **Auteur de l'implémentation :** Claude Code (Claude Opus 5.5).
- **Raison :** upstream a intégré le filtre multi-projets, l'épinglage et l'archivage des projets ainsi qu'un réglage serveur des durées de snooze ; T4 réutilise désormais ces fondations et garde ses comportements propres.
- **Effet pratique :** les personnalisations décrivent le menu à valeur simple, l'épinglage, l'exclusion des projets archivés et le menu de snooze propre à T4.

## 2026-11-02 — Conversations « Waiting » dans le filtre non lues

- **Demandeur :** Raoul Barmat, ajout du statut « Waiting » au bouton « Show unread and working threads ».
- **Auteur de l'implémentation :** Claude Code (Claude Opus 5.5).
- **Raison :** garder visibles dans ce filtre toutes les conversations encore actives, y compris celles qui attendent une autre conversation ou une tâche de fond.
- **Effet pratique :** les personnalisations décrivent le filtre élargi et la nouvelle infobulle « Show unread, working and waiting threads ».

## 2026-11-02 — Compteurs de conversations dans ⌥Tab

- **Demandeur :** Raoul Barmat, ajout par projet du nombre de conversations Input, Working et Done, puis passage du sélecteur en anglais.
- **Auteur de l'implémentation :** Claude Code (Claude Opus 5.5).
- **Raison :** voir depuis le sélecteur quels projets attendent une réponse, travaillent encore ou ont terminé, avec le vocabulaire de T3.
- **Effet pratique :** les personnalisations décrivent les trois compteurs, leurs règles de regroupement, les libellés anglais et les nouvelles dimensions ; les pièges de construction couvrent la réinstallation du Chromium des tests.

## 2026-10-29 — Conservation du filtre à l'ouverture d'une conversation

- **Demandeur :** Raoul Barmat, maintien des projets cochés lors de « Nouveau message ».
- **Auteur de l'implémentation :** Codex (gpt-6-astra).
- **Raison :** la révélation d'une conversation pouvait effacer toute la sélection de projets.
- **Effet pratique :** conserver les coches et ajouter uniquement le projet manquant, dès l'ouverture du brouillon ; appliquer la même règle aux conversations ouvertes par l'historique, la palette ou un lien.

## 2026-10-29 — Filtre non lus visible et conversations en cours

- **Demandeur :** Raoul Barmat, demande d'un bouton visiblement activé et du maintien des conversations « Working ».
- **Auteur de l'implémentation :** Codex (gpt-6-astra).
- **Raison :** l'icône seule ne rendait pas l'activation perceptible et le filtre masquait le travail en cours.
- **Effet pratique :** les personnalisations précisent l'état actif natif du bouton et l'inclusion des conversations « Working », même déjà lues ; « Waiting » reste exclu.

## 2026-10-29 — Sélection et repli des projets anciens

- **Demandeur :** Raoul Barmat, correction du menu des projets anciens et ajout d'un dépliage indépendant.
- **Auteur de l'implémentation :** Codex (gpt-6-astra).
- **Raison :** « Older projects » était un titre non cliquable, contrairement à l'attente de sélection collective.
- **Effet pratique :** la référence des personnalisations prévoit une commande de sélection de même présentation que les projets récents, une liste ancienne repliée par défaut, un chevron indépendant et une recherche qui retrouve aussi les projets repliés. Elle rappelle le périmètre d'Option-Tab.

## 2026-10-29 — Livraison par DMG par défaut

- **Demandeur :** Raoul Barmat, après une modification de l'entonnoir restée invisible faute d'installation.
- **Auteur de l'implémentation :** Claude Code (Claude Opus 5.5).
- **Raison :** un agent s'est arrêté au commit, puis a dû retrouver dans les sauvegardes la manière habituelle de livrer.
- **Effet pratique :** le skill et une section T4 de l'`AGENTS.md` indiquent que T4 tourne depuis le DMG installé, que toute modification se livre par build, installation avec sauvegarde et relance, et que seule la fermeture de T4 attend l'accord de Raoul.

## 2026-10-27 — Rebase sur la Nightly `3754`

- **Demandeur :** Raoul Barmat, demande de récupérer les nouveautés de la Nightly dans T4.
- **Auteur de l'implémentation :** Claude Code (Claude Opus 5.5).
- **Raison :** le rebase de la base `3457` vers `3754` a révélé une nouvelle logique upstream de révélation de la conversation ouverte, un correctif `node-pty` devenu inutile, un runtime Node 26 et un échec de build faute d'espace disque.
- **Effet pratique :** les personnalisations décrivent la sortie du focus lors d'une révélation ; les pièges de construction couvrent le retrait du correctif `node-pty`, le runtime exigé et l'espace disque à vérifier avant le build.

## 2026-10-27 — Création

- **Demandeur :** Raoul Barmat, accord « ok go » dans le fil T4.
- **Auteur de l'implémentation :** Codex (gpt-6-astra).
- **Provenance :** `local-custom` ; procédure rédigée à partir de la conversation et du dépôt local vérifié.
- **Contexte et raison :** conserver les personnalisations T4 et pouvoir les reprendre lors des mises à jour T3 Nightly, y compris quand le travail est lancé depuis le client T4.
- **Développement :** skill local, critères fonctionnels à préserver, préparation en worktree, contrôles ciblés, construction, installation avec sauvegarde et restauration ; métadonnées de découverte du skill.
- **Effet pratique :** un agent dispose d'une procédure explicite et des critères de livraison. L'ancien script d'installation reste identifié comme prototype à ne pas exécuter tel quel. Cette création ne met pas à jour l'application et n'ajoute pas d'automatisation récurrente.
