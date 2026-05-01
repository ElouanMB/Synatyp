# Spécifications Techniques et Capacités

Ce document dresse l'inventaire exhaustif des fonctionnalités de Synatyp, classées par domaine d'application.

## Interface et Expérience Utilisateur

*   **Mode Hybride** : Alternance ou simultanéité entre le code source et l'aperçu visuel interactif.
*   **Visual Cursor** : Système de repérage bidirectionnel permettant de lier instantanément une ligne de code à sa position sur le PDF.
*   **Smart Shortcuts** : Raccourcis optimisés pour la productivité (Ctrl+L pour l'IA, Ctrl+S pour la sauvegarde, Ctrl+P pour l'export).
*   **Interface Adaptative** : Thème sombre haute fidélité avec gestion des barres latérales et terminaux escamotables.

## Moteur de Rédaction Assistée

*   **IA Contextuelle** : Support du modèle Gemini Flash 1.5 pour la transformation de notes en code Typst.
*   **Suggestions Actives** : Bibliothèque de commandes prédéfinies pour l'insertion rapide de structures.
*   **Nettoyage Automatique** : Système de post-traitement des réponses IA pour garantir un code Typst valide et sans balises Markdown superflues.

## Rendu et Exportation

*   **Moteur Typst Natif** : Intégration directe du compilateur Typst via Rust pour des performances de rendu millisecondées.
*   **Export PDF** : Génération de documents PDF avec support complet des polices embarquées et des métadonnées.
*   **Gestion des Assets** : Résolution intelligente des chemins d'images et ressources via un protocole sécurisé.

## Sécurité et Chiffrement

*   **Vault AES-256-GCM** : Chiffrement symétrique des templates avec authentification des données.
*   **PBKDF2 Key Derivation** : Transformation des mots de passe utilisateurs en clés cryptographiques fortes (100k itérations).
*   **Signatures de Mise à Jour** : Système Ed25519 garantissant l'intégrité des mises à jour logicielles distribuées.

---

*Note : Pour une présentation générale du projet, veuillez vous référer au [README.md](README.md).*
