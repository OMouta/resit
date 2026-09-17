import katex from "katex";
import { AlertCircleIcon } from "lucide-react";
import { Fragment, useMemo, type ReactNode } from "react";

import { cn } from "@resit/ui/lib/utils";

export type MathRender =
  { ok: true; html: string } | { ok: false; message: string };

/** Renders LaTeX to HTML. Errors are returned, never thrown, so the UI can show them. */
export function renderMath(source: string, displayMode = false): MathRender {
  try {
    return {
      ok: true,
      html: katex.renderToString(source, {
        displayMode,
        throwOnError: true,
        strict: "ignore",
        output: "htmlAndMathml",
      }),
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message.replace(/^KaTeX parse error: /, "")
        : "Could not render this expression";
    return { ok: false, message };
  }
}

function MathError({
  source,
  message,
  display,
}: {
  source: string;
  message: string;
  display: boolean;
}) {
  return (
    <span
      role="img"
      aria-label={`Math could not be rendered: ${message}`}
      title={message}
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-sm border border-dashed border-destructive/50 bg-danger-soft px-1 font-mono text-[0.85em] text-destructive",
        display && "my-2 flex w-fit px-2 py-1",
      )}
    >
      <AlertCircleIcon className="size-3 shrink-0" aria-hidden />
      <span className="truncate">{source}</span>
    </span>
  );
}

export function MathInline({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  const result = useMemo(() => renderMath(children, false), [children]);
  if (!result.ok)
    return (
      <MathError source={children} message={result.message} display={false} />
    );
  return (
    <span
      className={cn("math-inline", className)}
      dangerouslySetInnerHTML={{ __html: result.html }}
    />
  );
}

export function MathBlock({
  children,
  className,
  numbered,
}: {
  children: string;
  className?: string;
  /** Equation number shown at the right edge. */
  numbered?: string;
}) {
  const result = useMemo(() => renderMath(children, true), [children]);
  if (!result.ok)
    return (
      <div className={cn("flex flex-col gap-1", className)}>
        <MathError source={children} message={result.message} display />
        <p className="text-xs text-destructive">{result.message}</p>
      </div>
    );
  return (
    <div className={cn("relative", className)}>
      <div dangerouslySetInnerHTML={{ __html: result.html }} />
      {numbered ? (
        <span className="absolute top-1/2 right-0 -translate-y-1/2 text-sm text-muted-foreground">
          ({numbered})
        </span>
      ) : null}
    </div>
  );
}

/** Splits text into plain, inline-math, display-math, and inline-code segments. */
function segment(
  text: string,
): { kind: "text" | "inline" | "display" | "code"; value: string }[] {
  const out: { kind: "text" | "inline" | "display" | "code"; value: string }[] =
    [];
  const pattern = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$|`([^`\n]+)`/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last)
      out.push({ kind: "text", value: text.slice(last, index) });
    if (match[1] !== undefined)
      out.push({ kind: "display", value: match[1].trim() });
    else if (match[2] !== undefined)
      out.push({ kind: "inline", value: match[2] });
    else if (match[3] !== undefined)
      out.push({ kind: "code", value: match[3] });
    last = index + match[0].length;
  }
  if (last < text.length) out.push({ kind: "text", value: text.slice(last) });
  return out;
}

/**
 * Lightweight text renderer for fixtures and chat: paragraphs, `$…$`,
 * `$$…$$`, inline code, and single line breaks. Not a Markdown engine.
 */
export function MathText({
  children,
  className,
  paragraphClassName,
}: {
  children: string;
  className?: string;
  paragraphClassName?: string;
}) {
  const paragraphs = children.split(/\n{2,}/);
  return (
    <div className={className}>
      {paragraphs.map((paragraph, paragraphIndex) => {
        const parts = segment(paragraph);
        const onlyDisplay = parts.length === 1 && parts[0]?.kind === "display";
        const nodes: ReactNode[] = parts.map((part, index) => {
          switch (part.kind) {
            case "display":
              return <MathBlock key={index}>{part.value}</MathBlock>;
            case "inline":
              return <MathInline key={index}>{part.value}</MathInline>;
            case "code":
              return (
                <code
                  key={index}
                  className="rounded-xs bg-muted px-1 font-mono text-[0.875em]"
                >
                  {part.value}
                </code>
              );
            default:
              return part.value.split("\n").map((line, lineIndex, lines) => (
                <Fragment key={`${index}-${lineIndex}`}>
                  {line}
                  {lineIndex < lines.length - 1 ? <br /> : null}
                </Fragment>
              ));
          }
        });
        if (onlyDisplay)
          return <Fragment key={paragraphIndex}>{nodes}</Fragment>;
        return (
          <p key={paragraphIndex} className={paragraphClassName}>
            {nodes}
          </p>
        );
      })}
    </div>
  );
}
