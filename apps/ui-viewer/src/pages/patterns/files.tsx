import { Button } from "@resit/ui/components/button";
import { useEffect, useState } from "react";

import { AttachmentDetails } from "@resit/ui/patterns/files/attachment-details";
import { ConflictComparison } from "@resit/ui/patterns/files/conflict-comparison";
import {
  ErrorPanel,
  RecoveryBanner,
} from "@resit/ui/patterns/files/error-panel";
import {
  ExportOptions,
  type ExportStatus,
} from "@resit/ui/patterns/files/export-options";
import { HistoryList } from "@resit/ui/patterns/files/history-row";
import {
  ImportProgressPanel,
  type ImportJob,
} from "@resit/ui/patterns/files/import-progress";
import {
  SaveStatus,
  SaveStatusLine,
  type SaveState,
} from "@resit/ui/patterns/files/save-status";
import { TrashList } from "@resit/ui/patterns/files/trash-row";
import { UnsavedChangesDialog } from "@resit/ui/patterns/files/unsaved-changes-dialog";

import {
  attachmentDetails,
  conflict,
  errorPanels,
  exportOptions,
  history,
  importJobs,
  saveStates,
  trash,
} from "../../fixtures/files";
import { FIXTURE_NOW } from "../../fixtures/workspace";
import type { ExampleContext, ExamplePage } from "../../viewer/types";

function ImportExample({ ctx }: { ctx: ExampleContext }) {
  const initial: ImportJob[] =
    ctx.state === "all-done"
      ? importJobs.map((job) => ({
          ...job,
          stage: "done",
          progress: 1,
          cancelable: false,
        }))
      : ctx.state === "empty"
        ? []
        : importJobs;
  const [jobs, setJobs] = useState<ImportJob[]>(initial);
  useEffect(() => {
    if (ctx.state !== "running") return;
    const timer = window.setInterval(() => {
      setJobs((previous) =>
        previous.map((job) => {
          if (
            job.stage !== "extracting" &&
            job.stage !== "copying" &&
            job.stage !== "indexing"
          )
            return job;
          const progress = Math.min(1, job.progress + 0.04);
          return progress >= 1
            ? { ...job, progress: 1, stage: "done", cancelable: false }
            : { ...job, progress };
        }),
      );
    }, 400);
    return () => window.clearInterval(timer);
  }, [ctx.state]);
  return (
    <ImportProgressPanel
      jobs={jobs}
      onCancel={(id) => {
        setJobs((previous) =>
          previous.map((job) =>
            job.id === id
              ? { ...job, stage: "cancelled", cancelable: false }
              : job,
          ),
        );
        ctx.log("onCancel", id);
      }}
      onCancelAll={() => ctx.log("onCancelAll")}
      onRetry={(id) => ctx.log("onRetry", id)}
      onRemove={(id) => {
        setJobs((previous) => previous.filter((job) => job.id !== id));
        ctx.log("onRemove", id);
      }}
    />
  );
}

function ExportExample({ ctx }: { ctx: ExampleContext }) {
  const [status, setStatus] = useState<ExportStatus>(
    ctx.state === "exporting"
      ? { kind: "exporting", progress: 0.35 }
      : ctx.state === "done"
        ? { kind: "done", path: "D:/Backups/ISEP 2026-27.resit" }
        : ctx.state === "failed"
          ? {
              kind: "failed",
              message:
                "Could not write to D:/Backups: the drive is not connected.",
            }
          : { kind: "idle" },
  );
  return (
    <ExportOptions
      {...exportOptions}
      status={status}
      defaultDestination="D:/Backups"
      onChooseDestination={() => ctx.log("onChooseDestination")}
      onExport={(options) => {
        ctx.log("onExport", options);
        setStatus({ kind: "exporting", progress: 0.1 });
        window.setTimeout(
          () =>
            setStatus({
              kind: "done",
              path: `${options.destination}/ISEP 2026-27.resit`,
            }),
          1200,
        );
      }}
      onCancel={() => {
        setStatus({ kind: "idle" });
        ctx.log("onCancel");
      }}
      onShowInFolder={(path) => ctx.log("onShowInFolder", path)}
    />
  );
}

