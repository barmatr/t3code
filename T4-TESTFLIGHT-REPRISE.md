# T4 Mobile — reprise pour TestFlight

## Règle permanente de livraison

Consigne de Raoul du **11 novembre 2026** : **tout développement de T4 Mobile doit
être livré automatiquement et systématiquement sur TestFlight**, sauf instruction
explicite contraire pour la tâche. La demande de développement vaut autorisation
de compilation, signature, validation, upload Apple et distribution à **T4 Interne**.
Ne pas demander une nouvelle confirmation entre ces étapes. Cette règle remplace
les anciennes exigences de validation au cas par cas pour l’envoi d’un build.

Terminer les vérifications et la recette adaptées, utiliser un numéro de build
nouveau, puis poursuivre jusqu’à la disponibilité effective dans le groupe interne.
Relire l’état Apple et l’association au groupe, et enregistrer la preuve de livraison.
Un build local ou un upload réussi seul ne termine pas le travail. En cas de blocage
technique non résolu, indiquer l’étape restante sans annoncer le build comme livré.

## Dernière livraison : 0.1.0 (23), recompilation Xcode 27.2 pour l’iPhone Duo

Le **20 novembre 2026**, le build **23** a été compilé, signé, validé par Apple et
distribué à **T4 Interne**. UUID : `953c8611-97ee-464a-9a3d-ce94f605037b`.
État final relu : **VALID / INTERNAL_ONLY / IN_BETA_TESTING**, un testeur,
notifications automatiques désactivées.

- Signalement de Raoul du 20 novembre 2026 : l’app n’est pas adaptée à son iPhone Duo.
  Cause : la détection de charnière (`UIHingeInteraction`,
  `modules/t3-native-controls/ios/T3LayoutMetricsView.swift`) n’est compilée qu’avec
  le SDK iOS 27.1 ou plus (`#if canImport(UIKit, _version: 9127.0.85)`). Les builds
  1 à 22 venaient de Xcode 26.4.1 (SDK 26.4) : l’app traitait le Duo comme un iPhone
  ordinaire. **Toute compilation de T4 Mobile doit désormais utiliser Xcode 27.1 ou
  plus récent**, sans quoi l’adaptation Duo disparaît sans erreur.
- Sources : identiques au build 22 (`build/ios-local/build-23/source.patch`), seul
  l’outil de compilation change : Xcode 27.2 (27B52), SDK `iphoneos27.2`, UIKit 9127.1.13.
  Le binaire référence bien `UIHingeInteraction`.
- Le `node_modules` racine avait disparu (nettoyage disque) : réinstallé par
  `vp install --frozen-lockfile`.
- Contrôles : typecheck mobile réussi ; tests `apps/mobile` 309 fichiers sur 310,
  même échec préexistant de `app.config.test.ts`. Aucune recette visuelle : le
  simulateur iOS 27 n’était pas encore installé. Rendu Duo plié/déplié à confirmer
  sur l’iPhone Duo de Raoul.
- Archive : `~/Library/Developer/Xcode/Archives/2026-11-20/T4 Mobile 14.17.17.xcarchive`.
- IPA : `build/ios-local/build-23/export/T4Mobile.ipa`, **62 685 815 octets**,
  SHA-256 `5730f5c3c725fd09d173cc9796adba04f46927c23b4b717977c529114b9b3cd4`.
- Preuve de livraison : `build/ios-local/build-23/deployment.json`.

## Historique : 0.1.0 (22), Settle selection par projet

Le **18 novembre 2026**, le build **22** a été compilé, signé, validé par Apple et
distribué à **T4 Interne**. UUID : `2a6a544a-86c5-4272-8f34-a7edf9c4b8f9`.
État final relu : **VALID / INTERNAL_ONLY / IN_BETA_TESTING**, un testeur,
notifications automatiques désactivées.

- Demande de Raoul du 18 novembre 2026, d’après une maquette validée : la sélection
  se fait **projet par projet**. Un rond de sélection est placé à côté du nom de chaque
  projet ; un toucher le change en **Settle selection (N)** suivi d’une croix ✕. Seuls les
  fils affichés sous ce projet ont une case, cochée par défaut. Les autres projets
  sont grisés et inertes pendant la sélection. Le bouton global « Select » du
  build 21 est retiré.
- Sources : modifications non commitées sur `6529f21a53` (builds 17 à 22 cumulés),
  `build/ios-local/build-22/source.patch` et `source-status.txt`.
- Contrôles :
  - tests `apps/mobile` : 309 fichiers sur 310 passent ; l’échec de
    `app.config.test.ts`, test amont qui attend les identifiants T3 et non
    `fr.emaxconseils.t4`, est préexistant ;
  - `packages/client-runtime` : 163 fichiers, 2 043 tests réussis ;
  - typecheck mobile, formatage et lint réussis.
- Recette iPhone 17 Simulator / iOS 26.4, serveur isolé : cinq points vérifiés,
  dont le contrôle en base qui confirme que seuls les fils cochés sont classés.
  Rapport : `build/ios-local/build-22-recette/RECETTE.md`. La hauteur de l’en-tête
  a ensuite été fixée à 28 pt dans les deux états ; ce correctif n’a pas été
  recetté à nouveau.
- Archive : `~/Library/Developer/Xcode/Archives/2026-11-18/T4 Mobile 15.31.02.xcarchive`.
- IPA : `build/ios-local/build-22/export/T4Mobile.ipa`, **62 586 057 octets**,
  SHA-256 `2de09507e4a724165b53d335c5fcee8234279ab04a3c363699ae70cf7b12d12a`.
- Preuve de livraison : `build/ios-local/build-22/deployment.json`.

## Historique : 0.1.0 (21), filtres d’âge, HOT 20 min, glissements et Settle selection

Le **18 novembre 2026**, le build **21** a été compilé, signé, validé par Apple et
distribué à **T4 Interne**. UUID : `32abb0a5-1b09-4384-af94-700fd876f6ea`.
État final relu : **VALID / INTERNAL_ONLY / IN_BETA_TESTING**, un testeur,
notifications automatiques désactivées.

- Demandes de Raoul du 18 novembre 2026, en plus du build 20 :
  - filtre d’âge : « Last week » remplacé par **Last 5 days**, nouvelle option
    **> 5 days** (fils plus anciens que 5 jours, âge calculé comme les autres
    options ; fils classés dans leur section Settled). Un filtre « Last week »
    enregistré migre vers « Last 5 days » ;
  - **HOT** : délai d’ouverture ou d’activité récente porté de 5 à **20 minutes**
    (`HOT_RECENT_MS`) ;
  - **glissement de gauche à droite** : sur un fil lu, « Unread » le repasse en
    _Done_ ; sur un fil non lu, « Read » le marque lu. Le glissement complet agit
    tout de suite. Proposé seulement sur les fils ayant un tour terminé ;
  - **vue par projet** (HOT ou filtre d’âge, sans projet choisi) : bouton
    **Select**, cases toutes cochées par défaut, **Settle selection (N)** classe
    les fils cochés, y compris ceux qui travaillent encore.
  - Actions de glissement compactes sur les lignes compactes : libellés et ronds
    ne sont plus rognés.
- Sources : modifications **non commitées** sur `6529f21a53`, branche
  `t4-mobile-4682` (builds 17 à 21 cumulés). État et patch exacts :
  `build/ios-local/build-21/source-status.txt` et `source.patch`.
- Contrôles : `vp test` 373 fichiers / 4 513 tests, typecheck mobile, formatage
  et lint réussis.
- Recette iPhone 17 Simulator / iOS 26.4, serveur isolé, puis contre-recette des
  actions compactes : `build/ios-local/build-20b-recette/RECETTE.md`.
- Non vérifié : expiration HOT à 20 minutes (seule la conservation à 10 minutes est
  observée) et « Undo » après un classement multiple. Remarques ouvertes : toast
  « Settled thread » au singulier après un classement multiple ; un fil marqué lu
  par glissement quitte aussitôt HOT.
