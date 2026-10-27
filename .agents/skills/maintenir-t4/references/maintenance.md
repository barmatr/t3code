# Mise à jour, installation et retour arrière

## 1. Établir le point de départ

Depuis la racine T4, relever la branche, `git status --short`, le SHA complet de HEAD, les worktrees et les remotes. Vérifier les versions installées avec les `Contents/Info.plist` de T3 et T4, ainsi que l'environnement serveur auquel T4 est réellement connecté. N'afficher ni jetons de connexion ni contenu des profils.

Repère initial vérifié le **27 octobre 2026**, à revalider lors de chaque intervention :

| Élément               | Valeur observée                                                      |
| --------------------- | -------------------------------------------------------------------- |
| Dépôt principal       | `/Users/jrbmt/Desktop/workspace/t4code`                              |
| Branche               | `t4`                                                                 |
| Upstream              | `https://github.com/pingdotgg/t3code.git`                            |
| Fork personnel        | `https://github.com/barmatr/t3code.git` (remote `fork`)              |
| Base upstream         | `e64766c56ac6fc1678e6107052feb0047a35337f`                           |
| Tag de cette base     | `v0.1.2-nightly.20261021.3457`                                       |
| Applications T3 et T4 | `0.1.2-nightly.20261021.3457`                                        |
| Personnalisations     | Présentes dans l'arbre de travail, encore non commitées à cette date |

La dernière ligne décrit un état initial, pas un mode de maintenance à conserver. Avant le premier rebase, appliquer la section « Garder une version reproductible » du [skill](../SKILL.md). Le périmètre inclut les fichiers non suivis : composants, tests, icône, portrait, scripts et skill.

**Ancien script** : [scripts/t4/update-t4.sh](../../../../scripts/t4/update-t4.sh) est un prototype. Dans sa version inspectée, il déduit la base par le tag le plus proche, rebase le checkout principal, attend la fermeture sans borne, supprime l'application avant copie et ne gère ni sauvegarde ni relance. **Ne pas l'exécuter tel quel.** Employer la procédure ci-dessous ; ne présenter un remplacement automatisé comme disponible qu'après son implémentation et sa validation séparées.

Point de sortie : distinguer la base source, les commits T4 à reprendre, les modifications encore locales et l'installation réellement utilisée.

## 2. Préparer une mise à jour upstream

Pour une reconstruction sans changement de T3, passer directement aux contrôles et au build.

1. Choisir par défaut la version exacte du serveur T3 utilisé. Si ce serveur vient de l'app Nightly locale, relever sa version installée ; avec un serveur distant, relever sa version effective. Résoudre le tag ou la provenance de release vers un **SHA upstream précis**. Un nom de branche mobile ou le seul numéro de build ne suffit pas.
2. Identifier la base upstream précédente dans la provenance de la dernière livraison ou le repère initial ci-dessus, puis vérifier qu'elle est ancêtre du commit T4. Relire les commits qu'un rebase rejouerait : ils doivent représenter les personnalisations voulues. Ne pas utiliser le tag ancêtre le plus proche comme preuve de provenance.
3. Conserver une référence Git de sauvegarde du commit T4 de départ. Créer une branche de préparation dans un **worktree distinct**, depuis ce commit. Garder la branche de travail et l'application installée disponibles. Utiliser `git worktree add` pour le travail local de la session ; une conversation indépendante demandée par l'utilisateur doit être rattachée à son worktree via les outils T3 prévus.
4. Dans ce worktree seulement, rebaser les personnalisations sur le SHA upstream résolu, avec l'ancienne base explicitement indiquée (`git rebase --onto "$T4_NEW_BASE_SHA" "$T4_OLD_BASE_SHA"`). Renseigner ces variables avec les valeurs vérifiées, puis installer les dépendances avec `vp i`.
5. Résoudre les conflits en préservant les [comportements attendus](personnalisations.md). Si upstream offre désormais une fonction équivalente, vérifier l'équivalence avant de retirer le patch T4. En cas d'échec, laisser l'installation en place et rendre le conflit précis ; ne pas lancer une boucle de rebase aveugle.

Point de sortie : worktree de préparation cohérent, base connue et personnalisations présentes. Le numéro passé au build correspond à cette base, pas à une version récente appliquée à d'anciennes sources.

## 3. Contrôler et construire

Suivre les vérifications ciblées de l'AGENTS du dépôt ; aucune suite globale n'est nécessaire. Choisir les contrôles selon les zones modifiées. Pour une reprise complète des personnalisations actuelles, les tests suivants couvrent le filtre, le focus et le raccourci :

```sh
# Depuis la racine du worktree préparé.
vp test run apps/web/src/uiStateStore.test.ts apps/web/src/components/projectSwitcher/projectSwitcher.logic.test.ts apps/desktop/src/window/ProjectSwitcherShortcuts.test.ts apps/desktop/src/window/ProjectSwitcherLifecycle.test.ts

# Le projet Vitest browser doit être lancé depuis apps/web.
(cd apps/web && vp test run src/components/projectSwitcher/ProjectSwitcher.browser.test.tsx --project browser)

vp run --filter @t3tools/web typecheck
vp run --filter @t3tools/desktop typecheck
git diff --check
```

Ajouter le lint ciblé des fichiers source modifiés et les tests du packaging ou des contrats si ces zones changent. Le navigateur d'intégration utilise des données isolées, jamais le serveur utilisateur pour ses fixtures. En cas de renommage upstream, chercher les nouveaux chemins avant de conclure qu'un test a disparu.

