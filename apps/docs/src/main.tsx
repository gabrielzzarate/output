import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/literata/opsz.css";
import "@fontsource-variable/literata/opsz-italic.css";
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "@output/core/styles.css";
import "@output/core/themes/reader.css";
import "@output/core/themes/compact.css";
import "./site.css";
import { RuntimeProvider } from "./runtime";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RuntimeProvider>
      <App />
    </RuntimeProvider>
  </StrictMode>,
);