- Archive : `~/Library/Developer/Xcode/Archives/2026-11-18/T4 Mobile 11.32.04.xcarchive`.
- IPA : `build/ios-local/build-21/export/T4Mobile.ipa`, **62 584 888 octets**,
  SHA-256 `b5afa4d6767994b07af23f2e03f6ec2fcf56da877184b7377946d516fc988356`.
- Preuve de livraison : `build/ios-local/build-21/deployment.json`.

## Historique : 0.1.0 (20), fil délégué en attente de réponse visible

Le 18 novembre 2026, build **20** validé et distribué à **T4 Interne**. UUID :
`af662a79-cc58-453c-b9ae-44307a43cf9a`. État relu : **VALID / INTERNAL_ONLY /
IN_BETA_TESTING**.

- Un fil délégué qui attend une réponse ou une approbation de l’utilisateur
  (`pendingRuntimeRequest` autre que `auth_refresh`) reste listé à côté de son
  parent, même après la fin de son tour : `isWaitingOnUser` dans
  `packages/client-runtime/src/state/threadShell.ts`. Cas d’origine : question
  asynchrone d’un fil délégué au Mac par le T3 distant, notifiée mais invisible.
- Contrôles : `vp test` 115 fichiers / 1 392 tests, typecheck client-runtime et
  mobile, formatage, lint. Pas de recette simulateur pour ce build.
- Archive : `~/Library/Developer/Xcode/Archives/2026-11-18/T4 Mobile 10.31.56.xcarchive`.
- IPA : `build/ios-local/build-20/export/T4Mobile.ipa`, **62 577 188 octets**,
  SHA-256 `06941d317a54249ff8678ee966a339e6865d11b812a4d8af1a4f32f598ad69d9`.
  Preuve : `build/ios-local/build-20/deployment.json`.

## Historique : 0.1.0 (19), cohérence de HOT

Le 15 novembre 2026, build **19** validé et distribué à **T4 Interne**. UUID :
`66bc0246-a76f-449c-846f-53fabb74de56`. État relu : **VALID / INTERNAL_ONLY /
IN_BETA_TESTING**.

- HOT retient la plus récente de l’ouverture et de l’activité : un fil dont la
  réponse est toute récente reste dans HOT même déjà lu. Délai alors de 5 minutes,
  sans réglage dans les paramètres. Fils classés exclus.
- 71 tests de `threadListV2`, `check:changed` réussi hors échec knip préexistant
  (`useOpenWorkspaceDetail.ts`). Recette simulateur avec expiration observée.
  Rapport : `build/ios-local/build-19/RECETTE.md`.
- IPA : **62 577 098 octets**, SHA-256
  `33fa6ce88881e1e87eb03b7c10786926d9c48868fd6d2bae5df3aa6099af7921`.
  Archive `2026-11-15/T4 Mobile 21.18.50.xcarchive`.

## Historique : 0.1.0 (18), barre de saisie

Le 15 novembre 2026, build **18** validé et distribué à **T4 Interne**. UUID :
`5149b61c-5490-406f-9a7a-edbba41dcbcb`. État relu : **VALID / INTERNAL_ONLY /
IN_BETA_TESTING**.

- Bouton micro retiré du compositeur. Le sélecteur affiche le nom court du modèle
  et la réflexion sur deux lignes ; « Extra High » devient « extra-h ».
- 36 tests ciblés et `check:changed` réussis hors échec knip préexistant. Recette
  simulateur claire et sombre. Rapport : `build/ios-local/build-18/RECETTE.md`.
- IPA : **62 574 595 octets**, SHA-256
  `08c27a458910e31a2f0c2ad9ceb44e30a617ce98c26d8ce84e76fa0ad7875241`.
  Archive `2026-11-15/T4 Mobile 20.43.16.xcarchive`.

## Historique : 0.1.0 (17), lignes compactes multi-environnements

Le 15 novembre 2026, build **17** validé et distribué à **T4 Interne**. UUID :
`88a32241-bc8f-4c89-a6f1-3dd9247d7680`. État relu : **VALID / INTERNAL_ONLY /
IN_BETA_TESTING**.

- Présentation compacte aussi avec plusieurs environnements ; leur symbole
  (ordinateur, nuage) s’affiche entre l’icône de projet et le titre.
- 8 tests ciblés et `check:changed` réussis hors échec knip préexistant. Recette
  avec deux serveurs isolés. Rapport : `build/ios-local/build-17/RECETTE.md`.
- IPA : **62 577 018 octets**, SHA-256
  `02fbcc0d7e2f23785c3b474b44ddd037bae4177240ca38785d7b75d9a5b51aca`.
  Archive `2026-11-15/T4 Mobile 20.17.12.xcarchive`.

## Historique : 0.1.0 (16), base Nightly 4682

Le **14 novembre 2026**, le build **16** a été compilé, signé, validé par Apple et
distribué à **T4 Interne**. UUID : `a681a3ba-b4be-4d76-a2b3-777d1b82bfc3`.
État final relu : **VALID / INTERNAL_ONLY / IN_BETA_TESTING**, un testeur,
notifications automatiques désactivées.

- Base : `v0.1.10-nightly.20261114.4682`, commit upstream
  `820f620e3d63cfb03f3587aa2c6844b9c57295bb`.
- SHA exact compilé : `fd09515d4394dce4e3e51929ab4c6e112315b61c`, branche
  `t4-mobile-4682`. Les modifications initiales ont été sauvegardées dans le commit
  `699003a40e`, tag de retour `t4-mobile-before-4682-20261114`, avec patch, ZIP et
  manifeste dans `build/upgrades/4682-20261114/`. Aucun push ni PR.
- Conservés : HOT et flammes sur son bouton, priorité Settled et section repliable,
  lignes compactes, ordre stable Working, Mark unread, filtres d’âge, visibilité et
  ordre manuel des projets, projet prérempli, onglet Agents, portrait T4,
  `fr.emaxconseils.t4`, `t4code`, variantes isolées et OTA désactivées.
  Les conflits ont été adaptés aux nouvelles sources stables de la navigation,
  à la visibilité amont et à l’horloge serveur. Détail :
  `build/upgrades/4682-20261114/PERSONNALISATIONS.md`.
- Nouveautés amont : choix du français vérifié ; bouton œil conservé dans les
  demandes de secrets ; GitHub seul hébergeur proposé par défaut (dossier local
  et URL Git restent disponibles). Les traductions amont restent partielles.
- Compatibilité : configuration, sonde RPC et flux shell décodés par le client 4682
  avec le runtime Mac **4515** isolé et le serveur distant **0.1.6** en lecture seule.
  Protocole 2. Aucun serveur réel modifié ou redémarré. Session distante temporaire
  révoquée. Limites et preuves : `build/upgrades/4682-20261114/COMPATIBILITE.md`.
- Tests ciblés réussis : 226 tests personnalisés / 15 fichiers, 125 tests mobiles /
  9 fichiers (ensembles recouvrants), 103 tests compatibilité / 3 fichiers, 4 tests
  client natif et 61 cas du compilateur React. Typecheck mobile, formatage et lint
  ciblés réussis. Pas de suite globale. Contrôle natif statique incomplet :
  SwiftLint, ktlint et detekt absents ; compilation iOS réussie.
- Recette native iPhone 17 Simulator / iOS 26.4 : appairage, HOT, Settled + Done,
  non lu, filtres, glisser-déposer et masquage des projets, projet prérempli, français,
  onglet Agents. Pas d’essai physique, Android, iPad ni d’agents réels en streaming.
  Rapport et captures : `build/ios-local/build-16-recette/RECETTE.md`.
- Incident de recette résolu : ancien cache Metro mélangeant Effect 4.1.2/4.1.3.
  Cache reconstruit, application relancée et appairage réussi avec jeton neuf ;
  aucune modification de logique nécessaire. Connexion de test retirée, Device,
  Metro et backend fermés.
