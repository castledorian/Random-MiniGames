# 💣 BomberMan Random — Boom Brawlers

Bomberman-like explosif pour 1 à 4 joueurs, jouable directement dans le navigateur.
Héros à compétences, bots, versus local et **téléphone en manette via QR code**.

▶️ **Jouer : https://castledorian.github.io/BomberMan-Random/**

## Contrôles

| Périphérique | Déplacement | Bombe | Compétence | Pause |
|---|---|---|---|---|
| Clavier A | ZQSD (ou WASD) | Espace / F | E / G / Maj gauche | Échap / P |
| Clavier B | Flèches | Entrée / Pavé 0 | Maj droite / Pavé 1 | Échap / P |
| Manette (Xbox, PS, Switch…) | Stick gauche / croix | A | B / X / Y / gâchettes | Start |
| Téléphone | Joystick tactile | BOMBE | bouton du skill | — |

**Téléphone en manette** : sur l'écran du jeu, bouton « 📱 Manette téléphone » → scannez le QR code
(ou ouvrez `…/pad.html` et tapez le code de salle). Jusqu'à 8 téléphones par salle.
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
index.html / pad.html     deux pages : l'écran de jeu et la manette téléphone
src/party/                ⭐ Party Kit : connexion écran ⇄ téléphones, réutilisable dans d'autres jeux
  protocol.ts             format des messages, codes de salle
  host.ts                 côté écran (PartyHost)
  pad.ts                  côté téléphone (PartyPad)
src/game/                 moteur du jeu (sans React)
  engine.ts               règles, boucle de jeu, bombes, compétences
  heroes.ts               liste des héros (stats, passifs, compétences, déblocage XP)
  ai.ts                   bots
  render.ts               dessin sur canvas
  input.ts                clavier / manettes / téléphones / tactile unifiés
  padClient.ts            branche le Party Kit sur input.ts
  audio.ts, storage.ts    sons générés, profil + meilleurs scores (localStorage)
src/components/           écrans React (titre, salon versus, héros, scores, partie)
src/pad/PadPage.tsx       interface de la manette téléphone
```

## Idées pour améliorer plus tard

- **Nouveau héros** : ajouter une entrée dans `src/game/heroes.ts` puis son effet dans `useSkill()` (`engine.ts`).
- **Nouveau bonus / mode** : `engine.ts` (types dans `types.ts`).
- **Nouvelle manette** : les boutons du téléphone sont des compteurs (`PAD_BUTTONS` dans `padClient.ts`) ; en ajouter un = un bouton de plus dans `PadPage.tsx`.
- **Site des jeux de soirée** : le dossier `src/party/` peut être copié tel quel dans un autre jeu pour avoir le même système QR code / téléphone.
