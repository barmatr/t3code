---
name: maintenir-t4
description: "Maintenir le fork local T4 Code sur macOS : modifier ses personnalisations, le mettre à jour depuis T3 Nightly, construire et installer le client, ou revenir à la version précédente en préservant le serveur T3."
metadata:
  created-at: "2026-10-27"
  requested-by: "Raoul Barmat"
  authored-by: "Codex (gpt-6-astra)"
  provenance: "local-custom"
  creation-context: "Création autorisée dans le fil T4 après définition du suivi des personnalisations et du processus de mise à jour du fork."
---

# Maintenir T4

Utiliser ce skill dans le dépôt T4, actuellement `/Users/jrbmt/Desktop/workspace/t4code`, même si la conversation a démarré ailleurs. Résoudre la racine réelle et lire son [AGENTS.md](../../../AGENTS.md) avant toute modification. Les chemins ci-dessous sont relatifs à cette racine, sauf indication contraire.

## Choisir le travail demandé

- **Modifier une fonctionnalité** : lire les [personnalisations à préserver](references/personnalisations.md), changer le périmètre demandé et vérifier les comportements concernés. Lire la procédure d'installation seulement si la livraison dans l'application fait partie de la demande.
- **Mettre à jour T4 depuis T3 Nightly** : suivre la [procédure de maintenance](references/maintenance.md) depuis l'identification des versions jusqu'à la vérification du client installé.
- **Reconstruire, installer, relancer ou restaurer T4** : utiliser les sections correspondantes de cette même procédure ; une reconstruction n'implique pas de changer la base upstream.
- **Faire un état des lieux** : rester en lecture seule et distinguer sources locales, application installée et serveur réellement connecté.

Réutiliser les autorisations de la conversation. Une demande de mise à jour complète inclut sa préparation, les contrôles, l'installation et la relance ; une demande limitée au skill ou à un diagnostic ne les déclenche pas. Respecter la règle du dépôt sur l'autorisation du contrôle de l'ordinateur, sans redemander un accord déjà donné pour le travail en cours.

## Préserver l'installation de travail

T4 est ici le **client personnalisé du serveur officiel T3**. Cette séparation permet de remplacer le client tout en laissant les agents s'exécuter sur leur serveur. La vérifier dans la configuration et la connexion effectives avant une fermeture.

- Garder `/Applications/T3 Code (Nightly).app` et son serveur actifs pendant la mise à jour de T4.
- Cibler uniquement `/Applications/T4 Code.app`. L'identité attendue est `fr.barmat.t4code`.
- Conserver les données T4 dans `~/.t4/userdata` et son profil Electron dans `~/Library/Application Support/t4code`. Préserver connexions, réglages, thèmes et filtres existants.
- Respecter l'interdiction du dépôt de démarrer un serveur ou d'écrire dans `~/.t3/userdata`. Les tests utilisent un état isolé.
- Laisser les mises à jour automatiques de T4 désactivées : la distribution officielle remplacerait les personnalisations.

## Garder une version reproductible

Le code, les assets, les tests et ce skill vivent dans Git. Le skill décrit la procédure ; il ne constitue pas une sauvegarde des modifications.

Avant une mise à jour upstream, inventorier aussi les fichiers non suivis. Les personnalisations à emporter doivent être présentes dans le commit T4 de départ : un nouveau worktree ne reprend pas les changements non commités. Si la demande couvre leur versionnement, relire puis committer uniquement le périmètre T4 identifié ; sinon signaler ce préalable et poursuivre les travaux indépendants. Préserver les changements hors sujet et ne pas les masquer par un stash automatique.

Associer chaque livraison à la base upstream exacte, au SHA T4 construit et au SHA-256 de l'artefact. Un numéro de version d'application seul ne suffit pas. Le push au fork et la création d'une PR restent limités à la demande ; le dépôt interdit les PR spontanées.

Après une évolution de comportement, actualiser la référence des personnalisations concernée. Pour une évolution significative du skill, renseigner son [CHANGELOG.md](CHANGELOG.md) avec date, demandeur, auteur, raison et effet pratique. Proposer les autres mises à jour de changelog selon les règles du projet.

## Rendre le résultat vérifiable

Rapporter les modifications réalisées, les contrôles effectivement passés, la version installée si elle a changé, la sauvegarde disponible et les limites restantes. Distinguer « source modifiée », « build réussi », « installé » et « vérifié dans l'application ». Un contrôle du clavier automatisé qui ne déclenche pas le raccourci natif n'est pas une validation de ⌥Tab.
