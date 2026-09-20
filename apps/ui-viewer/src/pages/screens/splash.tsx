import { Splash } from "@resit/ui/patterns/screens/splash";

import type { ExamplePage } from "../../viewer/types";
import { screenExample } from "./shared";

export const page: ExamplePage = {
  section: "screens",
  slug: "splash",
  title: "Splash",
  description:
    "The window while resit reads its settings and reopens the last workspace. It fades out once the workspace screen is ready.",
  source: "packages/ui/src/patterns/screens/splash.tsx",
  keywords: ["launch", "loading", "startup"],
  examples: [
    {
      id: "states",
      title: "Opening and leaving",
      ...screenExample,
      states: ["opening", "no-workspace", "leaving"],
      render: ({ state }) => (
        <Splash
          leaving={state === "leaving"}
          {...(state === "no-workspace"
            ? { message: "Getting things ready…" }
            : {})}
        />
      ),
    },
  ],
};
