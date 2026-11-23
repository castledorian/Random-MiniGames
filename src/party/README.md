# Party Kit — téléphones en manette, sans serveur

Brique commune pour les jeux de soirée : l'écran (PC/TV) ouvre une **salle**,
les téléphones la rejoignent en scannant un QR code et deviennent des manettes.
La liaison est directe (WebRTC via [PeerJS](https://peerjs.com)) : le site peut
être 100 % statique (GitHub Pages).

## Réutiliser dans un autre jeu

1. Copier `src/party/` et ajouter la dépendance `peerjs`.
2. Côté écran :

```ts
const host = new PartyHost({ gameId: "mon-jeu" });   // gameId unique par jeu
host.onRoom = (code) => afficherQr(`${location.origin}${location.pathname}pad.html?room=${code}`);
host.onPads = (pads) => majListeJoueurs(pads);        // connexions / déconnexions
host.onInput = (pad) => {                              // à chaque message d'une manette
  // pad.dx / pad.dy ∈ [-1, 1], pad.btn = compteurs d'appuis (un appui = le compteur augmente)
};
host.start();
host.send(pad.pid, { etat: "en jeu", couleur: "#f00" }); // état libre affiché sur le téléphone
```

   Le QR code et le code de salle s'affichent avec `<PairDialog room linkState pads onClose />` (`PairDialog.tsx`).

3. Côté téléphone (`pad.html`) : le plus simple est le hook `usePartyPad(gameId, nbBoutons)` (formulaire de connexion, pseudo, reconnexion, écran allumé). En direct :

```ts
const pad = new PartyPad({ gameId: "mon-jeu", buttons: 4 });
pad.onPhase = (phase, erreur) => …;   // joining → on ⇄ lost, ou error
pad.onStatus = (status) => …;         // ce que l'écran envoie avec host.send()
pad.join(codeSalle, pseudo);
pad.setDir(1, 0); pad.press(0);   // press = appui compté
pad.hold(0, true);                 // hold = bouton maintenu (host : pad.held, bit 0)
```

## Fiabilité

- Code de salle à 4 lettres gardé pendant la session (un rechargement de l'écran garde le même QR code).
- Le téléphone envoie un battement toutes les 400 ms ; l'écran renvoie l'état toutes les 300 ms.
- Coupure, verrouillage ou rechargement du téléphone : reconnexion automatique, même place (60 s).
- Boutons en compteurs : aucun appui perdu ni doublé, même si un message se perd.
- Changer `PARTY_PROTOCOL` si le format des messages change : les anciennes manettes sont alors refusées proprement.
