# Le Grimoire

Le Grimoire est une application web en français conçue pour aider les maîtres du jeu et les joueurs à organiser leurs campagnes de Donjons & Dragons 5e (édition 2014).

## Fonctionnalités disponibles

- Créer et gérer plusieurs campagnes, leur statut et leur liste de joueurs.
- Compléter les fiches des joueurs avec le nom du personnage, sa classe et son niveau.
- Rédiger plusieurs résumés par campagne, avec mise en forme Markdown.
- Prendre des notes avec des tags, puis les trier par date ou par tag et rechercher un tag.
- Enregistrer des liens web et des images; les liens s’ouvrent dans un nouvel onglet et les images s’affichent dans une galerie avec aperçu agrandi.

Les rubriques Encyclopédie, Personnages, Outils de jeu et Mon compte sont présentées dans l’interface, mais ne sont pas encore des fonctionnalités complètes.

## Technologies

- **React 19** pour l’interface.
- **TypeScript** pour le typage du code.
- **Vite 6** pour le serveur de développement et la compilation.
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

Les campagnes sont enregistrées dans le `localStorage` du navigateur. Elles restent donc sur cet appareil et dans ce navigateur : il n’y a actuellement ni compte utilisateur, ni serveur, ni synchronisation entre appareils. Effacer les données du navigateur peut supprimer les campagnes enregistrées.

Les champs sont validés avant leur enregistrement, les URL de ressources sont limitées aux protocoles HTTP et HTTPS, et le contenu Markdown est assaini avant affichage. Une politique de sécurité du contenu (CSP) est également définie dans `index.html`.

## Structure du projet

- `src/App.tsx` : interface et gestion des campagnes.
- `src/MarkdownRenderer.tsx` : rendu assaini du Markdown.
- `src/styles.css` : styles de l’application.
- `index.html` : document HTML, métadonnées et CSP.
- `vite.config.ts` : configuration de Vite.
