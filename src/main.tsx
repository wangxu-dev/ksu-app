import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { createBrowserHistory, createHashHistory } from "@tanstack/history";
import { ThemeProvider } from "next-themes";
import "./index.css";
import { I18nProvider } from "@/lib/i18n";
import { createQueryClient } from "@/lib/query/client";
import { startRendererRequesterBridge } from "@/lib/request/renderer-requester-bridge";

import { routeTree } from "./routeTree.gen";

const history = window.location.protocol === "file:" ? createHashHistory() : createBrowserHistory();

const router = createRouter({ routeTree, history });
const queryClient = createQueryClient();

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

startRendererRequesterBridge();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <I18nProvider>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </I18nProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
