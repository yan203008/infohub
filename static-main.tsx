import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { InfoHubApp } from "./app/infohub-app";
import "./app/globals.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <InfoHubApp user={null} />
  </StrictMode>,
);
