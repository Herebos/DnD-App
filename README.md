# Le Grimoire

Le Grimoire est une application web en français conçue pour aider les maîtres du jeu et les joueurs à organiser leurs campagnes de Donjons & Dragons 5e (édition 2014).

## Fonctionnalités disponibles

- Créer et gérer plusieurs campagnes, leur statut et leur liste de joueurs.
- Créer et gérer des fiches de personnage D&D 5e (2014), avec portrait et options de races, classes, historiques, équipement, armes, objets magiques et sorts issues de la D&D 5e API; exporter ou importer une fiche ou une collection au format JSON.
- Compléter les fiches des joueurs avec le nom du personnage, sa classe et son niveau.
- Rédiger plusieurs résumés par campagne, avec mise en forme Markdown.
- Prendre des notes avec des tags, puis les trier par date ou par tag et rechercher un tag.
- Enregistrer des liens web et des images; les liens s’ouvrent dans un nouvel onglet et les images s’affichent dans une galerie avec aperçu agrandi.
- Parcourir et rechercher les créatures, sorts, équipements, objets magiques, classes, races, caractéristiques, conditions, règles et historiques de l’édition 2014 dans l’Encyclopédie, avec accès aux fiches détaillées de la D&D 5e API.
- Suivre l’initiative d’un combat en ajoutant, modifiant, supprimant et réordonnant les personnages et monstres, avec sauvegarde locale et gestion des tours.

La page Outils de jeu propose le suivi d’initiative; le lancer de dés reste à venir.

## Technologies

- **React 19** pour l’interface.
- **TypeScript** pour le typage du code.
- **Vite 6** pour le serveur de développement et la compilation.
- **Netlify Identity** pour la création de compte, la connexion et la déconnexion.
- **react-markdown**, **remark-gfm**, **rehype-raw** et **rehype-sanitize** pour afficher le Markdown des résumés avec assainissement du HTML.

## Prérequis

- Node.js et npm.

## Installation et démarrage

À la racine du projet, installez les dépendances :

```sh
npm install
```

Démarrez ensuite le serveur de développement :

```sh
npm run dev
```

Vite indique l’adresse locale à ouvrir dans le navigateur.

## Commandes disponibles

```sh
npm run dev      # Serveur de développement
npm run build    # Vérification TypeScript et compilation de production
npm run preview  # Prévisualisation de la compilation
```

## Données et sécurité

Netlify Identity doit être activé dans les paramètres du site Netlify. Les pages Campagnes et Personnages nécessitent un compte; l’inscription peut aussi être soumise aux réglages de confirmation ou d’invitation configurés dans Netlify Identity.

Pour le développement local, le fichier `.env.local` active un compte de démonstration sans mot de passe. Ce mode est limité au serveur Vite de développement (`npm run dev`), ne crée aucun compte Netlify et n’est pas inclus dans une compilation de production. `.env.local` est ignoré par Git; ne transformez pas ce mode en authentification de production.

Les campagnes et personnages sont enregistrés dans le `localStorage` du navigateur, sous une clé propre à l’identifiant Netlify de chaque compte. Ils restent sur cet appareil et dans ce navigateur : il n’y a pas de serveur de données ni de synchronisation entre appareils. Les anciennes campagnes enregistrées avant l’ajout des comptes sous la clé `le-grimoire-campaigns` ne sont pas migrées automatiquement. Effacer les données du navigateur peut supprimer les données enregistrées.

La connexion contrôle l’accès dans l’interface, mais les campagnes demeurent des données locales modifiables depuis le navigateur; elle ne constitue pas une protection serveur. Une autorisation réellement confidentielle ou une synchronisation nécessite de stocker et vérifier les données côté serveur.

Les champs sont validés avant leur enregistrement, les URL de ressources sont limitées aux protocoles HTTP et HTTPS, et le contenu Markdown est assaini avant affichage. Une politique de sécurité du contenu (CSP) est également définie dans `index.html`.

## Structure du projet

- `src/App.tsx` : interface et gestion des campagnes.
- `src/MarkdownRenderer.tsx` : rendu assaini du Markdown.
- `src/styles.css` : styles de l’application.
- `index.html` : document HTML, métadonnées et CSP.
- `vite.config.ts` : configuration de Vite.
