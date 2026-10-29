# Changelog — maintenir-t4

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
