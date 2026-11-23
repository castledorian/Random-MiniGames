import { createRoot } from "react-dom/client";
import { installUiScale } from "@party/uiScale";
import "./index.css";
import App from "./App";

installUiScale();

// Pas de StrictMode : la salle manettes (PeerJS) et la boucle de jeu ne doivent démarrer qu'une fois.
createRoot(document.getElementById("root")!).render(<App />);
