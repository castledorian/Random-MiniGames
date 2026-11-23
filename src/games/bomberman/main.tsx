import { createRoot } from "react-dom/client";
import GameApp from "@/components/GameApp";
import "./styles.css";
import { installUiScale } from "@party/uiScale";

installUiScale();

createRoot(document.getElementById("root")!).render(<GameApp />);