- Archive : `~/Library/Developer/Xcode/Archives/2026-11-14/T4 Mobile 14.42.32.xcarchive`.
- IPA : `build/ios-local/build-16/export/T4Mobile.ipa`, **62 576 853 octets**,
  SHA-256 `8d43d3f2743e32628624a4d35dbf5dfc93f07c9a4b262ce1193360c13b044cab`.
- Preuve de livraison : `build/ios-local/build-16/deployment.json`. Les 3 204
  empreintes sources, la signature EMAX, le numéro 16, le debug désactivé, le ZIP,
  le schéma, OTA et le JavaScript archive/IPA ont été vérifiés.

## Historique : 0.1.0 (15), portrait agrandi dans l’icône

Le 12 novembre 2026, le build **15** a été compilé, signé, validé par Apple et
distribué à **T4 Interne**. UUID : `d4553382-b04f-4297-9578-6104053ef376`.
État relu : **VALID / INTERNAL_ONLY / IN_BETA_TESTING**, un testeur,
notifications automatiques désactivées.

- Médaillon du portrait agrandi de **50 % en diamètre**, légèrement abaissé pour
  préserver le 4 ; signature « Powered by Raobar » décalée à gauche.
  Tracé, taille et position du T4 inchangés ; portrait source identique.
- Seuls `assets/t4/mobile-icon.svg` et `.png` changent depuis le build 14 :
  les 3 103 empreintes des sources applicatives précédentes sont identiques.
- PNG opaque 1024 × 1024, miniatures 180/60 pixels inspectées. Nouvelle icône
  installée sur iPhone 17 Simulator / iOS 26.4, écran d’accueil vérifié.
  Catalogue iOS de production identique pixel pour pixel au PNG ; icône de
  l’IPA exportée extraite et inspectée. Preuves : `build/ios-local/build-15-recette/`.
- Doctor et compilations natifs réussis. `check:changed HEAD` interrompu car les
  assets racine étendaient sa portée à tous les packages. Pas de nouveau test logique
  ajouté pour cette modification visuelle. Aucun contrôle global nouveau revendiqué.
- Premier essai simulateur : manque d’espace disque. Cache local
  `build/ios-local/DerivedData` supprimé puis régénéré ; sources, archives et IPA
  conservées. Seconde compilation réussie, Device fermé après recette.
- Sources locales non commitées sur base `9e022b2ca12d15b02d07e43027cef4278e302127` :
  3 105 empreintes vérifiées, patch et fichiers modifiés sauvegardés dans
  `build/ios-local/build-15/`. Aucun commit ni push effectué.
- Archive : `~/Library/Developer/Xcode/Archives/2026-11-12/T4 Mobile 13.20.19.xcarchive`.
- IPA : `build/ios-local/build-15/export/T4Mobile.ipa`, **61 877 752 octets**,
  SHA-256 `1450e1ae81999b624d65b0df06e6c8f98e9c5161163a87bef25b971394f10877`.
- Preuve complète : `build/ios-local/build-15/deployment.json`. Signature EMAX/T4,
  numéro 15, debug désactivé, ZIP et JavaScript archive/IPA vérifiés.
- Pas de recette physique ou Android. Hindsight reste désactivé pour ce dépôt.

## Historique : 0.1.0 (14), priorité Settled sur Done

Le 12 novembre 2026, le build **14** a été compilé, signé, validé par Apple et
distribué à **T4 Interne**. UUID : `b1d378b0-d0d7-42c8-885e-c1798978a8e4`.
État relu : **VALID / INTERNAL_ONLY / IN_BETA_TESTING**, un testeur,
notifications automatiques désactivées.

- **Settled prime sur Done**, y compris non lu : les fils réglés restent dans
  la section Settled hors HOT. Le filtre HOT continue de les exclure.
  L'exception existante pour le travail en file d'attente est conservée.
- Le signalement d'un bug déclenche automatiquement correction, vérifications
  et livraison TestFlight ; cette portée est explicitée dans les deux AGENTS.md.
- **102 tests / 7 fichiers** et `check:changed HEAD` réussis. Régression rouge avant
  correction, verte après. Recette native iPhone 17 Simulator / iOS 26.4 :
  All projects / Last week, section ouverte puis repliée, exclusion dans HOT.
  Preuves : `build/ios-local/build-14-recette/`. Pas de recette physique, iPad ou Android.
- Sources locales non commitées sur base `9e022b2ca12d15b02d07e43027cef4278e302127` :
  3 103 empreintes vérifiées, patch et fichiers modifiés sauvegardés dans
  `build/ios-local/build-14/`. Aucun commit ni push effectué.
- Archive : `~/Library/Developer/Xcode/Archives/2026-11-12/T4 Mobile 12.55.43.xcarchive`.
- IPA : `build/ios-local/build-14/export/T4Mobile.ipa`, **61 613 731 octets**,
  SHA-256 `a0151b46a75def90eff19e5cc56b10b06e19f9f1be3edb3a08ac12585e9bd891`.
- Preuve complète : `build/ios-local/build-14/deployment.json`. Signature EMAX/T4,
  numéro 14, debug désactivé, ZIP et JavaScript archive/IPA vérifiés.
- Connexion de recette retirée ; Device, Metro et backend fermés.

## Historique : 0.1.0 (13), HOT, non lu et ordre Working

Le 12 novembre 2026, le build **13** a été compilé, signé, validé par Apple et
distribué à **T4 Interne**. UUID : `0ebdda2c-aca4-4a85-a53c-41956f5203b4`.
État relu : **VALID / INTERNAL_ONLY / IN_BETA_TESTING**, un testeur,
notifications automatiques désactivées.

- **HOT** exclut immédiatement les conversations settled, même récemment lues.
  La liste hors HOT conserve son comportement et sa section Settled.
- **Mark unread** apparaît directement au toucher long d’une conversation lue.
  L’action utilise la commande serveur existante ; état conservé après relance.
- **Working** : ordre stable du début d’activité le plus ancien au plus récent.
  Les événements des agents ne modifient plus cet ordre ; les changements de
  statut gardent leur priorité. Repli : date de demande du run, puis création.
- **HOT dans l’en-tête** : bouton rond de 44 points à côté de la loupe, flammes
  autour de HOT lorsqu’il est actif ; le titre T4 Code ne change plus avec HOT.
- **102 tests / 7 fichiers** et `check:changed HEAD` réussis. Régressions HOT et
  Working rouges avant correction. Recette iPhone 17 Simulator / iOS 26.4 :
  `build/ios-local/build-12-recette/` et `build/ios-local/build-13-recette/`.
  Recherche et rendu clair/sombre vérifiés. Le streaming Working est couvert
  par tests de logique ; pas de recette physique, iPad ou Android.
- Sources locales non commitées sur base `9e022b2ca12d15b02d07e43027cef4278e302127` :
  3 103 empreintes vérifiées, patch et fichiers modifiés sauvegardés dans
  `build/ios-local/build-13/`. Aucun commit ni push effectué.
- Archive : `~/Library/Developer/Xcode/Archives/2026-11-12/T4 Mobile 09.02.53.xcarchive`.
- IPA : `build/ios-local/build-13/export/T4Mobile.ipa`, **61 613 826 octets**,
  SHA-256 `3c410d1266874e3558c14a951a09125cff03e657eeac6e1c03ae96704cac9ee8`.
- Preuve complète : `build/ios-local/build-13/deployment.json`. Signature EMAX/T4,
  numéro 13, debug désactivé, ZIP et JavaScript archive/IPA vérifiés.
- Le candidat 12 a échoué faute d’espace disque avant export et n’a pas été envoyé.
  Des caches de compilation Xcode régénérables ont été nettoyés ; sources et
  archives conservées. Connexions de recette retirées ; Device, Metro et backend fermés.

## Historique : 0.1.0 (11), projets visibles et ordre manuel

