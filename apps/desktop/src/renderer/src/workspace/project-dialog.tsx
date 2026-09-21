import { SearchIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@resit/ui/components/button";
import { Checkbox } from "@resit/ui/components/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@resit/ui/components/dialog";
import { Input } from "@resit/ui/components/input";
import { Label } from "@resit/ui/components/label";
import { subjectColorClasses } from "@resit/ui/lib/subject-color";
import { cn } from "@resit/ui/lib/utils";

import type {
  ProjectInfo,
  ResourceInfo,
  SubjectInfo,
} from "../../../shared/workspace";

export interface ProjectRequest {
  title: string;
  submitLabel: string;
  project?: ProjectInfo;
  onSubmit: (values: {
    title: string;
    subjectIds: string[];
    resourceIds: string[];
  }) => Promise<void>;
}

/** Lowercase without accents, so "analise" finds "Análise". */
function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** A project's name, and the subjects and files it takes in. */
export function ProjectDialog({
  request,
  subjects,
  resources,
  onClose,
}: {
  request: ProjectRequest | null;
  subjects: SubjectInfo[];
  resources: ResourceInfo[];
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [subjectIds, setSubjectIds] = useState<string[]>([]);
  const [resourceIds, setResourceIds] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!request) return;
    setTitle(request.project?.title ?? "");
    setSubjectIds(request.project?.subjectIds ?? []);
    setResourceIds(request.project?.resourceIds ?? []);
    setFilter("");
  }, [request]);

  const names = useMemo(
    () => new Map(subjects.map((subject) => [subject.id, subject.name])),
    [subjects],
  );
  // A chosen subject brings all of its files, so they are not listed.
  const files = resources
    .filter((resource) => !subjectIds.includes(resource.subjectId))
    .filter((resource) =>
      fold(`${resource.title} ${names.get(resource.subjectId) ?? ""}`).includes(
        fold(filter.trim()),
      ),
    )
    .sort(
      (a, b) =>
        Number(resourceIds.includes(b.id)) - Number(resourceIds.includes(a.id)),
    );

  const toggle = (list: string[], id: string, on: boolean) =>
    on ? [...list, id] : list.filter((entry) => entry !== id);

  return (
    <Dialog open={request !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        {request ? (
          <form
            className="flex min-w-0 flex-col gap-4"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!title.trim()) return;
              setBusy(true);
              try {
                await request.onSubmit({
                  title: title.trim(),
                  subjectIds,
                  // Files of a subject chosen later are covered by it.
                  resourceIds: resourceIds.filter((id) => {
                    const resource = resources.find((entry) => entry.id === id);
                    return (
                      resource !== undefined &&
                      !subjectIds.includes(resource.subjectId)
                    );
                  }),
                });
                onClose();
              } finally {
                setBusy(false);
              }
            }}
          >
            <DialogHeader>
              <DialogTitle>{request.title}</DialogTitle>
              <DialogDescription>
                A project gathers subjects and files for work that spans them.
                Nothing is copied.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="project-title">Name</Label>
              <Input
                id="project-title"
                autoFocus
                value={title}
                placeholder="Numerical simulation"
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-medium">Subjects</legend>
              {subjects.map((subject) => (
                <div key={subject.id} className="flex items-center gap-2.5">
                  <Checkbox
                    id={`project-subject-${subject.id}`}
                    checked={subjectIds.includes(subject.id)}
                    onCheckedChange={(checked) =>
                      setSubjectIds((current) =>
                        toggle(current, subject.id, checked === true),
                      )
                    }
                  />
                  <Label
                    htmlFor={`project-subject-${subject.id}`}
                    className="flex items-center gap-2 font-normal"
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "size-2 rounded-full",
                        subjectColorClasses[subject.color].dot,
                      )}
                    />
                    {subject.name}
                  </Label>
                </div>
              ))}
            </fieldset>
            <div className="flex min-w-0 flex-col gap-2">
              <span className="text-sm font-medium">
                Files from other subjects
              </span>
              <div className="relative">
                <SearchIcon
                  aria-hidden
                  className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-subtle-foreground"
                />
                <Input
                  aria-label="Find a file"
                  value={filter}
                  placeholder="Find a file"
                  className="pl-8"
                  onChange={(event) => setFilter(event.target.value)}
                />
              </div>
              <div className="scrollbar-thin flex max-h-52 min-w-0 flex-col gap-0.5 overflow-y-auto rounded-md border p-1">
                {files.length === 0 ? (
                  <p className="px-2 py-3 text-sm text-muted-foreground">
                    {filter.trim()
                      ? "No file matches."
                      : "Every file is in a chosen subject."}
                  </p>
                ) : null}
                {files.map((resource) => (
                  <label
                    key={resource.id}
                    className="flex min-w-0 items-center gap-2.5 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                  >
                    <Checkbox
                      checked={resourceIds.includes(resource.id)}
                      onCheckedChange={(checked) =>
                        setResourceIds((current) =>
                          toggle(current, resource.id, checked === true),
                        )
                      }
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {resource.title}
                    </span>
                    <span className="shrink-0 text-xs text-subtle-foreground">
                      {names.get(resource.subjectId) ?? ""}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy || !title.trim()}>
                {request.submitLabel}
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
