import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { createBrowserHistory, createHashHistory } from "@tanstack/history";
import "./index.css";
import { createQueryClient } from "@/lib/query/client";
import { initTheme } from "@/lib/theme";

import { routeTree } from "./routeTree.gen";

const history = window.location.protocol === "file:" ? createHashHistory() : createBrowserHistory();

const router = createRouter({ routeTree, history });
const queryClient = createQueryClient();

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

initTheme();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>,
);
