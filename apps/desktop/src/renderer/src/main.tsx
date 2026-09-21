import "@resit/ui/styles/globals.css";
import "./editor/editor.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { TooltipProvider } from "@resit/ui/components/tooltip";
import { LocaleProvider } from "@resit/ui/hooks/use-locale";
import { addMessages } from "@resit/ui/lib/i18n";

import { messages } from "../../shared/i18n/pt-PT";
import { App } from "./app";
import { useCurrentLocale } from "./lib/locale";
import { NoticeProvider } from "./lib/notices";

addMessages("pt-PT", messages);

const root = document.getElementById("root");
if (!root) throw new Error("Missing application root");

/** Everything, in the language the settings choose. */
function Root() {
  return (
    <LocaleProvider locale={useCurrentLocale()}>
      <TooltipProvider>
        <NoticeProvider>
          <App />
        </NoticeProvider>
      </TooltipProvider>
    </LocaleProvider>
  );
}

createRoot(root).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