Le 11 novembre 2026, sur demande explicite de livraison de Raoul, le build **11**
a été compilé, signé, exporté, validé par Apple et distribué à **T4 Interne**.
UUID : `0fbecc49-8d55-4de0-9707-9a671bff53d8`. État relu : **VALID / INTERNAL_ONLY /
IN_BETA_TESTING**, un testeur, notifications automatiques désactivées.

- Dans **Réglages → Projects**, cases de visibilité et poignées de glisser-déposer.
  Les projets décochés quittent le menu et les conversations, y compris brouillons
  et Settled. Ils restent disponibles dans les réglages pour les réafficher.
- Tous visibles et ordre antérieur par défaut ; ordre personnel et visibilité
  conservés après relance. Boutons « Tout afficher » et « Ordre par défaut ».
- **12 tests ciblés / 3 fichiers** et `check:changed HEAD` réussis. Recette native
  iPhone 17 Simulator / iOS 26.4 : déplacement, menu réordonné, masquage,
  persistance après relance et réaffichage. Preuves :
  `build/ios-local/project-preferences-recette/`.
- Sources locales non commitées sur base `9e022b2ca12d15b02d07e43027cef4278e302127` :
  3 103 empreintes vérifiées, patch et 12 fichiers modifiés sauvegardés dans
  `build/ios-local/build-11/`. Aucun commit ni push effectué pour cette livraison.
- Archive : `~/Library/Developer/Xcode/Archives/2026-11-11/T4 Mobile 22.01.08.xcarchive`.
- IPA : `build/ios-local/build-11/export/T4Mobile.ipa`, **61 611 376 octets**,
  SHA-256 `e3996ef3b787805a67261a91e1b8a0dcf75e4730cb89d9ffe0d75978888efea6`.
- Preuve complète : `build/ios-local/build-11/deployment.json`. Signature EMAX/T4,
  numéro 11, debug désactivé, ZIP et JavaScript archive/IPA vérifiés.
  Installation physique, Android et iPad non vérifiés. Environnement de recette fermé.

## Historique : 0.1.0 (10), lignes compactes et contexte des filtres

Le 11 novembre 2026, le build **10** a été compilé, signé, exporté, validé par
Apple puis distribué à **T4 Interne** (UUID `a1663390-4250-4c11-b9de-ba67272202a8`).
État relu : **VALID / INTERNAL_ONLY / IN_BETA_TESTING**, un testeur,
notifications automatiques désactivées. Sources : commit `220ae1cd75`.

- Pour une seule machine représentée et une taille de texte normale, titre,
  statut (ou âge) et icône fournisseur tiennent sur la même ligne ; les titres
  trop longs sont tronqués. Les grandes tailles d’accessibilité gardent plusieurs lignes.
- **Settled reste visible et repliable avec les filtres d’âge**, y compris avec
  le regroupement par projet. Les fils réglés et lus restent en bas ; les Done non lus restent en haut.
- Depuis la liste filtrée sur un projet, **Nouveau chat présélectionne ce projet**
  avant le dernier utilisé, même si la préférence de réutilisation est désactivée.
  Le filtre de machine est respecté ; sinon une copie connectée du projet est privilégiée.
- **114 tests ciblés / 5 fichiers** passent. `check:changed HEAD` avant commit :
  format, lint, knip, types et compilateur React passent. Tests de régression rouges avant correction.
- Recette iPhone 17 Simulator / iOS 26.4 : lignes avant/après, Settled replié/déplié
  avec projet + Last day, création d’un brouillon Beta après consultation d’Alpha,
  grande taille de texte. Preuves et limites : `build/ios-local/build-10-candidat/recette/RECETTE.md`.
  iPhone physique, Android et iPad non exécutés ; multi-machine vérifié par tests de logique.
- Archive : `~/Library/Developer/Xcode/Archives/2026-11-11/T4 Mobile 21.29.45.xcarchive`.
- IPA : `build/ios-local/build-10/export/T4Mobile.ipa`, **61 606 137 octets**,
  SHA-256 `89bee5df3ee1c18cc403c3fe0c2a443d39d632dc8c21c4cc3e893ef9ceeade38`.
- Preuve de livraison : `build/ios-local/build-10/deployment.json` ; identité T4,
  signature EMAX, debug désactivé, ZIP, bundle JavaScript et empreintes des sources vérifiés.
  Connexion de recette retirée du simulateur ; Device, Metro et backend isolé fermés.

## Historique : 0.1.0 (9), nouvelle icône

Le 11 novembre 2026, le build **9** a été compilé, signé, exporté, validé par
Apple puis distribué à **T4 Interne** (UUID `258bab20-85f9-4a87-8a25-c34de2064111`,
VALID, notifications automatiques désactivées). Seul changement : l’icône
(proposition 5 retenue par Raoul parmi six, T4 recentré, portrait de Raobar en
sceau sur le pied du 4, « Powered by Raobar » dessous ; commit `aea2b8ad32`).
Les propositions et leur planche sont dans `build/icones-propositions/` ;
`generer.py` les régénère.

- Archive : `~/Library/Developer/Xcode/Archives/2026-11-11/T4 Mobile 18.48.59.xcarchive`.
- IPA : `build/ios-local/build-9/export/T4Mobile.ipa`, **61 605 006 octets**,
  SHA-256 `16ebdf968feb77849a3a715c7d16c3efa6b187e7af7da73e393f40db63db6cc8`.
- Icône vérifiée sur l’écran d’accueil du simulateur iPhone 17 :
  `build/ios-local/build-9-candidat/icone-ecran-accueil.png`. La mention écrite est
  illisible à la taille d’une icône d’écran d’accueil ; le portrait reste repérable.

## Historique : 0.1.0 (8), zone Settled et fils lus récemment en HOT

Le 11 novembre 2026, le build **8** a été compilé, signé, exporté, validé par
Apple puis distribué à **T4 Interne** (UUID `0e38888f-01dd-438d-909a-9eff01b0415f`,
VALID, notifications automatiques désactivées).

- En liste prioritaire, les fils réglés et lus reviennent en bas dans la zone
  **Settled** repliable, sous les fils à suivre ; un Done non lu reste en haut.
- En **HOT**, un fil ouvert depuis moins de 5 minutes reste listé, puis sort seul.
  Le délai part de `opens.openedAt` : `lastVisitedAt` contient la date de mise à
  jour du fil au moment de la visite, pas l’heure de lecture.
- Commits `7d2c74f56a` et `cf14189064` sur `t4-mobile-4515`.
- Archive : `~/Library/Developer/Xcode/Archives/2026-11-11/T4 Mobile 17.58.18.xcarchive`.
- IPA : `build/ios-local/build-8/export/T4Mobile.ipa`, **59 906 189 octets**,
  SHA-256 `068f302bde35cdabba2a9782037af759607a6717a50e4035afce8ae36619e993`.
- 1 455 tests ciblés, typecheck, lint et knip passent. Recette et contre-recette
  simulateur : `build/ios-local/build-8-candidat/recette/` (Settled replié, déplié,
  Show more ; HOT conservé puis expiré à 5 min ; reprise et Agents inchangés).

## Historique : 0.1.0 (7), mise à niveau sur la nightly T3 du 11 novembre

Le 11 novembre 2026, le build **7** a été compilé, signé, exporté, validé par
Apple puis distribué à **T4 Interne**. État relu par API : **VALID /
INTERNAL_ONLY / READY_FOR_BETA_TESTING**, UUID
`a73c6eb4-d842-4cba-818f-ed2d3907e878`, notifications automatiques désactivées.
Le groupe contient sept builds et un testeur.

Base : T3 `v0.1.9-nightly.20261111.4515`, branche `t4-mobile-4515`, avec les
personnalisations du build 6 reprises (identité EMAX, Agents, âge, HOT, libellés
français). Nouveautés T3 incluses, dont l’onglet Usage et le nom de fournisseur
dans les lignes de fils.

