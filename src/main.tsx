import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { createBrowserHistory, createHashHistory } from "@tanstack/history";
import "./index.css";
import { initTheme } from "@/lib/theme";

import { routeTree } from "./routeTree.gen";

const history = window.location.protocol === "file:" ? createHashHistory() : createBrowserHistory();

const router = createRouter({ routeTree, history });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

initTheme();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
