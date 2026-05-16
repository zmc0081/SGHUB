import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./router";
import "./styles/index.css";
import { bootstrapI18n } from "./i18n";

// Resolve the active language (user pick → OS locale → en-US) before
// mounting so the first paint is already in the right language —
// avoids a flash of en-US for non-English users.
void bootstrapI18n().finally(() => {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <RouterProvider router={router} />
    </React.StrictMode>,
  );
});
