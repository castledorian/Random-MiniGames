import { createRoot } from "react-dom/client";
import "@fontsource-variable/fredoka";
import { installUiScale } from "@party/uiScale";
import "./index.css";
import App from "./App";

installUiScale();

// Pas de StrictMode : la salle manettes (PeerJS) ne doit être ouverte qu'une fois.
createRoot(document.getElementById("root")!).render(<App />);