Utiliser le runtime Node compatible avec `package.json` et Vite+ déjà installé. Sur ce Mac, leurs exécutables sont sous `~/.local/share/vite-plus/bin` et `~/.local/share/vite-plus/js_runtime/node/` ; résoudre la version présente au lieu de figer un ancien chemin.

Après les corrections issues des contrôles, terminer les commits source du périmètre et relever le SHA exact à construire sur un arbre propre. Depuis la racine du worktree, après avoir défini `T4_BUILD_VERSION` avec la version source vérifiée :

```sh
node scripts/build-desktop-artifact.ts --platform mac --target dmg --arch arm64 --build-version "$T4_BUILD_VERSION"
```

Le build peut modifier temporairement la version de `packages/contracts/package.json` puis la restaurer. Vérifier son état à la fin ; si le build échoue, comparer toute différence résiduelle avant correction.

Attendre la réussite du build et vérifier le DMG produit dans `release/`, son SHA-256 et l'identité de l'app contenue. La réussite du build ne vaut pas installation. Si T3 s'est mis à jour pendant le travail, réévaluer la cible avant d'installer.

## 4. Installer et relancer T4

Cette phase peut être menée depuis T4 lui-même si l'agent dépend toujours du serveur T3 conservé actif. Le remplacement et la relance doivent être pilotés depuis un processus ou outil indépendant de la fenêtre T4, sans action manuelle requise dans la fenêtre fermée.

1. Monter le DMG sans ouvrir Finder, dans un dossier temporaire unique. Copier l'application avec `ditto` dans un emplacement de préparation et vérifier son `Info.plist`, la présence des ressources Electron et son identité T4. Démonter le DMG après copie.
2. Noter la conversation et l'environnement visibles pour pouvoir les retrouver. Fermer proprement **T4 uniquement** via l'outil natif disponible. Respecter la fonction de maintien pour quitter ; vérifier la fermeture réelle. Borner l'attente : si T4 ne ferme pas, interrompre l'installation et diagnostiquer. Aucun arrêt par motif de nom ou de chemin.
3. Déplacer l'ancienne application vers un dossier de sauvegarde unique, conservé après l'installation. Préparer ce déplacement et le remplacement sur le même volume pour utiliser des renommages ; à défaut, vérifier complètement les copies avant bascule. Installer l'application préparée à `/Applications/T4 Code.app`. Si ce remplacement échoue, remettre immédiatement la sauvegarde à son emplacement.
4. Relancer T4 avec l'outil natif disponible. Vérifier la version, la connexion au serveur attendu, les projets et les conversations. Rétablir la conversation précédente si la demande ne prévoit pas une autre navigation.
5. Exécuter les contrôles observables pertinents de la section suivante. Conserver l'ancienne application et le dossier de préparation en cas d'échec ; aucun nettoyage des données utilisateur.

Les outils de contrôle natif et de navigateur suivent les consignes du harness actif. Les tests web ne remplacent pas un contrôle du raccourci macOS. Si le pilote ne reproduit pas ⌥Tab, demander une vérification au clavier à l'utilisateur en expliquant cette limite, puis qualifier honnêtement le résultat.

## 5. Vérifier et identifier la livraison

Pour une mise à jour upstream complète, contrôler dans T4 installé :

- Identité T4, thème conservé et connexion au serveur T3 attendu ; projets et conversations accessibles.
- Entonnoir : ordre naturel, clic simple exclusif avec fermeture, Shift-clic cumulatif sans fermeture, coches conservées.
- ⌥Tab : candidats limités aux coches, A → B → A, maintien avec plusieurs Tab, retour avec Shift, annulation avec Échap.
- Focus : sous-filtrage de la barre latérale, ouverture de la dernière conversation mise à jour, sortie « Tous les projets sélectionnés » sans perdre les coches.
- Sélecteur : largeur, défilement, étoiles, portrait et signature Raobar lisibles.

Préserver la sélection d'origine après les essais. Pour une modification ciblée, limiter cette passe au comportement modifié et à ses interactions.

Une fois le résultat validé, vérifier que le HEAD et l'arbre de travail de `t4` n'ont pas changé depuis le départ. Dans ce cas, déplacer la branche et son checkout propre vers le commit validé en conservant la référence de sauvegarde. La divergence produite par le rebase est attendue ; si de nouveaux commits ou changements locaux sont apparus entre-temps, les préserver et les intégrer avant cette bascule. Conserver dans un tag annoté de livraison, ou le registre de releases déjà utilisé, la date, la version serveur cible, le SHA upstream, le SHA T4 construit, le SHA-256 du DMG et les validations réalisées. Garder le chemin de sauvegarde dans le compte rendu local. Sauvegarder au remote `fork` quand le push fait partie de la demande.

Point de sortie : application vérifiée et provenance retrouvable, ou état partiel explicitement indiqué. Une source non commitée ne peut pas être présentée comme une livraison reproductible.

## 6. Revenir en arrière

1. Identifier la sauvegarde de **l'application** et sa version compatible avec le serveur toujours utilisé. Un retour arrière T4 ne rétrograde pas T3 ; si T3 a changé depuis, vérifier cette compatibilité avant la restauration.
2. Fermer uniquement T4, conserver l'application défaillante à part et remettre la sauvegarde à `/Applications/T4 Code.app`.
3. Relancer et vérifier la connexion, les projets et la conversation. Laisser les réglages et profils utilisateur en place.

La restauration de l'app ne restaure pas automatiquement les sources ni d'éventuelles migrations du profil. Si une mise à jour prévoit une migration non réversible du profil T4, préparer une sauvegarde cohérente de ce profil, T4 fermé, avant la première ouverture ; la restauration de cette copie est une opération distincte à expliciter. Les données du serveur T3 restent hors périmètre.
