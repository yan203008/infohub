import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { CuratedAdminApp } from "./app/admin/curated-admin";
import "./app/globals.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <CuratedAdminApp />
  </StrictMode>,
);
