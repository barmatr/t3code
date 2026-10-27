# Changelog — maintenir-t4

## 2026-10-27 — Création

- **Demandeur :** Raoul Barmat, accord « ok go » dans le fil T4.
- **Auteur de l'implémentation :** Codex (gpt-6-astra).
- **Provenance :** `local-custom` ; procédure rédigée à partir de la conversation et du dépôt local vérifié.
- **Contexte et raison :** conserver les personnalisations T4 et pouvoir les reprendre lors des mises à jour T3 Nightly, y compris quand le travail est lancé depuis le client T4.
- **Développement :** skill local, critères fonctionnels à préserver, préparation en worktree, contrôles ciblés, construction, installation avec sauvegarde et restauration ; métadonnées de découverte du skill.
- **Effet pratique :** un agent dispose d'une procédure explicite et des critères de livraison. L'ancien script d'installation reste identifié comme prototype à ne pas exécuter tel quel. Cette création ne met pas à jour l'application et n'ajoute pas d'automatisation récurrente.