- Archive : `~/Library/Developer/Xcode/Archives/2026-11-11/T4 Mobile 13.54.53.xcarchive`.
- IPA : `build/ios-local/build-7/export/T4Mobile.ipa`, **59 906 767 octets**.
- SHA-256 : `94c55f20b6e89f21409d85d50fa16e470f4bee438eb6eff761938e4de99257bc`.
- Signature `Apple Distribution: emax conseils (GY9P9U75F3)`, bundle
  `fr.emaxconseils.t4`, version 0.1.0 (7).
- Typecheck, lint, knip et 3 419 tests passent. Les 4 tests `app.config.test.ts`
  qui attendent l’identifiant T3 échouent par construction depuis le build 1.
- Recette simulateur iPhone 17 / iOS 26.4, backend isolé : lancement, filtres,
  HOT, Agents (indisponible dans les données de test), sombre, et reprise
  d’un fil créé en arrière-plan sans relance (avec et sans passage par Agents).
  Captures : `build/ios-local/build-7-candidat/recette/`. Non vérifiés : état
  working avec durée et nom de fournisseur réel, iPhone physique, Android, iPad.

## Historique : 0.1.0 (6), mode HOT et listes prioritaires

Le 11 novembre 2026, le build **6** a été compilé, signé, exporté, validé par
Apple puis distribué à **T4 Interne**. État final relu par API :
**VALID / INTERNAL_ONLY / IN_BETA_TESTING**, UUID
`2aa30a41-5d8d-4790-8b6a-f8884cf13649`. Le groupe contient six builds et un
testeur. Notifications automatiques désactivées ; aucune invitation ni expiration
ancienne, aucun commit ni push. La validation et l’upload ont réussi dès leur
première exécution ; les premiers GET ont répondu 404 avant PROCESSING puis VALID.

Le mode **hot**, indépendant et persistant dans Chats et Agents, conserve les fils
à suivre : actions/erreurs, Done non lus, agents en cours ou en attente. Il ignore
l’âge sans effacer le choix précédent ; machine, projet et recherche restent
appliqués. La flamme bleue reste active au premier plan, hors réduction des
animations. Les listes donnent priorité aux actions puis Done non lus, puis fils
en cours ; titres de projet en gras, espacement réduit, modèle avec statut quand
une seule machine est représentée. Le filtre affiche **All env**. Direction
agentique est exclu de Chats pour le couple exact environnement/projet et reste
accessible dans Agents ; les homonymes ailleurs restent visibles.

Deux défauts trouvés en recette ont été corrigés : bouton HOT dans la barre de
statut quand Agents est indisponible, et abonnement aux fils suspendu à tort après
un changement d’onglet. La contre-recette Terra initiale était non passante ; le
parent a reproduit le second défaut par un test rouge puis vert, rétabli le
rechargement du client de développement (Metro était en mode CI), et vérifié les
deux corrections natives sur les sources finales, sans instrumentation temporaire.
Les nouveaux Replay apparaissent sans détour par Settings après aller-retour
Chats/Agents et après redémarrage du backend. Le filtre d’âge du build 5 est inchangé.

- Archive : `~/Library/Developer/Xcode/Archives/2026-11-11/T4 Mobile 11.10.31.xcarchive`.
- IPA : `build/ios-local/build-6/export/T4Mobile.ipa`, **60 120 470 octets**.
- SHA-256 : `2e9e75caf43f8e7d4426f64a2fb7ac73e6e40d30843f7723cef40bc6eb644865`.
- Signature profonde/stricte, identité EMAX/T4, numéro 6, debug désactivé,
  JavaScript distinct et identique entre archive et IPA, ressources robot et ZIP
  complet vérifiés. **1 707 empreintes** figées restent identiques après export.
- **107 tests / 9 fichiers**, typecheck mobile, lint et formatage ciblés réussis.
- Preuve finale : `build/ios-local/build-6/validation/deployment.json` ; journaux,
  manifestes et revue parent dans le même dossier.
- Recettes détaillées : `/Users/jrbmt/.t3/scratch/t4mobile-hot-review-z3c0lhc8/terra/RECETTE.md`,
  `terra-recheck/RECETTE.md` et `REVIEW-ASTRA.md` dans le même dossier de travail.
  Couverture : exclusion exacte/homonyme, tri, âge restauré, lecture réelle d’un
  Done, persistance par onglet, recherche, clair/sombre et correction de reconnexion.

Recette sur simulateur iPhone 17 / iOS 26.4, données et backends isolés. Installation
physique du build 6, serveurs réels, Android, iPad et consommation batterie/GPU
restent non vérifiés. Connexions synthétiques retirées, Device/Metro/backends fermés.
Projet iOS généré en production ; cache Xcode conservé. Archives et IPA 1 à 5
conservées avec empreintes inchangées. Prochaine livraison : numéro **supérieur à 6**,
selon la demande de Raoul ; ne renvoyer ni expirer les anciens builds.

## Historique : 0.1.0 (5), correctif du clignotement

Le 10 novembre 2026, le build **5** a été compilé, signé, exporté, validé par
altool puis reçu et traité par Apple. Il est désormais distribué à **T4 Interne**.
État final relu : **VALID / INTERNAL_ONLY / IN_BETA_TESTING** ; UUID
`4dec2f33-0a73-4b95-8f74-6e3eea1c480e`. Le groupe contient les cinq builds et un
testeur. Notifications automatiques désactivées ; aucune nouvelle invitation,
aucun ancien build expiré, aucun commit ni push. Le traitement Apple a nécessité
plusieurs relectures : les premiers 404 puis PROCESSING ne justifient pas un renvoi.

Le filtre conserve la dernière date vérifiée d'un fil pendant une revalidation
ou une erreur, jusqu'à la nouvelle réponse autoritaire ou l'expiration réelle.
Les lignes et leurs séparateurs ne sont plus retirés temporairement. Le bandeau
d'attente s'affiche pour les dates encore inconnues ; erreurs et Retry conservés.
All Ages, les séparateurs, l'onglet Agents et le feu bleu sont conservés. Aucune
réduction du trafic réseau n'est annoncée : les signaux de fraîcheur sont conservés.

- Archive : `~/Library/Developer/Xcode/Archives/2026-11-10/T4 Mobile 16.04.59.xcarchive`.
- IPA : `build/ios-local/build-5/export/T4Mobile.ipa`, **60 113 063 octets**.
- SHA-256 : `f733daabd39b458514a3b59231adf6f33d4c5933239b2d9d529230282914771d`.
- Signature profonde/stricte, numéro 5, debug désactivé, ressources, JavaScript
  distinct du build 4 et ZIP complet contrôlés. Validation Apple et upload réussis.
- **132 tests ciblés / 12 fichiers**, typecheck mobile, lint, formatage et 83
  empreintes de sources/ressources vérifiés après archive et export.
- Preuve finale : `build/ios-local/build-5/validation/deployment.json` et journaux
  voisins. Rapports indépendants Opus 5.5 High et Astra High :
  `build/diagnostics/thread-flicker/{opus,astra}/diagnostic.md`.
- Recette : `build/diagnostics/thread-flicker/main/RECETTE.md`. iPhone 17 Simulator
  iOS 26.4, 47 fils synthétiques et tours Replay : défilement, reprise, références
  temporelles et relance vérifiés avant le dernier changement limité au bandeau.
  Le dernier appairage automatique de recette après ce changement n'a pas abouti ;
  sa recette connectée finale n'est donc pas confirmée, ses tests rouges/verts
  passent. Les erreurs réseau d'origine ne sont pas attribuées avec certitude.

Le projet iOS généré est en production. Device, Metro et backend sont fermés ;
le cache Xcode régénérable a été supprimé après export. Archives et IPA 1 à 5
conservées, anciennes empreintes intactes ; builds 1 à 4 relus VALID, non expirés.
Installation sur iPhone physique et connexion aux serveurs réels à confirmer ;
Android et iPad non testés en exécution. Toute livraison suivante doit utiliser un
numéro **supérieur à 5** et suivre la demande actuelle de Raoul. Ne renvoyer ni
expirer aucun des builds livrés.

## Historique : 0.1.0 (4), feu bleu au retour au premier plan

