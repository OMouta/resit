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

/**
 * Turns the HTML Moodle sends for a brief into Markdown the app and the
 * assistant can both read. Paragraphs, headings, lists, emphasis, and links
 * survive; anything else becomes its text. Images are dropped: their
 * addresses only work with the student's token.
 */
export function briefMarkdown(html: string): string {
  const markdown = html
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, "")
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
