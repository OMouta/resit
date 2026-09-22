/**
 * Writes a small text PDF for manual checks and tests. Each page gets a
 * heading and a few lines of Helvetica text.
 *
 *   node tests/tools/sample-pdf.mjs out.pdf
 */
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/** With `outline`, each page also gets a bookmark with its title. */
export function samplePdf(pages, { outline = false } = {}) {
  const objects = [];
  const add = (body) => {
    objects.push(body);
    return objects.length;
  };
  const escape = (text) => text.replace(/[()\\]/g, (char) => `\\${char}`);

  const catalog = add("");
  const pageTree = add("");
  const font = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const kids = [];
  for (const page of pages) {
    const lines = [
      `BT /F1 20 Tf 72 760 Td (${escape(page.title)}) Tj ET`,
      ...page.lines.map(
        (line, index) =>
          `BT /F1 12 Tf 72 ${720 - index * 18} Td (${escape(line)}) Tj ET`,
      ),
    ].join("\n");
    const content = add(
      `<< /Length ${Buffer.byteLength(lines)} >>\nstream\n${lines}\nendstream`,
    );
    kids.push(
      add(
        `<< /Type /Page /Parent ${pageTree} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${content} 0 R >>`,
      ),
    );
  }
  let outlines = null;
  if (outline) {
    outlines = add("");
    const items = pages.map(() => add(""));
    pages.forEach((page, index) => {
      const links = [
        index > 0 ? `/Prev ${items[index - 1]} 0 R` : "",
        index < items.length - 1 ? `/Next ${items[index + 1]} 0 R` : "",
      ].join(" ");
      objects[items[index] - 1] =
        `<< /Title (${escape(page.title)}) /Parent ${outlines} 0 R ${links} /Dest [${kids[index]} 0 R /Fit] >>`;
    });
    objects[outlines - 1] =
      `<< /Type /Outlines /First ${items[0]} 0 R /Last ${items.at(-1)} 0 R /Count ${items.length} >>`;
  }
  objects[catalog - 1] =
    `<< /Type /Catalog /Pages ${pageTree} 0 R${outlines ? ` /Outlines ${outlines} 0 R` : ""} >>`;
  objects[pageTree - 1] =
    `<< /Type /Pages /Kids [${kids.map((kid) => `${kid} 0 R`).join(" ")}] /Count ${kids.length} >>`;

  let output = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(output));
    output += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(output);
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets)
    output += `${String(offset).padStart(10, "0")} 00000 n \n`;
  output += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(output, "latin1");
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  writeFileSync(
    process.argv[2],
    samplePdf([
      {
        title: "Worksheet 1: Limits",
        lines: [
          "1. Compute the limit of sin(x)/x as x approaches 0.",
          "2. Show that the limit of (1 + 1/n)^n is e.",
          "3. Decide whether f(x) = |x|/x has a limit at 0.",
        ],
      },
      {
        title: "Worksheet 1: Continuity",
        lines: [
          "4. Where is f(x) = 1/(x - 2) continuous?",
          "5. Use the intermediate value theorem on x^3 - x - 1.",
        ],
      },
    ]),
  );
}
