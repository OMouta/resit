import { Button } from "@resit/ui/components/button";
import { ScrollArea } from "@resit/ui/components/scroll-area";
import { ChevronLeftIcon, ChevronRightIcon, SparklesIcon } from "lucide-react";

import { AgendaItem } from "@resit/ui/patterns/study/agenda-item";
import { subjectColorClasses } from "@resit/ui/lib/subject-color";
import { cn } from "@resit/ui/lib/utils";
import {
  AssessmentCard,
  TimeGrid,
  TimeGridCard,
} from "@resit/ui/patterns/study/calendar";

import { agenda, weekBlocks, weekPlan } from "../../fixtures/study";
import { FIXTURE_NOW } from "../../fixtures/workspace";
import type { ExampleContext, ExamplePage } from "../../viewer/types";
import { ScreenFrame, screenExample } from "./shared";

function Screen({ ctx }: { ctx: ExampleContext }) {
  const today = agenda.filter((item) => item.start.startsWith("2026-09-17"));
  const overdue = agenda.filter((item) => item.status === "overdue");
  return (
    <ScreenFrame
      ctx={ctx}
      title="Study plan — Studies 2026/27"
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
                14–20 September · study times in green. Draw on the week to add
                a session, drag one to move it.
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
          <TimeGrid
            days={weekPlan.days}
            today="2026-09-17"
            fromHour={8}
            toHour={22}
            bands={weekPlan.availability.map((slot) => ({
              day: slot.day,
              start: slot.from,
              end: slot.to,
            }))}
            createLabel="New session"
            onCreate={(range) => ctx.log("create", range)}
            onChange={(id, range) => ctx.log("move", { id, ...range })}
            blocks={weekBlocks.map((item) => ({
              id: item.id,
              day: item.day,
              start: item.from,
              end: item.to,
              label: `${item.title}, ${item.subjectName}`,
              editable: item.status === "scheduled",
              onOpen: () => ctx.log("open", item.id),
              className: cn(
                "border-l-[3px] bg-control shadow-control hover:bg-control-hover",
                subjectColorClasses[item.subjectColor].border,
                item.status === "completed" && "opacity-60",
              ),
              children: (
                <TimeGridCard
                  kind={item.kind}
                  start={`${item.day}T${item.from}:00`}
                  end={`${item.day}T${item.to}:00`}
                  title={item.title}
                  struck={item.status === "completed"}
                />
              ),
            }))}
          />
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
