# Autosys Viewer – Build HTML Inline

Ce projet génère un **fichier HTML unique** contenant **tout le JavaScript, CSS et webfonts inline**, prêt à être distribué ou déployé.

---

## Prérequis

- Node.js >= 18  
- NPM >= 9  
- Rollup et plugins installés localement

---

## Installation des dépendances

Dans le dossier racine du projet :

```bash
npm install
```

> Assurez-vous que `package.json` contient les dépendances nécessaires :  
> `rollup`, `rollup-plugin-postcss`, `postcss-url`, `@rollup/plugin-terser`.

---

## Structure des fichiers

```
src/
├── index.html           # Template HTML avec <!-- INLINE_JS --> et <!-- INLINE_CSS -->
├── assets/
│   ├── js/              # Modules JS
│   ├── css/             # Fichiers CSS
│   └── fonts/webfonts/  # FontAwesome et autres webfonts
└── lib/                 # Librairies JS non-modulaires (html2canvas, jspdf)
```

---

## Procedure de build

1. **Génération du bundle**  
   - Rollup compile tous les modules JS  
   - PostCSS intègre le CSS et les webfonts en base64  
   - Les librairies non-modulaires (`html2canvas`, `jspdf`) sont ajoutées au début

2. **Injection dans le HTML**  
   - Le JS et CSS sont injectés dans le template `src/index.html`  
   - Le HTML final est **minifié**  
   - Le fichier temporaire JS est supprimé après le build

---

## Commandes

- Pour lancer le build :

```bash
npm run build
```

- Résultat :

```
dist/
└── index.html   # tout inline (JS + CSS + webfonts)
```

> Le fichier `index.html` est autonome, avec **tout le code nécessaire** pour fonctionner dans un navigateur.

---

## Notes

- La structure des modules JS peut rester **modulaire** dans `src/assets/js/`.  
- Les webfonts sont automatiquement converties en **Base64** pour être intégrées directement dans le CSS.  
- Le template HTML doit contenir les balises `<body>` pour que l’injection du JS se fasse correctement.