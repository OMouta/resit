import { memo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

import { api } from "../lib/api";

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
  // Remote images are never fetched.
  img: ({ alt }) => (
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
      >
        {text}
      </ReactMarkdown>
    </div>
  );
});
