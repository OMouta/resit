import {
  CheckIcon,
  FileTextIcon,
  HistoryIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@resit/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@resit/ui/components/dropdown-menu";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@resit/ui/components/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@resit/ui/components/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@resit/ui/components/tooltip";
import { useLocale } from "@resit/ui/hooks/use-locale";
import { subjectColorClasses } from "@resit/ui/lib/subject-color";
import { cn } from "@resit/ui/lib/utils";
import { AiPanel } from "@resit/ui/patterns/ai/ai-panel";
import {
  ScopeChip,
  ScopeMismatchNotice,
} from "@resit/ui/patterns/ai/scope-chips";
import type { PanelStatus } from "@resit/ui/patterns/ai/turn-status";
import type {
  ProviderStatus,
  ScopeItem,
  Turn,
} from "@resit/ui/patterns/ai/types";

import type {
  ChatMessage,
  ConversationDetail,
  ConversationMeta,
  ConversationScope,
  ModelOption,
  ProviderId,
  ProviderState,
  ToolSummary,
  TurnContext,
} from "../../../shared/conversations";
import type { AppSettings, SettingsPatch } from "../../../shared/settings";
import type { ResourceInfo, SubjectInfo } from "../../../shared/workspace";
import { api, errorMessage } from "../lib/api";
import { insertIntoNote } from "../lib/citations";
import { useNotices } from "../lib/notices";
import {
  flushAllViews,
  onAskRequest,
  viewFor,
  type AskRequest,
} from "../views/view-registry";
import { activeTab, type Layout } from "../workspace/layout";
import { ChatMarkdown } from "./markdown";

interface Streaming {
  turnId: string;
  text: string;
  tools: ToolSummary[];
  phase: "thinking" | "writing" | "tools";
}

export interface ChatPanelProps {
  layout: Layout;
  resources: ReadonlyMap<string, ResourceInfo>;
  subjects: ReadonlyMap<string, SubjectInfo>;
  providers: Record<ProviderId, ProviderState>;
  /** Checks a provider that has not been looked at yet. */
  onCheckProvider: (provider: ProviderId) => void;
  settings: AppSettings;
  onSettingsChange: (patch: SettingsPatch) => void;
  setConversation: (conversationId: string | null) => void;
  onOpenSettings: () => void;
}

const PROVIDER_NAMES: Record<ProviderId, string> = {
  claude: "Claude Code",
  codex: "Codex",
};

const renderMarkdown = (text: string) => <ChatMarkdown text={text} />;

function providerBadge(state: ProviderState): ProviderStatus {
  switch (state.status) {
    case "ready":
      return "ready";
    case "checking":
      return "checking";
    case "not-authenticated":
      return "not-authenticated";
    default:
      return "not-installed";
  }
}

function toolCalls(tools: ToolSummary[]) {
  return tools.map((tool) => ({
    id: tool.id,
    name: tool.name.replace(/^mcp__study__/, ""),
    summary: tool.summary,
    status: tool.status,
  }));
}

function contextItems(context: TurnContext): ScopeItem[] {
  const items: ScopeItem[] = [];
  if (context.focused) {
    items.push({
      kind: "resource",
      id: context.focused.resourceId,
      label: context.focused.title,
      resourceKind: context.focused.kind,
    });
    if (context.focused.page)
      items.push({
        kind: "page",
        id: `${context.focused.resourceId}-page`,
        label: `Page ${context.focused.page}`,
        page: context.focused.page,
      });
  }
  if (context.annotation)
    items.push({
      kind: "annotation",
      id: context.annotation.id,
      label: `Highlight · p. ${context.annotation.page}`,
      page: context.annotation.page,
      text: context.annotation.text,
    });
  else if (context.selection)
    items.push({
      kind: "selection",
      id: "selection",
      label: "Selection",
      text:
        context.selection.length > 80
          ? `${context.selection.slice(0, 77)}…`
          : context.selection,
    });
  return items;
}

function toTurn(message: ChatMessage): Turn {
  if (message.role === "user")
    return {
      id: message.id,
      role: "user",
      text: message.text,
      attachments: contextItems(message.context),
      at: message.at,
    };
  return {
    id: message.id,
    role: "assistant",
    status:
      message.status === "completed"
        ? "complete"
        : message.status === "cancelled"
          ? "stopped"
          : "failed",
    text: message.text,
    tools: toolCalls(message.tools),
    ...(message.model ? { model: message.model } : {}),
    ...(message.error ? { error: { ...message.error, retryable: true } } : {}),
    at: message.at,
  };
}

function inScope(scope: ConversationScope, resource: ResourceInfo): boolean {
  return (
    scope.subjectIds.includes(resource.subjectId) ||
    scope.resourceIds.includes(resource.id)
  );
}

/** The AI panel for the open workspace: conversations with a provider. */
export function ChatPanel({
  layout,
  resources,
  subjects,
  providers,
  onCheckProvider,
  settings,
  onSettingsChange,
  setConversation,
  onOpenSettings,
}: ChatPanelProps) {
  const notices = useNotices();
  const { relative } = useLocale();
  const [conversations, setConversations] = useState<ConversationMeta[]>([]);
  const [current, setCurrent] = useState<ConversationDetail | null>(null);
  const [streaming, setStreaming] = useState<Streaming | null>(null);
  const [sending, setSending] = useState(false);
  const [preview, setPreview] = useState<TurnContext>({});
  const [pinned, setPinned] = useState<AskRequest | null>(null);
  const [skipSelection, setSkipSelection] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [models, setModels] = useState<Record<ProviderId, ModelOption[]>>({
    claude: [],
    codex: [],
  });

  const providerId: ProviderId = current?.meta.provider ?? settings.provider;
  const provider = providers[providerId];

  useEffect(() => {
    onCheckProvider(providerId);
  }, [providerId, onCheckProvider]);

  // Listing models starts the provider, so it happens once it is ready and
  // only once for each.
  const listed = useRef<Set<ProviderId>>(new Set());
  useEffect(() => {
    if (provider.status !== "ready" || listed.current.has(providerId)) return;
    listed.current.add(providerId);
    api.getModels(providerId).then(
      (list) => setModels((current) => ({ ...current, [providerId]: list })),
      () => listed.current.delete(providerId),
    );
  }, [providerId, provider.status]);

  const model = settings[providerId].model;
  const selectedModel =
    models[providerId].find((entry) => entry.id === model) ??
    models[providerId].find((entry) => entry.isDefault);
  const currentId = current?.meta.id ?? null;
  const currentIdRef = useRef(currentId);
  currentIdRef.current = currentId;

  const tab = activeTab(layout);
  const focused = tab ? resources.get(tab.resourceId) : undefined;
  const defaultScope = useCallback((): ConversationScope => {
    const subjectId =
      focused?.subjectId ??
      [...subjects.values()].find((subject) => !subject.archived)?.id;
    return { subjectIds: subjectId ? [subjectId] : [], resourceIds: [] };
  }, [focused, subjects]);

  const open = useCallback(
    async (id: string) => {
      try {
        const detail = await api.readConversation(id);
        currentIdRef.current = id;
        setCurrent(detail);
        setStreaming(null);
        setConversation(id);
      } catch (error) {
        notices.fail("The conversation could not be opened", error);
      }
    },
    [notices, setConversation],
  );

  // Once: load the list, then the conversation saved in the layout or the
  // latest one.
  const initial = useRef({ id: layout.conversationId, open, notices });
  useEffect(() => {
    let cancelled = false;
    const { id, open: openConversation, notices: report } = initial.current;
    void api.listConversations().then(
      (list) => {
        if (cancelled) return;
        setConversations(list);
        const target = list.find((entry) => entry.id === id) ?? list[0];
        if (target) void openConversation(target.id);
      },
      (error: unknown) =>
        report.fail("Conversations could not be loaded", error),
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const remember = useCallback((meta: ConversationMeta) => {
    setConversations((list) =>
      [meta, ...list.filter((entry) => entry.id !== meta.id)].sort((a, b) =>
        b.updatedAt.localeCompare(a.updatedAt),
      ),
    );
    setCurrent((detail) =>
      detail && detail.meta.id === meta.id ? { ...detail, meta } : detail,
    );
  }, []);

  useEffect(
    () =>
      api.onEvent((event) => {
        if (
          event.type !== "turn-started" &&
          event.type !== "turn-progress" &&
          event.type !== "turn-finished"
        )
          return;
        if (event.type !== "turn-progress") remember(event.meta);
        if (event.conversationId !== currentIdRef.current) return;
        if (event.type === "turn-started") {
          setCurrent((detail) =>
            detail
              ? { ...detail, messages: [...detail.messages, event.message] }
              : detail,
          );
          setStreaming({
            turnId: event.turnId,
            text: "",
            tools: [],
            phase: "thinking",
          });
        } else if (event.type === "turn-progress") {
          setStreaming({
            turnId: event.turnId,
            text: event.text,
            tools: event.tools,
            phase: event.phase,
          });
        } else {
          setCurrent((detail) =>
            detail
              ? { ...detail, messages: [...detail.messages, event.message] }
              : detail,
          );
          setStreaming(null);
        }
      }),
    [remember],
  );

  // What the next message will carry: the focused file and its selection.
  const refreshPreview = useCallback(() => {
    if (!focused) {
      setPreview({});
      return;
    }
    const view = viewFor(focused.id)?.context() ?? {};
    setPreview({
      focused: {
        resourceId: focused.id,
        title: focused.title,
        kind: focused.kind,
        ...(view.page ? { page: view.page } : {}),
        ...(view.pageCount ? { pageCount: view.pageCount } : {}),
      },
      ...(view.selection ? { selection: view.selection } : {}),
    });
  }, [focused]);

  // "Ask about this" from a PDF highlight attaches it to the next message.
  useEffect(
    () =>
      onAskRequest((request) => {
        setPinned(request);
        setSkipSelection(null);
        // The composer owns its field; put the cursor in it for the question.
        window.setTimeout(() => {
          window.document
            .querySelector<HTMLTextAreaElement>(
              '[data-slot="composer"] textarea',
            )
            ?.focus();
        }, 0);
      }),
    [],
  );

  useEffect(() => {
    if (pinned && focused?.id !== pinned.resourceId) setPinned(null);
  }, [pinned, focused]);

  useEffect(() => {
    refreshPreview();
    let timer: number | undefined;
    const onChange = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(refreshPreview, 200);
    };
    document.addEventListener("selectionchange", onChange);
    const interval = window.setInterval(refreshPreview, 1500);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
      document.removeEventListener("selectionchange", onChange);
    };
  }, [refreshPreview]);

  const createConversation = useCallback(
    async (scope: ConversationScope, provider?: ProviderId) => {
      try {
        const meta = await api.createConversation(
          scope,
          provider ?? settings.provider,
        );
        remember(meta);
        // Turn events for it can arrive before the next render.
        currentIdRef.current = meta.id;
        setCurrent({ meta, messages: [] });
        setStreaming(null);
        setConversation(meta.id);
        return meta;
      } catch (error) {
        notices.fail("The conversation was not created", error);
        return null;
      }
    },
    [notices, remember, setConversation, settings.provider],
  );

  const updateScope = useCallback(
    async (scope: ConversationScope) => {
      if (!current) return;
      try {
        remember(await api.updateConversation({ id: current.meta.id, scope }));
      } catch (error) {
        notices.fail("The scope was not changed", error);
      }
    },
    [current, notices, remember],
  );

  const send = useCallback(
    async (text: string, context: TurnContext) => {
      setSending(true);
      try {
        const conversation =
          current?.meta ?? (await createConversation(defaultScope()));
        if (!conversation) return;
        await flushAllViews();
        await api.sendMessage({
          conversationId: conversation.id,
          text,
          context,
        });
        setPinned(null);
      } catch (error) {
        notices.fail("The message was not sent", error);
      } finally {
        setSending(false);
      }
    },
    [current, createConversation, defaultScope, notices],
  );

  const outgoingContext = (): TurnContext => {
    const context = { ...preview };
    // A pinned highlight is the question's subject, so it replaces whatever
    // happens to be selected and fixes the page it sits on.
    if (pinned && context.focused?.resourceId === pinned.resourceId) {
      delete context.selection;
      return {
        ...context,
        focused: { ...context.focused, page: pinned.annotation.page },
        annotation: pinned.annotation,
      };
    }
    if (context.selection && context.selection === skipSelection)
      delete context.selection;
    return context;
  };

  const scope = current?.meta.scope ?? defaultScope();
  const scopeItems: ScopeItem[] = [
    ...scope.subjectIds.flatMap((id): ScopeItem[] => {
      const subject = subjects.get(id);
      return subject
        ? [{ kind: "subject", id, label: subject.name, color: subject.color }]
        : [];
    }),
    ...scope.resourceIds.flatMap((id): ScopeItem[] => {
      const resource = resources.get(id);
      return resource
        ? [
            {
              kind: "resource",
              id,
              label: resource.title,
              resourceKind: resource.kind,
            },
          ]
        : [];
    }),
  ];

  const messages = current?.messages ?? [];
  const turns: Turn[] = messages.map(toTurn);
  if (streaming)
    turns.push({
      id: streaming.turnId,
      role: "assistant",
      status: "streaming",
      text: streaming.text,
      tools: toolCalls(streaming.tools),
      at: new Date().toISOString(),
    });
  const last = messages.at(-1);
  const busy = streaming !== null || sending;

  let status: PanelStatus = { kind: "idle" };
  if (provider.status !== "ready" && provider.status !== "checking")
    status = {
      kind: "missing-provider",
      providerName: PROVIDER_NAMES[providerId],
    };
  else if (streaming) status = { kind: "streaming", phase: streaming.phase };
  else if (last?.role === "assistant" && last.status === "failed")
    status = {
      kind: "failed",
      message: last.error?.title ?? "The last reply failed",
    };
  else if (last?.role === "assistant" && last.status === "cancelled")
    status = { kind: "stopped" };

  const lastUser = [...messages]
    .reverse()
    .find((message) => message.role === "user");

  const mismatch =
    current &&
    focused &&
    !inScope(current.meta.scope, focused) &&
    dismissed !== `${current.meta.id}:${focused.id}`
      ? focused
      : null;

  const insertReply = (text: string) => {
    const note = insertIntoNote(layout, resources, text);
    if (note)
      notices.notify({ tone: "success", title: `Added to ${note.title}` });
    else
      notices.notify({ tone: "info", title: "Open a note to add this reply" });
  };

  const unscopedSubjects = [...subjects.values()].filter(
    (subject) => !subject.archived && !scope.subjectIds.includes(subject.id),
  );
  // Files already covered by a subject in scope do not need adding.
  const unscopedResources = [...resources.values()]
    .filter(
      (resource) =>
        !scope.subjectIds.includes(resource.subjectId) &&
        !scope.resourceIds.includes(resource.id),
    )
    .slice(0, 100);

  /**
   * A conversation stays with the provider that started it: its saved
   * thread belongs to that one. Choosing another opens a new conversation
   * with the same scope.
   */
  const switchProvider = async (next: ProviderId) => {
    if (next === providerId) return;
    onCheckProvider(next);
    onSettingsChange({ provider: next });
    if (current) await createConversation(scope, next);
  };

  const composerItems = contextItems(outgoingContext());

  return (
    <AiPanel
      title={current?.meta.title ?? "New conversation"}
      provider={{
        providers: (["claude", "codex"] as const).map((id) => {
          const state = providers[id];
          return {
            id,
            name: PROVIDER_NAMES[id],
            status: providerBadge(state),
            ...("version" in state ? { version: state.version } : {}),
            models: models[id].map((entry) => ({
              id: entry.id,
              name: entry.name,
              description: entry.isDefault
                ? `${entry.description} · default`
                : entry.description,
            })),
          };
        }),
        providerId,
        ...(selectedModel ? { modelId: selectedModel.id } : {}),
        providerLocked: current !== null,
        onProviderChange: (id) => void switchProvider(id as ProviderId),
        onModelChange: (id) => {
          const chosen = models[providerId].find((entry) => entry.id === id);
          onSettingsChange({
            [providerId]: { model: chosen?.isDefault ? "" : id },
          });
        },
        onConnect: onOpenSettings,
      }}
      scope={{
        items: scopeItems,
        onRemove: (item) => {
          if (item.kind === "subject")
            void updateScope({
              ...scope,
              subjectIds: scope.subjectIds.filter((id) => id !== item.id),
            });
          else if (item.kind === "resource")
            void updateScope({
              ...scope,
              resourceIds: scope.resourceIds.filter((id) => id !== item.id),
            });
        },
        emptyLabel: `Add a subject or file so ${PROVIDER_NAMES[providerId]} can read it.`,
        add: (
          <Popover open={scopeOpen} onOpenChange={setScopeOpen}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button
                    variant="subtle"
                    size="icon-sm"
                    aria-label="Add a subject or file to this conversation"
                  >
                    <PlusIcon />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Add to this conversation</TooltipContent>
            </Tooltip>
            <PopoverContent align="start" className="w-80 p-0">
              <Command>
                <CommandInput placeholder="Add a subject or file…" />
                <CommandList>
                  <CommandEmpty>Nothing left to add.</CommandEmpty>
                  {unscopedSubjects.length > 0 ? (
                    <CommandGroup heading="Subjects">
                      {unscopedSubjects.map((subject) => (
                        <CommandItem
                          key={subject.id}
                          value={`subject ${subject.name}`}
                          onSelect={() => {
                            setScopeOpen(false);
                            void updateScope({
                              ...scope,
                              subjectIds: [...scope.subjectIds, subject.id],
                            });
                          }}
                        >
                          <span
                            aria-hidden
                            className={cn(
                              "size-2 rounded-full",
                              subjectColorClasses[subject.color].dot,
                            )}
                          />
                          {subject.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ) : null}
                  {unscopedResources.length > 0 ? (
                    <CommandGroup heading="Files">
                      {unscopedResources.map((resource) => (
                        <CommandItem
                          key={resource.id}
                          value={`file ${resource.title}`}
                          onSelect={() => {
                            setScopeOpen(false);
                            void updateScope({
                              ...scope,
                              resourceIds: [...scope.resourceIds, resource.id],
                            });
                          }}
                        >
                          <FileTextIcon className="text-subtle-foreground" />
                          <span className="truncate">{resource.title}</span>
                          <span className="ml-auto shrink-0 text-2xs text-subtle-foreground">
                            {subjects.get(resource.subjectId)?.name ?? ""}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ) : null}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        ),
      }}
      turns={turns}
      status={status}
      notice={
        mismatch ? (
          <ScopeMismatchNotice
            title={mismatch.title}
            subjectName={
              subjects.get(mismatch.subjectId)?.name ?? "its subject"
            }
            onAddToScope={() =>
              void updateScope({
                ...scope,
                resourceIds: [...scope.resourceIds, mismatch.id],
              })
            }
            onNewConversation={() =>
              void createConversation({
                subjectIds: [mismatch.subjectId],
                resourceIds: [],
              })
            }
            onDismiss={() =>
              setDismissed(`${current?.meta.id ?? ""}:${mismatch.id}`)
            }
          />
        ) : undefined
      }
      composer={{
        onSend: (text) => void send(text, outgoingContext()),
        onStop: () => {
          if (current) void api.stopTurn(current.meta.id);
        },
        busy,
        disabledReason:
          provider.status === "ready" || provider.status === "checking"
            ? undefined
            : `Connect ${PROVIDER_NAMES[providerId]} in Settings to ask questions`,
        placeholder: focused
          ? `Ask about ${focused.title}…`
          : "Ask about your notes or PDFs…",
        children:
          composerItems.length > 0 ? (
            <ul
              aria-label="Sent with your message"
              className="flex flex-wrap gap-1"
            >
              {composerItems.map((item) => (
                <li
                  key={`${item.kind}-${item.id}`}
                  className="min-w-0 max-w-full"
                >
                  <ScopeChip
                    item={item}
                    {...(item.kind === "selection"
                      ? {
                          onRemove: () =>
                            setSkipSelection(preview.selection ?? null),
                        }
                      : {})}
                  />
                </li>
              ))}
            </ul>
          ) : undefined,
      }}
      {...(lastUser && lastUser.role === "user" && !busy
        ? { onRetry: () => void send(lastUser.text, lastUser.context) }
        : {})}
      onInsert={insertReply}
      onCopy={(text) => {
        navigator.clipboard
          .writeText(text)
          .catch((error: unknown) => notices.fail("Copy failed", error));
      }}
      onNewConversation={() => void createConversation(defaultScope())}
      onConnect={onOpenSettings}
      renderText={renderMarkdown}
      emptyState={
        <div className="flex flex-col items-center gap-2 px-2 py-10 text-center">
          <p className="text-sm font-medium">Ask about your notes or PDFs</p>
          <p className="max-w-64 text-xs text-muted-foreground">
            {PROVIDER_NAMES[providerId]} reads the subjects and files listed
            above, and the file you have open. Ask it to write in a note or
            highlight a passage. Your messages and what it reads leave your
            computer.
          </p>
        </div>
      }
      headerActions={
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button variant="subtle" size="icon" aria-label="Conversations">
                  <HistoryIcon />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>Conversations</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>Conversations</DropdownMenuLabel>
            {conversations.length === 0 ? (
              <p className="px-2 py-1.5 text-xs text-subtle-foreground">
                None yet
              </p>
            ) : (
              conversations.slice(0, 30).map((meta) => {
                const subject = subjects.get(meta.scope.subjectIds[0] ?? "");
                return (
                  <DropdownMenuItem
                    key={meta.id}
                    onSelect={() => void open(meta.id)}
                    className="items-start"
                  >
                    <span className="flex size-4 shrink-0 items-center justify-center pt-0.5">
                      {meta.id === currentId ? <CheckIcon /> : null}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate">{meta.title}</span>
                      <span className="flex items-center gap-1 text-2xs text-subtle-foreground">
                        {subject ? (
                          <>
                            <span
                              aria-hidden
                              className={cn(
                                "size-1.5 rounded-full",
                                subjectColorClasses[subject.color].dot,
                              )}
                            />
                            {subject.name} ·{" "}
                          </>
                        ) : null}
                        {relative(meta.updatedAt)}
                      </span>
                    </span>
                  </DropdownMenuItem>
                );
              })
            )}
            {current ? (
              <>
                <DropdownMenuSeparator />
                {unscopedSubjects.length > 0 ? (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <PlusIcon /> Add a subject to the scope
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      {unscopedSubjects.map((subject) => (
                        <DropdownMenuItem
                          key={subject.id}
                          onSelect={() =>
                            void updateScope({
                              ...scope,
                              subjectIds: [...scope.subjectIds, subject.id],
                            })
                          }
                        >
                          <span
                            aria-hidden
                            className={cn(
                              "size-2 rounded-full",
                              subjectColorClasses[subject.color].dot,
                            )}
                          />
                          {subject.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                ) : null}
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => {
                    const id = current.meta.id;
                    void api.deleteConversation(id).then(
                      () => {
                        setConversations((list) =>
                          list.filter((entry) => entry.id !== id),
                        );
                        setCurrent(null);
                        setStreaming(null);
                        setConversation(null);
                      },
                      (error: unknown) =>
                        notices.fail(
                          "The conversation was not deleted",
                          errorMessage(error),
                        ),
                    );
                  }}
                >
                  <Trash2Icon /> Move this conversation to the trash
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      }
    />
  );
}
