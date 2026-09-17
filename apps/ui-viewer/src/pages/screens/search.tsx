import { useState } from "react";

import {
  SearchResults,
  type SearchResultKind,
} from "@resit/ui/patterns/navigation/search-results";

import { searchQuery, searchResults } from "../../fixtures/search";
import type { ExampleContext, ExamplePage } from "../../viewer/types";
import { ScreenFrame, screenExample } from "./shared";

const allKinds: SearchResultKind[] = [
  "note",
  "pdf",
  "flashcard",
  "conversation",
];

function Screen({ ctx }: { ctx: ExampleContext }) {
  const [query, setQuery] = useState(
    ctx.state === "empty" ? "ε-δ contínua" : searchQuery,
  );
  const [scope, setScope] = useState<"workspace" | "subject" | "project">(
    ctx.state === "subject" ? "subject" : "workspace",
  );
  const [kinds, setKinds] = useState<SearchResultKind[]>(allKinds);
  const [selectedId, setSelectedId] = useState<string | undefined>("sr_1");
  const results =
    ctx.state === "empty"
      ? []
      : searchResults.filter(
          (result) =>
            kinds.includes(result.kind) &&
            (scope !== "subject" || result.subject?.name === "Mathematics"),
        );
  return (
    <ScreenFrame
      ctx={ctx}
      title="Search — ISEP 2026/27"
      activeDestination={undefined}
    >
      <SearchResults
        query={query}
        onQueryChange={(value) => {
          setQuery(value);
          ctx.log("onQueryChange", value);
        }}
        results={results}
        scope={scope}
        onScopeChange={(value) => {
          setScope(value);
          ctx.log("onScopeChange", value);
        }}
        scopeLabels={{
          subject: "Mathematics",
          project: "Numerical Simulation",
        }}
        kinds={allKinds}
        activeKinds={kinds}
        onKindsChange={setKinds}
        selectedId={selectedId}
        onOpen={(result) => {
          setSelectedId(result.id);
          ctx.log("onOpen", result.id);
        }}
      />
    </ScreenFrame>
  );
}

export const page: ExamplePage = {
  section: "screens",
  slug: "search",
  title: "Search results",
  description:
    "Results grouped by subject with the match highlighted, scoped to the workspace, the focused subject, or a project.",
  source: "packages/ui/src/patterns/navigation/search-results.tsx",
  keywords: ["search", "results", "find"],
  examples: [
    {
      id: "search",
      title: "Workspace search",
      ...screenExample,
      states: ["workspace", "subject", "empty"],
      render: (ctx) => (
        <Screen key={`${ctx.state}-${ctx.resetKey}`} ctx={ctx} />
      ),
    },
  ],
};