Le 10 novembre 2026, sur la demande explicite de Raoul de développer puis
**déployer automatiquement** cette évolution, le build **4** a été reçu par
Apple à **15:31:28** (Paris), puis validé et distribué à **T4 Interne**.
État final relu : **VALID / INTERNAL_ONLY / IN_BETA_TESTING** ; UUID
`4cbcce85-78d4-453f-b85a-20ee270c3293`. Le groupe contient les quatre builds
et un testeur. Notifications automatiques du nouveau build désactivées ; aucune
invitation envoyée, aucun ancien build expiré, aucun commit ni push effectué.

Il reprend le moteur du feu bleu utilisé par T4 Mac dans Option + Tab, autour
du titre mobile **T4 Code BETA**, pendant **1,4 seconde**, à chaque vrai retour
depuis l’arrière-plan. Pas de déclenchement au montage ou à un simple changement
d’onglet ; arrêt en arrière-plan, sur un autre écran et avec Réduire les animations.
L’animation locale est transparente et laisse passer les touchers. All Ages,
les séparateurs de projet et l’onglet Agents du build 3 sont conservés.

- Archive : `~/Library/Developer/Xcode/Archives/2026-11-10/T4 Mobile 15.20.34.xcarchive`.
- IPA : `build/ios-local/build-4/export/T4Mobile.ipa`, **60 113 583 octets**.
- SHA-256 : `02f2b59ebe519d269f6b4e96a76ee0171164dc8f848ccc45d7f99ee204d55613`.
- Signature T4 EMAX, numéro 4, debug désactivé, JavaScript et ressources contrôlés
  dans l’archive puis l’IPA. Contrôle ZIP complet réussi ; validation altool et
  upload réussis sans erreur. Association au groupe et état final relus par API.
- **122 tests ciblés dans 12 fichiers**, typecheck mobile, lint et formatage ciblés
  passent ; 83 empreintes de sources et ressources figées vérifiées après archive.
- Livraison : `build/ios-local/build-4/validation/deployment.json` et journaux voisins.
- Recette : `build/ios-local/build-4/visual/RECETTE.md`, iPhone 17 Simulator / iOS 26.4,
  46 fils simulés isolés. Vidéos en modes clair (Chats) et sombre (Agents), disparition
  du feu et accès à la recherche observés. Les garde-fous du cycle de vie, la réduction
  des animations et la libération de la boucle de rendu ont leurs tests ciblés.

Le projet iOS généré est en **production**. Connexion simulée retirée et état absent
relu ; Device, Metro et backend isolé fermés. Seul notre cache Xcode régénérable a
été supprimé après export pour récupérer environ 5 Go ; les archives et IPA livrées
1 à 4 sont conservées, avec les empreintes des anciennes IPA inchangées. Les trois
anciens builds ont également été relus **VALID**, non expirés.
L’installation sur l’iPhone physique et la connexion aux serveurs réels restent à
confirmer. Android et iPad n’ont pas été testés en exécution pour cette évolution.
Le réglage Réduire les animations n’a pas été manipulé dans les Réglages natifs ;
son respect est couvert par les tests des événements natifs et du garde-fou WebKit.
Toute livraison suivante doit utiliser un numéro **supérieur à 4** et suivre la
demande actuelle de Raoul ; ne renvoyer ni expirer aucun ancien build.

## Historique : 0.1.0 (3), onglet Agents

Le 10 novembre 2026, le build **3** a été reçu par Apple à **14:59:12** (Paris),
puis traité **VALID / INTERNAL_ONLY / IN_BETA_TESTING** et associé à
**T4 Interne**. UUID : `2d5bb281-fa68-4c66-8705-5dd8dd550eeb`.
Les notifications automatiques du nouveau build sont désactivées. Aucune nouvelle
invitation envoyée, aucun ancien build expiré, aucun commit ni push effectué.

Ce build reprend le correctif All Ages et les séparateurs de projet du build 2,
livré auparavant, puis remplace la deuxième icône par un robot **Agents**. Ce
raccourci ouvre exclusivement **Direction agentique** sur le MacBook confirmé
par Raoul. Il ouvre toutes les dates ; sa recherche et sa navigation restent
indépendantes de Chats.

- Archive : `~/Library/Developer/Xcode/Archives/2026-11-10/T4 Mobile 14.37.47.xcarchive`.
- IPA : `build/ios-local/build-3/export/T4Mobile.ipa`, **60 109 104 octets**.
- SHA-256 : `d5a65fb2059af86d4cd9d33cdc2e5f5d978aea54ef3732d6dcb1df1d36ddaa9a`.
- Signature T4 EMAX, build 3, debug désactivé, JavaScript et icônes embarqués
  contrôlés dans l’archive puis l’IPA ; contrôle ZIP complet réussi.
- **110 tests ciblés**, typecheck mobile, lint et formatage ciblés passent ;
  77 empreintes de sources/ressources sont conservées dans les preuves.
- Livraison : `build/ios-local/build-3/validation/deployment.json`.
- Recette native : `build/ios-local/build-3/visual/RECETTE.md`, iPhone 17 Simulator,
  iOS 26.4, deux fils cibles et 44 autres fils simulés isolés. Icône, portée,
  recherche, ouverture/retour, filtres de Chats, pagination et relance vérifiés.

La prévalidation altool a d’abord échoué (HTTP 500 / 90168, avec le disque presque
plein), puis une deuxième tentative a été interrompue après une attente prolongée
chez Apple. Le même fichier, intact, a ensuite été envoyé avec succès et validé
par le traitement Apple définitif. Le premier GET de relecture du groupe a
répondu 404 ; la lecture suivante du build a confirmé le groupe et IN_BETA_TESTING.
Ne pas interpréter ces journaux intermédiaires comme une livraison manquante,
ni présenter la prévalidation comme réussie. Voir `apple-validation-attempts.json`
et les journaux voisins de la preuve finale.

Le projet iOS généré est en **production**. Device fermé, connexion simulée retirée,
Metro et backend isolé arrêtés. Le cache Xcode régénérable a été supprimé pour
libérer de l’espace ; les archives et IPA livrées 1, 2 et 3 sont conservées.
L’installation du build 3 sur l’iPhone et la connexion aux serveurs réels restent
à confirmer ; Android n’a pas été testé en exécution. Toute livraison suivante
doit utiliser un numéro supérieur à **3**, en suivant la demande actuelle de Raoul.

## Historique : correctif 0.1.0 (2)

Le 10 novembre 2026, Raoul a demandé explicitement de déployer les corrections
du filtre d’âge, puis d’y inclure le regroupement par projet. Le build **2** est
désormais **VALID / INTERNAL_ONLY / IN_BETA_TESTING**, associé à **T4 Interne**
(1 testeur). Son UUID est `d3a87253-d960-4bbb-a66c-079fce73a913`.
Lors de cet envoi, les builds 1 et 2 étaient associés ; aucune nouvelle
invitation n’a été envoyée.
Les notifications automatiques du build 2 sont désactivées et la distribution
automatique du groupe reste désactivée.

- Archive : `~/Library/Developer/Xcode/Archives/2026-11-10/T4 Mobile 13.44.46.xcarchive`.
- IPA : `build/ios-local/build-2/export/T4Mobile.ipa`, **60 131 551 octets**.
- SHA-256 : `1a35300666d562591477a7755f05a028feb372ae64833dbfdf0b1e864dfb5f90`.
- Signature T4 EMAX vérifiée, debug désactivé, JavaScript contrôlé dans l’archive
  et dans l’IPA. Validation Apple, upload et association réussis puis relus.
- Preuve : `build/ios-local/build-2/validation/deployment.json` et journaux voisins.
- Recette : `build/ios-local/build-2/visual/RECETTE.md`, **70 tests ciblés**,
  typecheck mobile, lint et formatage ciblés réussis. La recette native couvre
  les pages anciennes, les résultats avec étagère repliée, les séparateurs par
  projet, les deux références temporelles et la persistance après relance.