function UnsavedExample({ ctx }: { ctx: ExampleContext }) {
  const [open, setOpen] = useState(true);
  const files =
    ctx.state === "multiple"
      ? [
          {
            id: "res_ws3_note",
            title: "Resolution — Worksheet 3",
            subjectName: "Mathematics",
          },
          {
            id: "res_prog_ptr",
            title: "Notes — pointers & memory",
            subjectName: "Programming",
          },
          {
            id: "res_phys_kin",
            title: "Kinematics — Δv and vector components",
            subjectName: "Physics",
          },
        ]
      : [
          {
            id: "res_ws3_note",
            title: "Resolution — Worksheet 3",
            subjectName: "Mathematics",
          },
        ];
  return (
    <div className="flex flex-col items-start gap-3">
      <Button variant="outline" onClick={() => setOpen(true)}>
        Close workspace
      </Button>
      <UnsavedChangesDialog
        open={open}
        onOpenChange={setOpen}
        files={files}
        onSave={(ids) => {
          setOpen(false);
          ctx.log("onSave", ids);
        }}
        onDiscard={() => {
          setOpen(false);
          ctx.log("onDiscard");
        }}
        onCancel={() => {
          setOpen(false);
          ctx.log("onCancel");
        }}
      />
    </div>
  );
}

const { resourceId: attachmentResourceId, ...attachmentProps } =
  attachmentDetails;
void attachmentResourceId;

const saveOrder: SaveState[] = [
  "saved",
  "saving",
  "unsaved",
  "error",
  "read-only",
  "conflict",
];

