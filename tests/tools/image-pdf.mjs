/**
 * Writes a PDF whose pages are pictures with no text layer, the way a
 * scanner makes them. Each page is one RGB image stretched over A4.
 */
import { deflateSync } from "node:zlib";

/** @param {{ width: number; height: number; rgb: Buffer }[]} pages */
export function imagePdf(pages) {
  /** @type {(string | Buffer)[]} */
  const objects = [];
  const add = (body) => {
    objects.push(body);
    return objects.length;
  };

  const catalog = add("");
  const pageTree = add("");
  const kids = [];
  for (const page of pages) {
    const pixels = deflateSync(page.rgb);
    const image = add(
      Buffer.concat([
        Buffer.from(
          `<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${pixels.length} >>\nstream\n`,
          "latin1",
        ),
        pixels,
        Buffer.from("\nendstream", "latin1"),
      ]),
    );
    const height = Math.round((595 * page.height) / page.width);
    const draw = `q 595 0 0 ${height} 0 ${842 - height} cm /Im1 Do Q`;
    const content = add(
      `<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`,
    );
    kids.push(
      add(
        `<< /Type /Page /Parent ${pageTree} 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im1 ${image} 0 R >> >> /Contents ${content} 0 R >>`,
      ),
    );
  }
  objects[catalog - 1] = `<< /Type /Catalog /Pages ${pageTree} 0 R >>`;
  objects[pageTree - 1] =
    `<< /Type /Pages /Kids [${kids.map((kid) => `${kid} 0 R`).join(" ")}] /Count ${kids.length} >>`;

  const chunks = [Buffer.from("%PDF-1.4\n", "latin1")];
  let length = chunks[0].length;
  const offsets = [];
  objects.forEach((body, index) => {
    offsets.push(length);
    const chunk = Buffer.concat([
      Buffer.from(`${index + 1} 0 obj\n`, "latin1"),
      typeof body === "string" ? Buffer.from(body, "latin1") : body,
      Buffer.from("\nendobj\n", "latin1"),
    ]);
    chunks.push(chunk);
    length += chunk.length;
  });
  let trailer = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets)
    trailer += `${String(offset).padStart(10, "0")} 00000 n \n`;
  trailer += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${length}\n%%EOF\n`;
  chunks.push(Buffer.from(trailer, "latin1"));
  return Buffer.concat(chunks);
}
