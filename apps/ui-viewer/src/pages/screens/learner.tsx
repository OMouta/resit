import { Button } from "@resit/ui/components/button";
import { ScrollArea } from "@resit/ui/components/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@resit/ui/components/tabs";
import { DownloadIcon } from "lucide-react";
import { useState } from "react";

import { EvidenceRow } from "@resit/ui/patterns/study/evidence-row";
import {
  ConceptLevelRow,
  ProfileProposal,
} from "@resit/ui/patterns/study/profile-proposal";

import {
  evidence,
  learnerProfile,
  profileProposals,
} from "../../fixtures/study";
import { FIXTURE_NOW } from "../../fixtures/workspace";
import type { ExampleContext, ExamplePage } from "../../viewer/types";
import { ScreenFrame, screenExample } from "./shared";

function Screen({ ctx }: { ctx: ExampleContext }) {
  const [subject, setSubject] = useState("all");
  const proposals = profileProposals.filter(
    (proposal) => proposal.status === "proposed",
  );
  const concepts = learnerProfile.concepts.filter(
    (concept) => subject === "all" || concept.subjectName === subject,
  );
  return (
    <ScreenFrame
      ctx={ctx}
      title="Learner profile — ISEP 2026/27"
      activeDestination="profile"
    >
      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-8">
          <header className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-[-0.02em]">
                Learner profile
              </h1>
              <p className="text-sm text-muted-foreground">
                What resit thinks you know, with the evidence behind it.
                Explanations in {learnerProfile.explanationLanguage}. You can
                correct, export, or delete any of it.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => ctx.log("export")}
            >
              <DownloadIcon /> Export
            </Button>
          </header>
          {proposals.length > 0 ? (
            <section className="flex flex-col gap-3">
              <h2 className="text-xs font-semibold tracking-[0.08em] text-subtle-foreground uppercase">
                Waiting for your review · {proposals.length}
              </h2>
              {proposals.map((proposal) => (
                <ProfileProposal
                  key={proposal.id}
                  {...proposal}
                  evidenceCount={proposal.evidenceIds.length}
                  now={FIXTURE_NOW}
                  onAccept={(id, level) => ctx.log("accept", { id, level })}
                  onReject={(id) => ctx.log("reject", id)}
                >
                  {evidence
                    .filter((entry) => proposal.evidenceIds.includes(entry.id))
                    .map((entry) => (
                      <EvidenceRow
                        key={entry.id}
                        {...entry}
                        now={FIXTURE_NOW}
                      />
                    ))}
                </ProfileProposal>
              ))}
            </section>
          ) : null}
          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xs font-semibold tracking-[0.08em] text-subtle-foreground uppercase">
                Concepts · {concepts.length}
              </h2>
              <Tabs value={subject} onValueChange={setSubject}>
                <TabsList aria-label="Subject filter">
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="Mathematics">Mathematics</TabsTrigger>
                  <TabsTrigger value="Programming">Programming</TabsTrigger>
                  <TabsTrigger value="Physics">Physics</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div className="rounded-lg border bg-background">
              {concepts.map((concept) => (
                <ConceptLevelRow
                  key={concept.id}
                  id={concept.id}
                  name={concept.name}
                  subjectName={concept.subjectName}
                  level={concept.level}
                  lastEvidenceAt={concept.lastEvidence}
                  now={FIXTURE_NOW}
                  onEdit={(id) => ctx.log("edit", id)}
                  onDelete={(id) => ctx.log("delete", id)}
                  className="rounded-none border-b last:border-b-0"
                />
              ))}
            </div>
          </section>
          <section className="flex flex-col gap-2">
            <h2 className="text-xs font-semibold tracking-[0.08em] text-subtle-foreground uppercase">
              Recent evidence
            </h2>
            <div className="rounded-lg border bg-background p-1">
              {evidence.map((entry) => (
                <EvidenceRow key={entry.id} {...entry} now={FIXTURE_NOW} />
              ))}
            </div>
          </section>
        </div>
      </ScrollArea>
    </ScreenFrame>
  );
}

export const page: ExamplePage = {
  section: "screens",
  slug: "learner",
  title: "Learner review",
  description:
    "Proposals waiting for review, the concept list with levels, and the evidence trail. Everything here can be corrected or removed by the student.",
  source: "packages/ui/src/patterns/study/profile-proposal.tsx",
  keywords: ["profile", "learner", "concepts", "evidence"],
  examples: [
    {
      id: "profile",
      title: "Profile with proposals",
      ...screenExample,
      render: (ctx) => <Screen key={ctx.resetKey} ctx={ctx} />,
    },
  ],
};