export const page: ExamplePage = {
  section: "patterns",
  group: "Files",
  slug: "files",
  title: "Files and recovery",
  description:
    "Imports, save state, conflicts, history, trash, export, and actionable errors. Unsaved work always looks different from saved work.",
  source: "packages/ui/src/patterns/files/save-status.tsx",
  keywords: [
    "import",
    "save",
    "conflict",
    "history",
    "trash",
    "export",
    "error",
    "recovery",
  ],
  examples: [
    {
      id: "save-status",
      title: "Save status",
      description: "Compact toolbar indicator and the full-width footer line.",
      width: "full",
      render: (ctx) => (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {saveOrder.map((state) => (
              <SaveStatus
                key={state}
                state={state}
                detail={saveStates[state].detail}
                onAction={(next) => ctx.log("onAction", next)}
              />
            ))}
          </div>
          <div className="overflow-hidden rounded-lg border">
            <div className="flex h-10 items-center gap-2 border-b px-3 text-sm">
              <span className="font-medium">Resolution — Worksheet 3</span>
              <span className="ml-auto">
                <SaveStatus
                  state="unsaved"
                  detail={saveStates.unsaved.detail}
                />
              </span>
            </div>
            <div className="h-16 bg-background" />
            {saveOrder.map((state) => (
              <SaveStatusLine
                key={state}
                state={state}
                detail={saveStates[state].detail}
                onAction={(next) => ctx.log("onAction", next)}
              />
            ))}
          </div>
        </div>
      ),
    },
    {
      id: "import",
      title: "Import progress",
      width: 560,
      states: ["running", "all-done", "empty"],
      render: (ctx) => (
        <ImportExample key={`${ctx.state}-${ctx.resetKey}`} ctx={ctx} />
      ),
    },
    {
      id: "attachment",
      title: "Attachment details",
      width: 560,
      render: (ctx) => (
        <AttachmentDetails
          {...attachmentProps}
          onOpen={() => ctx.log("onOpen")}
          onShowInFolder={() => ctx.log("onShowInFolder")}
          onReplaceSource={() => ctx.log("onReplaceSource")}
          onMoveToTrash={() => ctx.log("onMoveToTrash")}
          onOpenReference={(reference) =>
            ctx.log("onOpenReference", reference.title)
          }
          onCopy={(value) => ctx.log("onCopy", value.slice(0, 24))}
        />
      ),
    },
    {
      id: "conflict",
      title: "Conflict comparison",
      width: "full",
      states: ["side-by-side", "stacked"],
      render: (ctx) => (
        <ConflictComparison
          {...conflict}
          stacked={ctx.state === "stacked"}
          onKeepMine={() => ctx.log("onKeepMine")}
          onKeepTheirs={() => ctx.log("onKeepTheirs")}
          onKeepBoth={() => ctx.log("onKeepBoth")}
        />
      ),
    },
    {
      id: "history",
      title: "History",
      width: 620,
      states: ["default", "empty"],
      render: (ctx) => (
        <HistoryList
          revisions={ctx.state === "empty" ? [] : history}
          onPreview={(id) => ctx.log("onPreview", id)}
          onRestore={(id) => ctx.log("onRestore", id)}
        />
      ),
    },
    {
      id: "trash",
      title: "Trash",
      description:
        "Restore only, or with permanent deletion when the caller supports it.",
      width: 620,
      states: ["default", "restore-only", "empty"],
      render: (ctx) => (
        <TrashList
          items={ctx.state === "empty" ? [] : trash}
          now={FIXTURE_NOW}
          onRestore={(id) => ctx.log("onRestore", id)}
          {...(ctx.state === "restore-only"
            ? {}
            : {
                onDeletePermanently: (id: string) =>
                  ctx.log("onDeletePermanently", id),
                onEmpty: () => ctx.log("onEmpty"),
              })}
        />
      ),
    },
    {
      id: "export",
      title: "Export",
      width: 640,
      states: ["idle", "exporting", "done", "failed"],
      render: (ctx) => (
        <ExportExample key={`${ctx.state}-${ctx.resetKey}`} ctx={ctx} />
      ),
    },
    {
      id: "errors",
      title: "Actionable errors",
      width: 620,
      render: (ctx) => (
        <div className="flex flex-col gap-4">
          {Object.entries(errorPanels).map(([key, panel]) => (
            <ErrorPanel
              key={key}
              title={panel.title}
              detail={panel.detail}
              cause={panel.cause}
              tone={key === "disk-full" ? "error" : "warning"}
              actions={panel.actions.map((action) => ({
                ...action,
                onClick: () => ctx.log(key, action.label),
              }))}
            />
          ))}
        </div>
      ),
    },
    {
      id: "banners",
      title: "Recovery banners",
      width: "full",
      render: (ctx) => (
        <div className="-m-4 flex flex-col">
          <RecoveryBanner
            kind="read-only"
            message="This workspace is open in another resit window. You can read everything; edits will not be saved."
            action={{
              label: "Focus the other window",
              onClick: () => ctx.log("focus"),
            }}
          />
          <RecoveryBanner
            kind="recovered-draft"
            message="Recovered unsaved text from 16 Sep, 21:07. Review it and save, or discard."
            action={{
              label: "Discard draft",
              onClick: () => ctx.log("discard"),
            }}
            onDismiss={() => ctx.log("dismiss")}
          />
          <RecoveryBanner
            kind="future-format"
            message="Saved by a newer resit (format 3). Opened read-only."
            action={{
              label: "Check for updates",
              onClick: () => ctx.log("update"),
            }}
          />
          <RecoveryBanner
            kind="missing-source"
            message="Chapter 4 – Newton's laws of motion is missing from Physics/documents. Links to it stay in this note."
            action={{ label: "Locate file…", onClick: () => ctx.log("locate") }}
          />
        </div>
      ),
    },
    {
      id: "unsaved",
      title: "Unsaved changes dialog",
      width: "auto",
      states: ["single", "multiple"],
      render: (ctx) => (
        <UnsavedExample key={`${ctx.state}-${ctx.resetKey}`} ctx={ctx} />
      ),
    },
  ],
};
