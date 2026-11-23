# 🎉 Soirée Jeux (BomberMan Random)

Les jeux multijoueurs entre amis, directement dans le navigateur : un écran titre pour choisir,
et partout le même système **clavier · manette · téléphone en manette via QR code**.

- 💣 **Boom Brawlers** : bomberman 1 à 4 joueurs, héros à compétences, bots, versus local
- ⚡ **Rift Brawl** : combat d'arène à éjection contre l'IA (arcade, survie, contre-la-montre)
- ❓ **Quizclub** : le quiz de soirée (hébergé dans son propre dépôt, lien depuis l'accueil)

▶️ **Jouer : https://castledorian.github.io/BomberMan-Random/**  (Boom Brawlers : `/bomberman/`, Rift Brawl : `/fighter/`)

## Contrôles

| Périphérique | Déplacement | Bombe | Compétence | Pause |
|---|---|---|---|---|
| Clavier A | ZQSD (ou WASD) | Espace / F | E / G / Maj gauche | Échap / P |
| Clavier B | Flèches | Entrée / Pavé 0 | Maj droite / Pavé 1 | Échap / P |
| Manette (Xbox, PS, Switch…) | Stick gauche / croix | A | B / X / Y / gâchettes | Start |
| Téléphone | Joystick tactile | BOMBE | bouton du skill | — |

Rift Brawl : flèches ou ZQSD pour bouger, ↑/Espace sauter, J frapper, K spécial. Téléphone : joystick + SAUT / ATTAQUE / spécial / PAUSE (ATTAQUE lance le combat depuis le menu).

**Téléphone en manette** : sur l'écran du jeu, bouton « 📱 Manette téléphone » → scannez le QR code
(ou ouvrez la page `pad.html` du jeu et tapez le code de salle). Jusqu'à 8 téléphones par salle.
Connexion directe téléphone ⇄ écran (WebRTC) : aucun serveur à héberger. Le même Wi-Fi donne la meilleure réactivité,
mais la 4G fonctionne aussi. Si un téléphone se verrouille ou recharge la page, il retrouve automatiquement sa place.

## Développer

```bash
npm install
npm run dev        # http://localhost:5173 (et l'IP locale affichée, pour tester avec un téléphone)
npm run build      # vérification des types + build dans dist/
```

Chaque push sur `main` déclenche le déploiement GitHub Pages (`.github/workflows/deploy.yml`).

## Organisation du code

```
index.html                 écran titre « Soirée Jeux » (choix du jeu)
bomberman/  fighter/       une page par jeu (index.html) + sa page manette téléphone (pad.html)
src/hub/                   l'écran de sélection ; la liste des jeux est dans games.ts
src/party/                 ⭐ Party Kit : connexion écran ⇄ téléphones, commun à tous les jeux
  protocol.ts host.ts pad.ts   messages, côté écran, côté téléphone
  PairDialog.tsx           fenêtre « QR code + code de salle » réutilisable
  usePartyPad.ts           logique commune des pages manette
src/games/bomberman/       Boom Brawlers (moteur engine.ts, héros, bots, rendu canvas)
src/games/fighter/         Rift Brawl (combat d'arène vs IA : arcade, survie, chrono)
```

## Ajouter un jeu

1. Créer `monjeu/index.html` (et `monjeu/pad.html` si le jeu utilise les téléphones) et le code dans `src/games/monjeu/`.
2. Déclarer les pages dans `vite.config.ts` (`build.rollupOptions.input`).
3. Ajouter une entrée dans `src/hub/games.ts` : la carte apparaît toute seule sur l'écran titre.
4. Pour les téléphones en manette : voir `src/party/README.md` (un `PartyHost` côté écran, `usePartyPad` côté téléphone).

## Idées pour améliorer plus tard

- **Nouveau héros** : ajouter une entrée dans `src/game/heroes.ts` puis son effet dans `useSkill()` (`engine.ts`).
- **Nouveau bonus / mode** : `engine.ts` (types dans `types.ts`).
- **Nouvelle manette** : les boutons du téléphone sont des compteurs (`PAD_BUTTONS` dans `padClient.ts`) ; en ajouter un = un bouton de plus dans `PadPage.tsx`.
- **Site des jeux de soirée** : le dossier `src/party/` peut être copié tel quel dans un autre jeu pour avoir le même système QR code / téléphone.
