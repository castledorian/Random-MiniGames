import { createRoot } from "react-dom/client";
import "./index.css";
import { installUiScale } from "@party/uiScale";

installUiScale();
import App from "./App";

createRoot(document.getElementById("root")!).render(<App />);
