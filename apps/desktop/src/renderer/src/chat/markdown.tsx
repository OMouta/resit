import { memo, useEffect, useState } from "react";
import ReactMarkdown, {
  defaultUrlTransform,
  type Components,
} from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

import { api } from "../lib/api";

/** Images resit saved from Moodle course text. See `mediaSaver`. */
const MEDIA_SCHEME = "resit-media:";
const MEDIA_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
};

function SavedImage({ name, alt }: { name: string; alt: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    api.readMoodleMedia(name).then(
      (bytes) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(
          new Blob([bytes as Uint8Array<ArrayBuffer>], {
            type:
              MEDIA_TYPES[name.split(".").at(-1) ?? ""] ??
              "application/octet-stream",
          }),
        );
        setUrl(objectUrl);
      },
      () => undefined,
    );
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [name]);
  return url ? (
    <img src={url} alt={alt} className="my-2 max-w-full rounded-md" />
  ) : (
    <span className="text-muted-foreground">[{alt || "image"}]</span>
  );
}

/** Web and mail links as usual, and resit's saved images. */
function urlTransform(url: string): string {
  return url.startsWith(MEDIA_SCHEME) ? url : defaultUrlTransform(url);
}

const components: Components = {
  a: ({ href, children }) => (
    <a
      href={href}
      onClick={(event) => {
        event.preventDefault();
        if (href) void api.openExternal(href).catch(() => undefined);
      }}
    >
      {children}
    </a>
  ),
  // Remote images are never fetched; images from Moodle are saved copies.
  img: ({ alt, src }) =>
    typeof src === "string" && src.startsWith(MEDIA_SCHEME) ? (
      <SavedImage name={src.slice(MEDIA_SCHEME.length)} alt={alt ?? ""} />
    ) : (
      <span className="text-muted-foreground">[{alt || "image"}]</span>
    ),
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto">
      <table className="w-full border-collapse text-sm [&_td]:border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:bg-muted [&_th]:px-2 [&_th]:py-1 [&_th]:text-left">
        {children}
      </table>
    </div>
  ),
};

/** Assistant replies: GitHub-flavoured Markdown with KaTeX math. Raw HTML is not rendered. */
export const ChatMarkdown = memo(function ChatMarkdown({
  text,
}: {
  text: string;
}) {
  return (
    <div className="chat-markdown">
      <ReactMarkdown
        remarkPlugins={[
          remarkGfm,
          [remarkMath, { singleDollarTextMath: true }],
        ]}
        rehypePlugins={[
          [rehypeKatex, { throwOnError: false, strict: "ignore" }],
        ]}
        components={components}
        urlTransform={urlTransform}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
});
