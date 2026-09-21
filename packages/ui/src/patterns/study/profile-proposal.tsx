import {
  ArrowRightIcon,
  CheckIcon,
  ChevronRightIcon,
  PencilIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { Badge } from "@resit/ui/components/badge";
import { Button } from "@resit/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@resit/ui/components/select";
import { useLocale } from "@resit/ui/hooks/use-locale";
import { cn } from "@resit/ui/lib/utils";
import {
  LevelChip,
  conceptLevelLabels,
  type ConceptLevel,
} from "@resit/ui/patterns/study/level-chip";

export interface ProfileProposalProps {
  id: string;
  conceptName: string;
  subjectName: string;
  change: string;
  from: ConceptLevel;
  to: ConceptLevel;
  evidenceCount: number;
  status: "proposed" | "accepted" | "rejected";
  proposedAt: string | Date;
  now?: Date | undefined;
  /** Evidence rows shown when expanded. */
  children?: ReactNode;
  onAccept?: (id: string, level: ConceptLevel) => void;
  onReject?: (id: string) => void;
  className?: string;
}

/** Proposed learner-profile change the student accepts, corrects, or rejects. */
export function ProfileProposal({
  id,
  conceptName,
  subjectName,
  change,
  from,
  to,
  evidenceCount,
  status,
  proposedAt,
  now,
  children,
  onAccept,
  onReject,
  className,
}: ProfileProposalProps) {
  const { relative } = useLocale();
  const [open, setOpen] = useState(false);
  const [correcting, setCorrecting] = useState(false);
  const [level, setLevel] = useState<ConceptLevel>(to);
  return (
    <section
      data-slot="profile-proposal"
      aria-label={`Proposal for ${conceptName}`}
      className={cn(
        "flex flex-col gap-3 rounded-lg border p-3",
        status === "proposed" && "border-primary/30 bg-info-soft/30",
        status === "rejected" && "opacity-70",
        className,
      )}
    >
      <header className="flex flex-wrap items-start gap-x-3 gap-y-1">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{conceptName}</p>
          <p className="text-xs text-muted-foreground">
            {subjectName} · proposed {relative(proposedAt, now)}
          </p>
        </div>
        {status === "accepted" ? (
          <Badge variant="success">Accepted</Badge>
        ) : null}
        {status === "rejected" ? <Badge variant="muted">Rejected</Badge> : null}
        {status === "proposed" ? <Badge variant="info">Proposed</Badge> : null}
      </header>
      <p className="text-sm">{change}</p>
      <div className="flex flex-wrap items-center gap-2">
        <LevelChip level={from} />
        <ArrowRightIcon
          className="size-3.5 text-subtle-foreground"
          aria-hidden
        />
        {correcting ? (
          <Select
            value={level}
            onValueChange={(value) => setLevel(value as ConceptLevel)}
          >
            <SelectTrigger aria-label="Corrected level" className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(conceptLevelLabels) as ConceptLevel[])
                .filter((entry) => entry !== "unknown")
                .map((entry) => (
                  <SelectItem key={entry} value={entry}>
                    {conceptLevelLabels[entry]}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        ) : (
          <LevelChip level={status === "accepted" ? level : to} />
        )}
        {children ? (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            {evidenceCount} {evidenceCount === 1 ? "piece" : "pieces"} of
            evidence
            <ChevronRightIcon
              className={cn(
                "size-3.5 transition-transform",
                open && "rotate-90",
              )}
            />
          </button>
        ) : null}
      </div>
      {open && children ? (
        <div className="rounded-md border bg-background">{children}</div>
      ) : null}
      {status === "proposed" ? (
        <footer className="flex flex-wrap gap-2">
          <Button onClick={() => onAccept?.(id, level)}>
            <CheckIcon />{" "}
            {correcting ? `Accept as ${conceptLevelLabels[level]}` : "Accept"}
          </Button>
          {!correcting ? (
            <Button variant="outline" onClick={() => setCorrecting(true)}>
              <PencilIcon /> Correct
            </Button>
          ) : (
            <Button
              variant="subtle"
              onClick={() => {
                setCorrecting(false);
                setLevel(to);
              }}
            >
              Cancel
            </Button>
          )}
          <Button
            variant="subtle"
            className="ml-auto"
            onClick={() => onReject?.(id)}
          >
            <XIcon /> Reject
          </Button>
        </footer>
      ) : null}
    </section>
  );
}

export interface ConceptLevelRowProps {
  id: string;
  name: string;
  subjectName: string;
  level: ConceptLevel;
  lastEvidenceAt?: string | Date | null;
  now?: Date | undefined;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  className?: string;
}

/** Row in the learner profile list. */
export function ConceptLevelRow({
  id,
  name,
  subjectName,
  level,
  lastEvidenceAt,
  now,
  onEdit,
  onDelete,
  className,
}: ConceptLevelRowProps) {
  const { relative } = useLocale();
  return (
    <div
      className={cn(
        "group/concept flex h-12 items-center gap-3 rounded-lg px-2.5 hover:bg-accent",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {subjectName}
          {lastEvidenceAt
            ? ` · last evidence ${relative(lastEvidenceAt, now)}`
            : " · no evidence yet"}
        </p>
      </div>
      <LevelChip level={level} />
      <span className="hidden items-center group-hover/concept:flex group-focus-within/concept:flex">
        {onEdit ? (
          <Button
            variant="subtle"
            size="icon-sm"
            aria-label={`Edit ${name}`}
            onClick={() => onEdit(id)}
          >
            <PencilIcon />
          </Button>
        ) : null}
        {onDelete ? (
          <Button
            variant="subtle"
            size="icon-sm"
            aria-label={`Delete ${name}`}
            onClick={() => onDelete(id)}
          >
            <Trash2Icon />
          </Button>
        ) : null}
      </span>
    </div>
  );
}
