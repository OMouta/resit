import { ShieldAlertIcon, ShieldCheckIcon } from "lucide-react";
import { useId, useState } from "react";

import { Badge } from "@resit/ui/components/badge";
import { Button } from "@resit/ui/components/button";
import { Checkbox } from "@resit/ui/components/checkbox";
import { Label } from "@resit/ui/components/label";
import { useLocale } from "@resit/ui/hooks/use-locale";
import { cn } from "@resit/ui/lib/utils";

export type ApprovalStatus = "pending" | "approved" | "rejected" | "expired";

export interface ApprovalCardProps {
  title: string;
  description: string;
  /** Why this needs care, for example "Writes outside the note". */
  risk?: string;
  status: ApprovalStatus;
  onApprove?: (options: { always: boolean }) => void;
  onReject?: () => void;
  className?: string;
}

/** Permission request from the agent for a tool call or edit. */
export function ApprovalCard({
  title,
  description,
  risk,
  status,
  onApprove,
  onReject,
  className,
}: ApprovalCardProps) {
  const { t } = useLocale();
  const [always, setAlways] = useState(false);
  const id = useId();
  const Icon = risk ? ShieldAlertIcon : ShieldCheckIcon;
  return (
    <section
      data-slot="approval-card"
      aria-label={title}
      className={cn(
        "flex flex-col gap-2 rounded-lg border p-3",
        status === "pending" && "border-warning/40 bg-warning-soft/40",
        status === "expired" && "opacity-70",
        className,
      )}
    >
      <header className="flex items-start gap-2">
        <Icon
          className={cn(
            "mt-0.5 size-4 shrink-0",
            risk ? "text-warning" : "text-muted-foreground",
          )}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
          {risk ? <p className="mt-1 text-xs text-warning">{risk}</p> : null}
        </div>
        {status === "approved" ? (
          <Badge variant="success">{t("Approved")}</Badge>
        ) : null}
        {status === "rejected" ? (
          <Badge variant="muted">{t("Rejected")}</Badge>
        ) : null}
        {status === "expired" ? (
          <Badge variant="muted">{t("Expired")}</Badge>
        ) : null}
      </header>
      {status === "pending" ? (
        <footer className="flex flex-wrap items-center gap-3">
          <Button size="sm" onClick={() => onApprove?.({ always })}>
            {t("Approve")}
          </Button>
          <Button size="sm" variant="outline" onClick={onReject}>
            {t("Reject")}
          </Button>
          <span className="flex items-center gap-2">
            <Checkbox
              id={id}
              checked={always}
              onCheckedChange={(value) => setAlways(value === true)}
            />
            <Label
              htmlFor={id}
              className="text-xs font-normal text-muted-foreground"
            >
              {t("Always allow in this conversation")}
            </Label>
          </span>
        </footer>
      ) : null}
    </section>
  );
}
