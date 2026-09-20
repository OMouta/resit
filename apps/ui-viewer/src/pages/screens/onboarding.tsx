import { useState } from "react";

import {
  CreateWorkspaceStep,
  Onboarding,
} from "@resit/ui/patterns/screens/onboarding";

import { workspace } from "../../fixtures/workspace";
import type { ExampleContext, ExamplePage } from "../../viewer/types";
import { screenExample } from "./shared";

function Flow({ ctx }: { ctx: ExampleContext }) {
  const [step, setStep] = useState<"welcome" | "create">(
    ctx.state === "create" ? "create" : "welcome",
  );
  if (step === "create")
    return (
      <CreateWorkspaceStep
        onBack={() => setStep("welcome")}
        onChooseFolder={() => ctx.log("chooseFolder")}
        onFinish={(values) => ctx.log("finish", values)}
        defaultFolder="D:/Studies 2026-27"
      />
    );
  return (
    <Onboarding
      recent={ctx.state === "first-launch" ? [] : workspace.recent}
      onCreate={() => {
        setStep("create");
        ctx.log("create");
      }}
      onOpenFolder={() => ctx.log("openFolder")}
      onOpenRecent={(id) => ctx.log("openRecent", id)}
    />
  );
}

export const page: ExamplePage = {
  section: "screens",
  slug: "onboarding",
  title: "Onboarding",
  description:
    "First launch with the three ways in, then workspace creation with the first subject. Archive opening stays visible but unavailable until import exists.",
  source: "packages/ui/src/patterns/screens/onboarding.tsx",
  keywords: ["welcome", "create workspace", "first launch"],
  examples: [
    {
      id: "flow",
      title: "Welcome and create",
      ...screenExample,
      states: ["recent", "first-launch", "create"],
      render: (ctx) => <Flow key={`${ctx.state}-${ctx.resetKey}`} ctx={ctx} />,
    },
  ],
};
