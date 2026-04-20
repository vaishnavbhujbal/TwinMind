import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { SettingsProvider } from "./context/SettingsContext";
import { SessionProvider } from "./context/SessionContext";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SettingsProvider>
      <SessionProvider>
        <App />
      </SessionProvider>
    </SettingsProvider>
  </StrictMode>,
);