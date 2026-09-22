const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(text: string): string {
  return text.replace(
    /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
    (match, code: string) => {
      if (!code.startsWith("#")) return ENTITIES[code.toLowerCase()] ?? match;
      const value =
        code[1]?.toLowerCase() === "x"
          ? Number.parseInt(code.slice(2), 16)
          : Number.parseInt(code.slice(1), 10);
      return value > 0 && value <= 0x10ffff
        ? String.fromCodePoint(value)
        : match;
    },
  );
}

/** An `<img>` as a Markdown image, when it has an absolute address. */
function imageMarkdown(tag: string): string {
  const src = decodeEntities(/\bsrc="([^"]*)"/i.exec(tag)?.[1] ?? "");
  if (!/^https?:\/\//i.test(src)) return "";
  const alt = decodeEntities(/\balt="([^"]*)"/i.exec(tag)?.[1] ?? "");
  // Encoded so the address stays one Markdown token.
  const address = src.replace(
    /[\s()<>]/g,
    (char) =>
      `%${char.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`,
  );
  return `![${alt.replace(/[[\]\n]/g, " ").trim()}](${address})`;
}

/**
 * Turns the HTML Moodle sends for a brief into Markdown the app and the
 * assistant can both read. Paragraphs, headings, lists, emphasis, links, and
 * images survive; anything else becomes its text. An image's address only
 * works with the student's token, so `mediaSaver` swaps in a saved copy.
 */
export function briefMarkdown(html: string): string {
  const markdown = html
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, "")
    .replace(/<img\b[^>]*>/gi, imageMarkdown)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi, "\n\n### $1\n\n")
    .replace(/<li\b[^>]*>/gi, "\n- ")
    .replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, "**$2**")
    .replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, "*$2*")
    .replace(/<a\b[^>]*\bhref="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)")
    .replace(/<\/t[dh]>/gi, " ")
    .replace(/<\/(p|div|ul|ol|table|tr|blockquote|pre)>/gi, "\n\n")
    .replace(/<[^>]*>/g, "");
  // Source indentation would otherwise turn lines into code blocks.
  return decodeEntities(markdown)
    .replace(/^[ \t]+|[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
