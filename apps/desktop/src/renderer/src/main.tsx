import "@resit/ui/styles/globals.css";
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { TooltipProvider } from "@resit/ui/components/tooltip";
import { applyAppearance } from "@resit/ui/lib/theme";
import { Onboarding } from "@resit/ui/patterns/screens/onboarding";

function App() {
  const [health, setHealth] = useState<"checking" | "ok" | "failed">(
    "checking",
  );

  useEffect(() => {
    applyAppearance(document.documentElement, { theme: "system" });
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () =>
      applyAppearance(document.documentElement, { theme: "system" });
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    window.resit
      .healthCheck()
      .then((result) => setHealth(result.status === "ok" ? "ok" : "failed"))
      .catch(() => setHealth("failed"));
  }, []);

  return (
    <main
      aria-label="resit"
      className="flex h-dvh flex-col"
      data-health={health}
    >
      <TooltipProvider>
        <Onboarding
          recent={[]}
          onCreate={() => undefined}
          onOpenFolder={() => undefined}
          onOpenRecent={() => undefined}
          className="min-h-0 flex-1"
        />
      </TooltipProvider>
      <footer className="flex h-8 items-center border-t bg-sidebar px-3 text-xs text-muted-foreground">
        {health === "checking" ? "Checking the background worker…" : null}
        {health === "ok" ? "Background worker ready" : null}
        {health === "failed" ? "Background worker did not respond" : null}
      </footer>
    </main>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing application root");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
