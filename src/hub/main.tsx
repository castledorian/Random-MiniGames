import { createRoot } from "react-dom/client";
import Hub from "./Hub";
import "./hub.css";
import { installUiScale } from "@party/uiScale";

installUiScale();

createRoot(document.getElementById("root")!).render(<Hub />);
