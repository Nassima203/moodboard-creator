[README.md](https://github.com/user-attachments/files/33266090/README.md)
# NASSIMOOD — Créateur de moodboards

> Là où l'inspiration rencontre l'innovation.

NASSIMOOD est une application web pour composer des moodboards : on épingle des images, des textes, des couleurs et des formes sur un canvas, puis on enregistre ses planches dans un compte personnel pour les retrouver et les reprendre plus tard.

Projet personnel conçu et développé par **Nassima Adli** (Bachelor Développement Web, HETIC), avec l'aide de Claude Code.

## Sommaire

1. [Fonctionnalités](#fonctionnalités)
2. [Utiliser l'application](#utiliser-lapplication)
3. [Stack technique](#stack-technique)
4. [Architecture](#architecture)
5. [Lancer le projet en local](#lancer-le-projet-en-local)
6. [Configuration](#configuration)
7. [API](#api)
8. [Modèle de données](#modèle-de-données)
9. [Sécurité](#sécurité)
10. [Limites connues et pistes d'amélioration](#limites-connues-et-pistes-damélioration)

## Fonctionnalités

**Éditeur**

- Ajout d'**images** importées depuis l'ordinateur, avec recadrage.
- Ajout de **textes** avec choix de la police et de la couleur.
- Ajout de **blocs de couleur** et de **formes** : rectangle, rectangle arrondi, cercle, triangle, losange, pentagone, hexagone, étoile.
- **Dessin libre** avec choix de la couleur et de l'épaisseur du trait.
- **Arrière-plan** au choix parmi une palette de teintes.
- Sur chaque élément : déplacement, redimensionnement, rotation, passage au premier plan, suppression.
- **Catalogue de plus de 1 800 polices Google**, chargées à la demande pour ne pas alourdir la page.
- **Zoom** de 25 % à 200 % sur un canvas de 1 600 × 1 400 px.
- **Annuler / rétablir** sur 30 niveaux (`Ctrl + Z`, `Ctrl + Y` ou `Ctrl + Maj + Z`).
- **Alerte** avant de quitter la page avec des modifications non enregistrées.

**Comptes et sauvegarde**

- Inscription et connexion par e-mail et mot de passe.
- L'éditeur est utilisable **sans compte** : la création d'un compte est proposée au moment d'enregistrer.
- Page « Mes moodboards » : liste des planches avec aperçu, ouverture, création et suppression.

## Utiliser l'application

1. Sur la page d'accueil, cliquer sur **Créer un moodboard** : l'éditeur s'ouvre directement.
2. Ajouter des éléments avec la barre d'outils : image, texte, couleur, forme, dessin ou arrière-plan.
3. Placer, redimensionner et pivoter les éléments, puis ajuster leurs réglages (police, couleur, recadrage…).
4. Donner un nom au moodboard, puis cliquer sur **Enregistrer**.
5. Si l'on n'est pas connecté, créer un compte dans la fenêtre qui s'ouvre : la planche est sauvegardée aussitôt.
6. Retrouver ses planches plus tard depuis **Mes moodboards**.

## Stack technique

| Couche | Technologies |
| --- | --- |
| Front-end | HTML, CSS, JavaScript natif (sans framework) |
| Back-end | Node.js, Express |
| Authentification | JWT (validité 30 jours), mots de passe hachés avec bcrypt (`bcryptjs`) |
| Base de données | Turso (libSQL / SQLite), fichier local en développement |

Dépendances serveur : `express`, `bcryptjs`, `jsonwebtoken`, `@libsql/client`.

## Architecture

Un seul serveur Node sert à la fois l'API et les fichiers du front-end.

```
.
├── index.html          Structure des écrans (accueil, connexion, projets, éditeur)
├── style.css           Styles
├── script.js           Logique du front : éditeur, écrans, appels à l'API
├── fonts-data.js       Catalogue des polices Google
├── server/
│   ├── index.js        API REST Express + service des fichiers statiques
│   ├── auth.js         Création et vérification des jetons JWT
│   └── db.js           Connexion libSQL et création des tables
└── package.json
```

Le front communique avec le serveur en JSON via des appels `fetch` vers `/api/...`. Le jeton JWT est envoyé dans l'en-tête `Authorization: Bearer <token>`.

## Lancer le projet en local

Prérequis : Node.js et npm.

```bash
npm install
npm start
```

L'application est disponible sur <http://localhost:3000>.

Sans configuration, une base SQLite locale (`data.sqlite`) est créée à la racine et un secret JWT est généré dans `.jwt-secret`. Ces fichiers sont ignorés par Git.

## Configuration

Les variables d'environnement sont toutes facultatives en local.

| Variable | Rôle | Valeur par défaut |
| --- | --- | --- |
| `PORT` | Port du serveur | `3000` |
| `JWT_SECRET` | Secret de signature des jetons | généré dans `.jwt-secret` |
| `DATABASE_URL` | URL de la base Turso (`libsql://…`) | fichier local `data.sqlite` |
| `DATABASE_AUTH_TOKEN` | Jeton d'accès à la base Turso | aucune |

Pour utiliser Turso plutôt que le fichier local, renseigner `DATABASE_URL` et `DATABASE_AUTH_TOKEN`. Les tables sont créées automatiquement au démarrage.

## API

| Méthode | Route | Authentification | Rôle |
| --- | --- | --- | --- |
| `POST` | `/api/signup` | non | Créer un compte (e-mail, mot de passe) et recevoir un jeton |
| `POST` | `/api/login` | non | Se connecter et recevoir un jeton |
| `GET` | `/api/me` | oui | Récupérer l'e-mail de l'utilisateur connecté |
| `GET` | `/api/boards` | oui | Lister ses moodboards, du plus récent au plus ancien |
| `GET` | `/api/boards/:id` | oui | Récupérer un moodboard |
| `PUT` | `/api/boards/:id` | oui | Créer ou mettre à jour un moodboard |
| `DELETE` | `/api/boards/:id` | oui | Supprimer un moodboard |

Les requêtes sur les moodboards sont toujours filtrées par `user_id` : un utilisateur ne peut lire, modifier ou supprimer que ses propres planches.

## Modèle de données

Deux tables, créées automatiquement au démarrage.

**`users`**

| Colonne | Type | Description |
| --- | --- | --- |
| `id` | texte, clé primaire | Identifiant aléatoire |
| `email` | texte, unique | Adresse e-mail en minuscules |
| `password_hash` | texte | Mot de passe haché (bcrypt) |
| `created_at` | entier | Date de création (timestamp) |

**`boards`**

| Colonne | Type | Description |
| --- | --- | --- |
| `id` | texte, clé primaire | Identifiant du moodboard |
| `user_id` | texte, clé étrangère | Propriétaire (suppression en cascade) |
| `name` | texte | Nom du moodboard |
| `elements` | texte (JSON) | Liste des éléments : images, textes, couleurs, formes, dessins |
| `background` | texte | Couleur d'arrière-plan |
| `updated_at` | entier | Dernière modification (timestamp) |

## Sécurité

- Mots de passe hachés avec bcrypt, jamais stockés en clair.
- Requêtes SQL paramétrées.
- Routes des moodboards protégées par jeton JWT et filtrées par utilisateur.
- Secret JWT, base locale et variables d'environnement exclus du dépôt (`.gitignore`).

## Limites connues et pistes d'amélioration

- Validation minimale des comptes : 6 caractères minimum pour le mot de passe, pas de limitation du nombre de tentatives de connexion.
- Pas de tests automatisés ni d'intégration continue.
- Tout le front tient dans un seul fichier (`script.js`) : un découpage en modules serait la prochaine étape.
- Les images sont enregistrées dans le JSON du moodboard, donc dans la base : un stockage de fichiers dédié serait préférable à grande échelle.