Cette recette utilise un simulateur iOS 26.4 et 46 fils simulés isolés.
L’installation du build 2 et son résultat sur les serveurs réels restent à
confirmer sur l’iPhone de Raoul. Android n’a pas été testé en exécution.
Le projet iOS généré est en production après cet envoi.
L’onglet Agents a ensuite été livré dans le build 3 ci-dessus. Ne renvoyer
aucun des anciens builds.

## Historique du premier envoi

Préparation effectuée le 10 novembre 2026 sur le Mac de Raoul, à sa demande.
Les opérations dans les consoles Apple ont été faites par Computer Use ; les
contrôles API et CLI ci-dessous ont ensuite été exécutés depuis ce Mac.
Le premier build **0.1.0 (1)** a été compilé, signé, exporté, validé puis envoyé
à Apple le 10 novembre à 12:38:45 (Paris), sur autorisation de Raoul.
Apple l’a traité avec l’état **VALID**, audience **INTERNAL_ONLY**, état bêta
**READY_FOR_BETA_TESTING**. Il est associé au groupe **T4 Interne**, avec le compte
TestFlight de Raoul ajouté et l’état **INVITED**, vérifié dans la console et par API.
Aucun commit ni push effectué.

## État vérifié lors de la préparation Apple

| Élément                             | Valeur ou résultat                                                                            |
| ----------------------------------- | --------------------------------------------------------------------------------------------- |
| Dépôt                               | `/Users/jrbmt/Desktop/workspace/t4mobile`                                                     |
| Équipe Apple                        | emax conseils — `GY9P9U75F3`                                                                  |
| Identifiant enregistré              | `fr.emaxconseils.t4`                                                                          |
| Fiche App Store Connect             | **T4 Mobile**, Apple ID `6832960692`                                                          |
| UGS / langue principale             | `t4-mobile-ios` / français                                                                    |
| Accès utilisateur à la fiche        | Limité ; les rôles Apple transverses conservent leurs droits                                  |
| Clé API                             | **T4 Mobile CLI**, clé d’équipe avec rôle **Admin**, créée après confirmation écrite de Raoul |
| Portée de cette clé                 | Toutes les apps EMAX, limitation Apple des clés d’équipe                                      |
| Profil App Store                    | **T4 Mobile App Store 2026-11**                                                               |
| UUID du profil                      | `0525dcd7-3515-4a8e-a60a-d0c2151b5904`                                                        |
| Certificat associé                  | Apple Distribution: emax conseils, déjà présent avec sa clé privée dans le Trousseau          |
| Échéance du certificat et du profil | **4 décembre 2026 à 19:21:36 UTC**                                                            |
| Groupe TestFlight                   | **T4 Interne**, ID `2caea9a3-c476-464e-a0f9-0be680a5b06a`                                     |
| Distribution automatique du groupe  | Désactivée                                                                                    |
| Testeurs / builds                   | **0 testeur, 0 build** lors de cette préparation                                              |

