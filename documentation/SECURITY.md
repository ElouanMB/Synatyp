# Architecture de Sécurité de Synatyp

Ce document détaille les protocoles de sécurité mis en œuvre dans Synatyp pour protéger les actifs numériques de l'association Synaptik RDR, notamment les structures documentaires et les accès aux services d'intelligence artificielle.

## Protection de l'Assistant IA

L'accès au modèle Gemini est sécurisé par un verrou logiciel. Cette mesure permet de réguler l'utilisation des ressources et de garantir un usage conforme aux besoins de l'association.

*   **Validation** : Le déverrouillage s'effectue par une comparaison avec une clé définie en environnement système.
*   **Persistance de Session** : Une fois l'accès validé, un jeton local permet de maintenir l'état de déverrouillage, offrant une expérience utilisateur fluide sans compromettre la sécurité.
*   **Isolation Réseau** : Les communications avec les API tierces sont gérées exclusivement par le backend Rust, empêchant toute fuite de clé API vers l'interface frontend.

## Coffre-fort de Templates

Les modèles de documents officiels constituent une part importante du savoir-faire de l'association. Pour garantir leur intégrité, Synatyp utilise un système de stockage chiffré.

*   **Chiffrement Symétrique** : Utilisation de l'algorithme AES-256-GCM. Ce standard assure à la fois la confidentialité des données et leur authenticité.
*   **Dérivation de Clé de Haute Sécurité** : La clé cryptographique est générée via le protocole PBKDF2-HMAC-SHA256 avec 100 000 itérations. Cette méthode offre une résistance maximale contre les tentatives d'analyse par force brute.
*   **Vérification d'Intégrité** : Le mode GCM permet de détecter instantanément toute altération du fichier source, empêchant le déchiffrement de données corrompues.