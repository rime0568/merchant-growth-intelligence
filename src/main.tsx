import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import type { AppData } from "./types/data";

const root = createRoot(document.getElementById("root")!);

root.render(<div className="boot-state"><b>Loading Merchant Growth Intelligence</b><span>Preparing the synthetic portfolio...</span></div>);

fetch("/data/generatedData.json")
  .then((response) => {
    if (!response.ok) throw new Error(`Data request failed with ${response.status}`);
    return response.json() as Promise<AppData>;
  })
  .then((appData) => root.render(<StrictMode><App appData={appData} /></StrictMode>))
  .catch(() => root.render(<div className="boot-state error"><b>The portfolio could not be loaded.</b><span>Please refresh the page or try again later.</span></div>));
