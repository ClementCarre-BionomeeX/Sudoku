# Sudoku d'entraînement

Sudoku pour s'entraîner aux techniques (X-Wing, XY-Wing, W-Wing…), installable hors ligne sur téléphone.

**Appli :** https://clementcarre-bionomeex.github.io/Sudoku/ — l'ouvrir une fois, puis « Ajouter à l'écran d'accueil ».

## Contenu
- `index.html`, `manifest.webmanifest`, `sw.js`, `icon-*.png` : l'appli publiée (GitHub Pages, branche `main`, racine).
- `src/engine.js` : solveur, générateur et détection des techniques.
- `src/page.html` : interface ; `/*ENGINE*/` y est remplacé par le moteur.

## Mettre à jour
1. Modifier `src/page.html` ou `src/engine.js`.
2. Reconstruire `index.html` (moteur inséré dans la page + en-tête PWA, voir `src/build_pwa.py`).
3. Incrémenter `VERSION` dans `sw.js` pour que les téléphones récupèrent la nouvelle version.
