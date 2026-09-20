import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@resit/ui/components/alert-dialog";
import { Button } from "@resit/ui/components/button";
import { TrashIcon } from "lucide-react";

import type { ExamplePage } from "../../viewer/types";

export const page: ExamplePage = {
  section: "components",
  slug: "alert-dialog",
  title: "Alert dialog",
  description:
    "Confirmation that interrupts. Clicking outside does not close it. Say what will happen and name the action on the button.",
  source: "packages/ui/src/components/alert-dialog.tsx",
  keywords: ["confirm", "destructive", "delete", "modal"],
  examples: [
    {
      id: "destructive",
      title: "Destructive",
      width: "auto",
      states: ["closed", "open"],
      render: ({ state, log, resetKey }) => (
        <AlertDialog
          key={`${state}-${resetKey}`}
          defaultOpen={state === "open"}
        >
          <AlertDialogTrigger asChild>
            <Button variant="destructive-outline">
              <TrashIcon />
              Delete subject
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Physics?</AlertDialogTitle>
              <AlertDialogDescription>
                4 notes and 2 PDFs move to the trash. You can restore them for
                30 days.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => log("cancel")}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => log("delete", "sub_phys")}
              >
                Delete subject
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ),
    },
    {
      id: "default-action",
      title: "Non-destructive",
      width: "auto",
      states: ["closed", "open"],
      render: ({ state, log, resetKey }) => (
        <AlertDialog
          key={`${state}-${resetKey}`}
          defaultOpen={state === "open"}
        >
          <AlertDialogTrigger asChild>
            <Button variant="outline">Close without saving</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Discard changes to “Worksheet 3”?
              </AlertDialogTitle>
              <AlertDialogDescription>
                You edited this note 2 minutes ago and it has not been saved.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => log("keep-editing")}>
                Keep editing
              </AlertDialogCancel>
              <AlertDialogAction onClick={() => log("discard")}>
                Discard
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ),
    },
    {
      id: "long-description",
      title: "Long description",
      width: "auto",
      states: ["closed", "open"],
      render: ({ state, resetKey }) => (
        <AlertDialog
          key={`${state}-${resetKey}`}
          defaultOpen={state === "open"}
        >
          <AlertDialogTrigger asChild>
            <Button variant="outline">Relink missing file</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Lecture 4 — Limits.pdf was not found
              </AlertDialogTitle>
              <AlertDialogDescription>
                It was last seen at D:/Studies 2026-27/Mathematics/Lecture 4 —
                Limits.pdf. If you moved or renamed it, pick the new location
                and your 23 highlights and 6 notes will attach to it again. If
                you deleted it, remove it from the workspace.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Remove from workspace</AlertDialogCancel>
              <AlertDialogAction>Pick file…</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ),
    },
  ],
};