[Fiche Apple](https://appstoreconnect.apple.com/apps/6832960692/distribution)
et [groupe interne](https://appstoreconnect.apple.com/teams/091aa7cb-a286-4f8a-a612-52d3fc18387e/apps/6832960692/testflight/groups/2caea9a3-c476-464e-a0f9-0be680a5b06a).

Le profil installé correspond exactement à l’équipe, au bundle et au certificat
local. C’est un profil App Store, sans liste d’appareils ni permission de debug.
`vp run t4:ios:doctor` passe. Le certificat existant n’a pas été renouvelé ou révoqué.

## Accès locaux prêts à l’emploi

- Configuration : `.env.app-store-connect.local`, dans la racine, mode **600**,
  ignorée par Git. Elle contient les identifiants API et le chemin de la clé.
- Clé privée `.p8` : dans
  `~/.config/t4mobile/app-store-connect/private_keys/`, mode **600** ; répertoires
  privés en **700**. Le fichier téléchargé a été déplacé hors de `Downloads`.
- Profil installé :
  `~/Library/Developer/Xcode/UserData/Provisioning Profiles/0525dcd7-3515-4a8e-a60a-d0c2151b5904.mobileprovision`.
- Outil : `scripts/t4/app-store-connect.mjs`, sans dépendance npm supplémentaire.
  Il lit la configuration lui-même et génère ses JWT en mémoire, sans les afficher.

Ces accès existent **sur ce Mac**. Ne pas afficher la clé, la copier dans une
conversation, la commiter ou l’envoyer sur un autre serveur. La clé de signature
du certificat EMAX reste dans le Trousseau ; elle n’a pas été exportée.

## Premier envoi réel

- Archive signée :
  `~/Library/Developer/Xcode/Archives/2026-11-10/T4 Mobile 12.28.19.xcarchive`.
- IPA : `build/ios-local/export/T4Mobile.ipa`, **60 129 210 octets**.
- SHA-256 : `0859c09e709f769adf67347f73e8e4862d020dbb31658bc075cdb78a86bed0ee`.
- Version **0.1.0**, build **1**, bundle `fr.emaxconseils.t4`.
- `ARCHIVE SUCCEEDED`, signature profonde/stricte vérifiée, identité signée
  `GY9P9U75F3.fr.emaxconseils.t4`, debug désactivé, JavaScript embarqué.
- `EXPORT SUCCEEDED`, validation Apple sans erreur et upload sans erreur.
- UUID de livraison : `ef380e41-1122-458a-8a9e-01944f50341d`.
- UUID du build : `ef380e41-1122-458a-8a9e-01944f50341d`, traitement **VALID**,
  audience **INTERNAL_ONLY**, état interne **READY_FOR_BETA_TESTING**.
- Association au groupe **T4 Interne** effectuée et relue par API ; **1 testeur**.
  Aucun blocage de conformité au chiffrement ; aucune publication publique.
- Journaux et suivi : `build/ios-local/validation/apple-validation.log`,
  `apple-upload.log`, `apple-delivery-status.log` et `deployment.json`.
- Le compte TestFlight montré par Raoul a été retrouvé dans App Store Connect :
  rôle Admin et accès à T4 confirmés par API. Sur sa demande explicite de finaliser
  son accès, l’agent l’a ajouté par Computer Use au groupe ; état **Invité** dans
  la console, **INVITED** par API. L’ID du testeur interne est
  `c3579469-32bc-4cf9-a30d-13321671eb1d`.

La chaîne compilation → signature → export → validation → upload → traitement
Apple → association au groupe interne est vérifiée. L’installation sur l’iPhone
reste à confirmer sur l’iPhone de Raoul. L’invitation Apple est déclenchée ;
il peut l’ouvrir sur son iPhone puis accepter et installer dans TestFlight.
Le dernier état relu par l’agent est **INVITED** ; aucune installation physique
n’a été observée par l’agent.

L’ajout par API de l’ancien testeur du même e-mail a échoué avec HTTP 409,
« Tester(s) cannot be assigned ». L’interface **Ajouter des testeurs** du groupe
interne a permis de sélectionner le compte Admin attendu et de réaliser l’ajout.
Le testeur interne ainsi créé porte un ID différent de l’ancien testeur.
Preuve locale : `build/ios-local/validation/tester-final-invitation.json`.

## Commandes de reprise

Depuis le dépôt, vérifier l’accès et l’état distant :

```bash
cd /Users/jrbmt/Desktop/workspace/t4mobile
node scripts/t4/app-store-connect.mjs check
vp run t4:ios:doctor
```

La première commande utilise uniquement des requêtes GET. Elle vérifie l’Apple ID
et le bundle, puis liste les groupes internes et les dix builds les plus récents.
Elle ne crée ni build ni invitation.

Une fois les modifications mobiles terminées et vérifiées, produire une nouvelle
archive signée et l’IPA locale :

```bash
export T4_IOS_BUILD_NUMBER=17
export T4_IOS_BUILD_DIR="$PWD/build/ios-local/build-17"
export T4_IOS_DERIVED_DATA_PATH="$PWD/build/ios-local/DerivedData"
vp run t4:ios:archive
vp run t4:ios:export
```

`archive` régénère déjà le projet iOS et les pods. Ne pas prendre l’ancienne
archive non signée du matin pour une archive distribuable. L’export vise les tests
TestFlight **internes uniquement** et n’effectue aucun envoi. Le chemin de l’archive
retenue est dans `$T4_IOS_BUILD_DIR/latest-archive.txt` ; l’IPA est dans
`$T4_IOS_BUILD_DIR/export/`. Adapter le numéro et le dossier à chaque livraison :
ils doivent être nouveaux et le numéro doit dépasser celui déjà envoyé à Apple.
Choisir explicitement le fichier réellement produit, pas un ancien export.

La signature manuelle est réglée sur la seule cible `T4Mobile` en Release, avec
la bibliothèque Ruby `xcodeproj` disponible sur ce Mac avec CocoaPods. Ne pas
passer un profil global à `xcodebuild` : les bundles des packages Swift le refusent.

Après les vérifications locales, poursuivre automatiquement avec la validation et
l’envoi du nouveau build, conformément à l’autorisation permanente ci-dessus :

```bash
node scripts/t4/app-store-connect.mjs validate /chemin/vers/T4Mobile.ipa
node scripts/t4/app-store-connect.mjs upload /chemin/vers/T4Mobile.ipa --confirm-app-id 6832960692
```

La validation transmet l’IPA à l’outil de validation Apple, sans la distribuer.
La commande `upload` effectue l’envoi réel. Les deux vérifient d’abord l’identifiant
contenu dans l’IPA et la correspondance de la fiche distante. Le paramètre
`--confirm-app-id` protège la cible ; l’autorisation vient de la règle permanente
ci-dessus. Ces deux commandes ont réussi sur l’IPA signée du premier envoi.

Après traitement Apple : contrôler l’état du build, résoudre toute demande de
conformité au chiffrement à partir du code réellement livré, puis ajouter le build
au groupe **T4 Interne**. Une réussite de l’upload ne prouve pas que le build est
prêt à installer. La fiche publique créée par Apple affiche une version 1.0 par
défaut ; la version du binaire prévu est 0.1.0, ce qui n’empêche pas TestFlight.

```bash
node scripts/t4/app-store-connect.mjs check
node scripts/t4/app-store-connect.mjs status UUID_DU_BUILD
node scripts/t4/app-store-connect.mjs distribute UUID_DU_BUILD --confirm-app-id 6832960692 --confirm-group-id 2caea9a3-c476-464e-a0f9-0be680a5b06a
```

`status` lit le traitement, la version, l’état bêta et les groupes du build.
`distribute` vérifie de nouveau l’app, le build valide et le groupe interne T4,
puis associe ce build au groupe. Un groupe contenant des testeurs exige aussi
la confirmation technique de son ID ; la règle permanente autorise la livraison. Avant
l’association, le script désactive les notifications automatiques du nouveau
build et relit cet état. Il n’invite personne et ne modifie pas la distribution
automatique du groupe. L’agent effectue cette association à chaque livraison.

## Méthode de compilation

Le parcours préparé compile avec Xcode sur ce Mac, puis envoie l’IPA à TestFlight.
TestFlight est le service de distribution, pas le service de compilation.
[Xcode Cloud](https://developer.apple.com/xcode-cloud/) inclut 25 heures de calcul
par mois avec Apple Developer et peut automatiser des builds ultérieurs.
Son utilisation nécessitera un dépôt distant T4 et un workflow adapté au monorepo
Expo, notamment la génération iOS et les dépendances. Aucun dépôt distant T4 ni
workflow Xcode Cloud n’a été créé dans cette préparation.

Lors du premier envoi, Raoul avait demandé de livrer les sources en l’état et
de concentrer cet essai sur la chaîne de déploiement. Il a ensuite demandé
explicitement de terminer et déployer les corrections, puis l’onglet Agents.
Les builds 2, 3 et 4 disposent des recettes décrites ci-dessus.

Le compte Apple utilisé par Raoul dans TestFlight est désormais invité au groupe.
Cette invitation Apple a été finalisée à sa demande explicite, après le premier
compte rendu de livraison. La distribution automatique des nouveaux builds reste
désactivée dans Apple : l’agent associe lui-même chaque nouveau build au groupe.
Les confirmations d’identifiants protègent les cibles ; la règle permanente
autorise cette livraison sans nouvelle question à Raoul.

## Preuves et limites

- Reprise depuis un autre répertoire, sans les variables `ASC_*` du terminal :
  le script retrouve sa configuration et l’accès REST fonctionne. Le contrôle
  `ios-local.sh doctor` fonctionne aussi depuis cet autre répertoire. Les liens
  depuis les `AGENTS.md` et le README vers cette reprise ont été vérifiés. Ce
  contrôle porte sur ce Mac, avec le même utilisateur, pas sur une autre machine.
- Authentification REST réussie : l’API retourne **T4 Mobile**, Apple ID
  `6832960692`, bundle `fr.emaxconseils.t4`, le groupe **T4 Interne** et le
  build `0.1.0 (16)` valide et distribué en interne (état final ci-dessus).
- Authentification CLI réussie avec `xcrun altool --list-apps` filtré sur cet Apple
  ID. Journal local : `build/ios-local/validation/altool-list-apps.log`.
- `altool --list-providers` refuse l’authentification par clé API dans cette version,
  malgré un exemple contradictoire de son aide. Utiliser `check` ou `--list-apps`
  pour tester l’accès, pas `--list-providers`.
- Syntaxe Node, formatage et lint du nouvel outil passent. Une IPA de test portant
  `com.t3tools.t3code` est refusée avant lecture de la clé et avant réseau ; un
  appel `upload` sans confirmation de l’Apple ID est également refusé.
- La compilation et la recette visuelle antérieures sont décrites dans
  [T4-MOBILE.md](T4-MOBILE.md). Les archives et IPA livrées ont leurs propres contrôles
  ci-dessus. Ces recettes ne valident pas l’installation sur l’iPhone ni la
  connexion réelle à ses serveurs.
- Les avis Apple sur le contrat des apps payantes et le statut de commerçant UE
  sont restés inchangés. Aucun contrat accepté ni statut juridique déclaré.
  Leur éventuel effet sur un prochain envoi reste à constater ; ne pas accepter
  d’accord au nom de Raoul sans sa confirmation.
- Hindsight n’est pas activé pour ce dépôt ; cette reprise repose sur les fichiers
  et sur les vérifications Apple actuelles.

## Message de reprise après cette livraison

> Lis `T4-TESTFLIGHT-REPRISE.md` dans `/Users/jrbmt/Desktop/workspace/t4mobile`.
> Dernier build : `0.1.0 (23)`, valide et distribué à T4 Interne, UUID
> `953c8611-97ee-464a-9a3d-ce94f605037b`. Branche `t4-mobile-4682`, base
> `v0.1.10-nightly.20261114.4682`, dernier commit `6529f21a53`. Les modifications
> des builds 17 à 23 ne sont **pas commitées** : patch exact dans
> `build/ios-local/build-23/source.patch`. Aucun push ni PR.
> Compiler uniquement avec **Xcode 27.1 ou plus** (27.2 installé) : sinon l’adaptation
> iPhone Duo disparaît sans erreur.
> Point de retour : `t4-mobile-before-4682-20261114`. Preuves dans
> `build/ios-local/build-23/`, `build/ios-local/build-22-recette/` et
> `build/upgrades/4682-20261114/`.
> Pour une nouvelle livraison, vérifier Apple et prendre un numéro supérieur à 23.
> Ne renvoyer ni expirer les anciens builds. Tout développement va automatiquement
> jusqu’à la disponibilité TestFlight pour T4 Interne, sans nouvelle confirmation.
> Les serveurs réels n’ont pas été mis à jour. Ne pas montrer les secrets et ne pas
> toucher à T4 PC, Plume ou Myga.
