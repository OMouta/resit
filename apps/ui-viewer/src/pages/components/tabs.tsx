import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@resit/ui/components/tabs";
import { FileTextIcon, LayersIcon, ListIcon } from "lucide-react";

import type { ExamplePage } from "../../viewer/types";

export const page: ExamplePage = {
  section: "components",
  slug: "tabs",
  title: "Tabs",
  description:
    "Segmented for switching views inside a panel; underline for top-level sections of a page.",
  source: "packages/ui/src/components/tabs.tsx",
  keywords: ["segmented", "switch", "views"],
  examples: [
    {
      id: "segmented",
      title: "Segmented",
      width: "auto",
      render: (ctx) => (
        <Tabs
          defaultValue="outline"
          onValueChange={(value) => ctx.log("onValueChange", value)}
        >
          <TabsList aria-label="PDF sidebar">
            <TabsTrigger value="thumbnails">Thumbnails</TabsTrigger>
            <TabsTrigger value="outline">Outline</TabsTrigger>
            <TabsTrigger value="annotations">Annotations</TabsTrigger>
          </TabsList>
          <TabsContent
            value="thumbnails"
            className="text-sm text-muted-foreground"
          >
            14 pages
          </TabsContent>
          <TabsContent
            value="outline"
            className="text-sm text-muted-foreground"
          >
            5 headings
          </TabsContent>
          <TabsContent
            value="annotations"
            className="text-sm text-muted-foreground"
          >
            4 annotations
          </TabsContent>
        </Tabs>
      ),
    },
    {
      id: "icons",
      title: "With icons and disabled",
      width: "auto",
      render: () => (
        <Tabs defaultValue="notes">
          <TabsList aria-label="Resource kind">
            <TabsTrigger value="notes">
              <FileTextIcon /> Notes
            </TabsTrigger>
            <TabsTrigger value="cards">
              <LayersIcon /> Cards
            </TabsTrigger>
            <TabsTrigger value="all" disabled>
              <ListIcon /> All
            </TabsTrigger>
          </TabsList>
        </Tabs>
      ),
    },
    {
      id: "underline",
      title: "Underline",
      width: 520,
      render: (ctx) => (
        <Tabs
          defaultValue="plan"
          onValueChange={(value) => ctx.log("onValueChange", value)}
        >
          <TabsList
            variant="underline"
            aria-label="Study sections"
            className="w-full"
          >
            <TabsTrigger value="plan">Plan</TabsTrigger>
            <TabsTrigger value="practice">Practice</TabsTrigger>
            <TabsTrigger value="flashcards">Flashcards</TabsTrigger>
            <TabsTrigger value="profile">Learner profile</TabsTrigger>
          </TabsList>
          <TabsContent
            value="plan"
            className="pt-3 text-sm text-muted-foreground"
          >
            This week: 6 sessions, 1 overdue.
          </TabsContent>
          <TabsContent
            value="practice"
            className="pt-3 text-sm text-muted-foreground"
          >
            3 exercises ready.
          </TabsContent>
          <TabsContent
            value="flashcards"
            className="pt-3 text-sm text-muted-foreground"
          >
            12 cards due.
          </TabsContent>
          <TabsContent
            value="profile"
            className="pt-3 text-sm text-muted-foreground"
          >
            7 concepts tracked.
          </TabsContent>
        </Tabs>
      ),
    },
  ],
};
