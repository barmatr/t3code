# Compatibilité serveur de T4 Mobile 4994

Contrôles du 20 novembre 2026 avec les contrats et le client RPC de la fusion
`20cafdda4cf64e3fc105faa34eac7d319229bb9d`.

| Cible                              | Version observée                            | Preuve                                                                                                                                                                                                                                                                                          |
| ---------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T3 du Mac en service               | `0.1.10-nightly.20261114.4682`, protocole 2 | Descripteur HTTP lu sur la boucle locale et décodé par le client 4994.                                                                                                                                                                                                                          |
| Runtime T3 du Mac, instance isolée | `0.1.10-nightly.20261114.4682`, protocole 2 | Le CLI embarqué dans l’application Nightly du Mac a démarré sur un répertoire temporaire et une adresse de boucle locale. Après authentification limitée à `orchestration:read`, le client 4994 a décodé la configuration, réussi la sonde RPC et décodé le premier événement shell `snapshot`. |
| T3 distant `2.29.105.190`          | `0.1.10-nightly.20261114.4682`, protocole 2 | Descripteur de l’instance en service lu par une requête HTTP locale via SSH, puis décodé par le client 4994. La version observée remplace le repère historique 0.1.6.                                                                                                                           |

La sonde du Mac utilisait une base neuve et un instantané sans fils. L’instance
isolée et son répertoire temporaire ont été arrêtés et supprimés après le
contrôle. Sur le distant, la vérification se limite au descripteur public.
Le flux authentifié distant et les fonctions qui requièrent une capacité serveur
plus récente restent à recetter. L’adresse dédiée était déjà active pour SSH.

Les preuves locales sont dans `sonde.log` et les trois fichiers
`*-environment.json`. Accès en lecture seule aux serveurs en service.
