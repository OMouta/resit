import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@resit/ui/components/command";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

import { pagePath, pages } from "./registry";
import { SECTIONS } from "./types";

/** Cmd/Ctrl+K search across pages and examples. */
export function ViewerSearch({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  const go = (path: string) => {
    navigate(path);
    onOpenChange(false);
    setQuery("");
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search the viewer"
      description="Jump to a page or example"
    >
      <CommandInput
        placeholder="Search pages and examples…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No matches.</CommandEmpty>
        {SECTIONS.map((section) => {
          const sectionPages = pages.filter((page) => page.section === section);
          if (sectionPages.length === 0) return null;
          return (
            <CommandGroup key={section} heading={section}>
              {sectionPages.map((page) => (
                <CommandItem
                  key={`${page.section}/${page.slug}`}
                  value={`${page.title} ${page.group ?? ""} ${page.keywords?.join(" ") ?? ""}`}
                  onSelect={() => go(pagePath(page))}
                >
                  <span>{page.title}</span>
                  {page.group ? (
                    <span className="text-xs text-muted-foreground">
                      {page.group}
                    </span>
                  ) : null}
                </CommandItem>
              ))}
              {query.length >= 2
                ? sectionPages.flatMap((page) =>
                    page.examples.map((example) => (
                      <CommandItem
                        key={`${page.slug}/${example.id}`}
                        value={`${page.title} ${example.title} ${example.id}`}
                        onSelect={() => go(pagePath(page, example.id))}
                      >
                        <span className="text-muted-foreground">
                          {page.title} ›
                        </span>
                        <span>{example.title}</span>
                      </CommandItem>
                    )),
                  )
                : null}
            </CommandGroup>
          );
        })}
      </CommandList>
    </CommandDialog>
  );
}
