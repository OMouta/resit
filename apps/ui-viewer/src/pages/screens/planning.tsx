import { Button } from "@resit/ui/components/button";
import { ScrollArea } from "@resit/ui/components/scroll-area";
import { ChevronLeftIcon, ChevronRightIcon, SparklesIcon } from "lucide-react";

import { AgendaItem } from "@resit/ui/patterns/study/agenda-item";
import {
  AssessmentCard,
  CalendarActivityCard,
  WeekGrid,
} from "@resit/ui/patterns/study/calendar";

import { agenda, weekPlan } from "../../fixtures/study";
import { FIXTURE_NOW } from "../../fixtures/workspace";
import type { ExampleContext, ExamplePage } from "../../viewer/types";
import { ScreenFrame, screenExample } from "./shared";

const byDay = new Map<string, typeof agenda>();
for (const item of agenda) {
  const day = item.start.slice(0, 10);
  byDay.set(day, [...(byDay.get(day) ?? []), item]);
}

function Screen({ ctx }: { ctx: ExampleContext }) {
  const today = agenda.filter((item) => item.start.startsWith("2026-09-17"));
  const overdue = agenda.filter((item) => item.status === "overdue");
  return (
    <ScreenFrame
      ctx={ctx}
      title="Study plan — ISEP 2026/27"
      activeDestination="calendar"
    >
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-6 px-6 py-8">
          <header className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-[-0.02em]">
                This week
              </h1>
              <p className="text-sm text-muted-foreground">
                14–20 September · availability in green, sessions as cards.
                Missed sessions stay where they were until you accept a new
                time.
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                aria-label="Previous week"
                onClick={() => ctx.log("previousWeek")}
              >
                <ChevronLeftIcon />
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label="Next week"
                onClick={() => ctx.log("nextWeek")}
              >
                <ChevronRightIcon />
              </Button>
              <Button
                size="sm"
                className="ml-2"
                onClick={() => ctx.log("proposePlan")}
              >
                <SparklesIcon /> Propose a plan
              </Button>
            </div>
          </header>
          <div className="grid gap-3 @3xl:grid-cols-2">
            {weekPlan.assessments.map((assessment) => (
              <AssessmentCard
                key={assessment.id}
                {...assessment}
                now={FIXTURE_NOW}
                onOpen={() => ctx.log("openAssessment", assessment.id)}
              />
            ))}
          </div>
          <WeekGrid
            days={weekPlan.days}
            today="2026-09-17"
            availability={weekPlan.availability}
          >
            {(day) =>
              (byDay.get(day) ?? []).map((item) => (
                <CalendarActivityCard
                  key={item.id}
                  {...item}
                  onOpen={() => ctx.log("open", item.id)}
                />
              ))
            }
          </WeekGrid>
          <div className="grid gap-6 @3xl:grid-cols-2">
            <section className="flex flex-col gap-2">
              <h2 className="text-xs font-semibold tracking-[0.08em] text-subtle-foreground uppercase">
                Today · Wednesday
              </h2>
              {today.map((item) => (
                <AgendaItem
                  key={item.id}
                  {...item}
                  onStart={(id) => ctx.log("start", id)}
                  onContinue={(id) => ctx.log("continue", id)}
                  onComplete={(id) => ctx.log("complete", id)}
                />
              ))}
            </section>
            <section className="flex flex-col gap-2">
              <h2 className="text-xs font-semibold tracking-[0.08em] text-subtle-foreground uppercase">
                Needs a decision · {overdue.length}
              </h2>
              {overdue.map((item) => (
                <AgendaItem
                  key={item.id}
                  {...item}
                  onReschedule={(id) => ctx.log("reschedule", id)}
                  onComplete={(id) => ctx.log("complete", id)}
                />
              ))}
              {agenda
                .filter((item) => item.status === "suspended")
                .map((item) => (
                  <AgendaItem
                    key={item.id}
                    {...item}
                    onResume={(id) => ctx.log("resume", id)}
                  />
                ))}
            </section>
          </div>
        </div>
      </ScrollArea>
    </ScreenFrame>
  );
}

export const page: ExamplePage = {
  section: "screens",
  slug: "planning",
  title: "Weekly planning",
  description:
    "Assessments ahead, the week grid with availability and sessions, today's agenda, and the overdue items that need a decision.",
  source: "packages/ui/src/patterns/study/calendar.tsx",
  keywords: ["plan", "calendar", "week", "agenda", "assessment"],
  examples: [
    {
      id: "week",
      title: "Week view",
      ...screenExample,
      render: (ctx) => <Screen key={ctx.resetKey} ctx={ctx} />,
    },
  ],
};
