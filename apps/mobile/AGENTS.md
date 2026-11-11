# T4 Mobile

Expo 58 / React Native 0.88, dans le monorepo T3 conservé pour ses packages partagés.
Le client se connecte aux serveurs officiels par appairage direct ; ne pas démarrer
un serveur contre les données réelles de T3.

- Identité : `app.config.ts`. Production : `fr.emaxconseils.t4`, `t4code`, équipe
  EMAX `GY9P9U75F3`. Dev et preview ont des identifiants et schémas suffixés.
- Racine : `vp run t4:ios:doctor`, `vp run t4:ios:prebuild`,
  `vp run t4:ios:archive`, `vp run t4:ios:export`. L’export reste local.
- `vp run t4:ios:archive:unsigned` valide seulement la compilation, sans produire
  une app distribuable. Prérequis et blocages : [T4-MOBILE.md](../../T4-MOBILE.md).
- Accès Apple, signature et déploiement : lire
  [T4-TESTFLIGHT-REPRISE.md](../../T4-TESTFLIGHT-REPRISE.md). La configuration locale
  et les secrets de ce Mac y sont localisés ; commencer par ses contrôles en lecture.
- Ni mises à jour OTA, ni projet EAS, ni connexion cloud T3 dans cette version.
  `iosLocalOnlyBuild` désactive push, Live Activities et réception par extension.
  Les flux temps réel au premier plan passent toujours par les serveurs appairés.
- Valider la config Expo et les fichiers natifs avec `scripts/t4/verify-*`.
  Tester les changements de liens et de capacités dans les suites existantes ciblées.
- Pour une recette dans un simulateur, utiliser les outils Device T3 et le skill
  `.agents/skills/test-t3-mobile`, en adaptant l’identifiant et le schéma à T4.
  `mobile:install` vise déjà `fr.emaxconseils.t4.dev` ; le script d’appairage du skill
  amont vise encore T3 : utiliser le lien T4 avec l’outil Device au lieu de ce script.
- Les fichiers iOS générés, profils, clés privées, `.env` et archives restent ignorés.
  Aucun envoi à TestFlight sans validation explicite de Raoul.
