import "@resit/ui/styles/globals.css";
import "./editor/editor.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { TooltipProvider } from "@resit/ui/components/tooltip";
import { LocaleProvider } from "@resit/ui/hooks/use-locale";

import { App } from "./app";
import { NoticeProvider } from "./lib/notices";

const root = document.getElementById("root");
if (!root) throw new Error("Missing application root");

createRoot(root).render(
  <StrictMode>
    <LocaleProvider locale="en">
      <TooltipProvider>
        <NoticeProvider>
          <App />
        </NoticeProvider>
      </TooltipProvider>
    </LocaleProvider>
  </StrictMode>,
);
