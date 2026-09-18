import {
  CheckIcon,
  ChevronDownIcon,
  KeyRoundIcon,
  Loader2Icon,
  PackageXIcon,
  SparklesIcon,
} from "lucide-react";

import { Badge } from "@resit/ui/components/badge";
import { Button } from "@resit/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@resit/ui/components/dropdown-menu";
import { cn } from "@resit/ui/lib/utils";
import type {
  ProviderOption,
  ProviderStatus,
} from "@resit/ui/patterns/ai/types";

const statusMeta: Record<
  ProviderStatus,
  {
    label: string;
    variant: "success" | "warning" | "muted" | "info";
    icon: typeof CheckIcon;
  }
> = {
  ready: { label: "Ready", variant: "success", icon: CheckIcon },
  "not-installed": {
    label: "Not installed",
    variant: "muted",
    icon: PackageXIcon,
  },
  "not-authenticated": {
    label: "Sign in needed",
    variant: "warning",
    icon: KeyRoundIcon,
  },
  checking: { label: "Checking…", variant: "info", icon: Loader2Icon },
};

export function ProviderStatusBadge({
  status,
  version,
}: {
  status: ProviderStatus;
  version?: string;
}) {
  const meta = statusMeta[status];
  const Icon = meta.icon;
  return (
    <Badge variant={meta.variant} className="gap-1">
      <Icon className={cn(status === "checking" && "animate-spin")} />
      {meta.label}
      {version && status === "ready" ? (
        <span className="opacity-70">{version}</span>
      ) : null}
    </Badge>
  );
}

export interface ProviderModelSelectProps {
  providers: ProviderOption[];
  providerId?: string | undefined;
  modelId?: string | undefined;
  onProviderChange: (providerId: string) => void;
  onModelChange: (modelId: string) => void;
  /** Install or sign-in action for providers that are not ready. */
  onConnect?: (providerId: string) => void;
  disabled?: boolean;
  /** A quiet trigger without status badge, for the composer. */
  compact?: boolean;
  className?: string;
}

/**
 * Provider and model pickers in one control. Providers that are not ready
 * stay listed with their status so the student knows what to do next.
 */
export function ProviderModelSelect({
  providers,
  providerId,
  modelId,
  onProviderChange,
  onModelChange,
  onConnect,
  disabled = false,
  compact = false,
  className,
}: ProviderModelSelectProps) {
  const provider = providers.find((entry) => entry.id === providerId);
  const model = provider?.models.find((entry) => entry.id === modelId);
  const usable = provider?.status === "ready";
  return (
    <div className={cn("flex min-w-0 items-center gap-1.5", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={compact ? "subtle" : "outline"}
            size="sm"
            disabled={disabled}
            className={cn(
              "max-w-full gap-1.5",
              compact && "h-8 rounded-control px-2 text-xs",
            )}
            aria-label="Provider and model"
          >
            <SparklesIcon
              className={cn(usable ? "text-primary" : "text-muted-foreground")}
            />
            <span className="truncate">
              {provider ? provider.name : "Choose a provider"}
              {model ? (
                <span className="text-muted-foreground"> · {model.name}</span>
              ) : null}
            </span>
            <ChevronDownIcon className="size-3.5 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72">
          <DropdownMenuLabel>Provider</DropdownMenuLabel>
          {providers.map((entry) => (
            <DropdownMenuItem
              key={entry.id}
              onSelect={() => onProviderChange(entry.id)}
              className="items-start gap-2 py-2"
            >
              <span className="flex size-4 items-center justify-center pt-0.5">
                {entry.id === providerId ? (
                  <CheckIcon className="size-4" />
                ) : null}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="font-medium">{entry.name}</span>
                <ProviderStatusBadge
                  status={entry.status}
                  {...(entry.version ? { version: entry.version } : {})}
                />
              </span>
            </DropdownMenuItem>
          ))}
          {provider && provider.models.length > 0 ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Model</DropdownMenuLabel>
              {provider.models.map((entry) => (
                <DropdownMenuItem
                  key={entry.id}
                  onSelect={() => onModelChange(entry.id)}
                >
                  <span className="flex size-4 items-center justify-center">
                    {entry.id === modelId ? (
                      <CheckIcon className="size-4" />
                    ) : null}
                  </span>
                  {entry.name}
                </DropdownMenuItem>
              ))}
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {provider && !usable && !compact ? (
        <>
          <ProviderStatusBadge status={provider.status} />
          {onConnect && provider.status !== "checking" ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onConnect(provider.id)}
            >
              {provider.status === "not-installed" ? "Install" : "Sign in"}
            </Button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
