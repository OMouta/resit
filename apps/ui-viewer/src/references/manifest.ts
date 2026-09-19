/**
 * Reference images live in apps/ui-viewer/public/references. Each entry needs
 * a source and permission note. Examples opt in to comparison by setting
 * `reference` to an id from this list.
 */
export interface ReferenceImage {
  id: string;
  title: string;
  /** Path under /references/, served by the viewer. */
  file: string;
  source: string;
  permission: string;
  /** What to adopt from this picture. */
  adopt: string[];
  /** What to avoid copying. */
  avoid: string[];
  /** Product areas the picture informs. */
  areas: (
    | "density"
    | "typography"
    | "navigation"
    | "editor"
    | "pdf"
    | "chat"
    | "colour"
  )[];
}

export const references: ReferenceImage[] = [];

/** Directions given in words. Kept beside the images so notes and pictures stay together. */
export const directionNotes = {
  summary:
    "Combine Apple desktop UI structure with Notion's colours in both themes, under resit's own brand: jade for the primary action and the r. mark. No approved reference pictures have been supplied yet; the written direction below is the current input, and the picture set stays an open input dependency.",
  sources: [
    {
      name: "Apple desktop UI (macOS system apps: Notes, Finder, Settings)",
      informs: ["density", "typography", "navigation", "editor"],
      adopt: [
        "Translucent-feeling sidebar with quiet hairline borders instead of heavy dividers.",
        "Compact 28px rows in lists and trees; 36px toolbars; segmented controls for view switching.",
        "Soft layered shadows on popovers and sheets; 6–12px radii scaled to control size.",
        "Short ease-out motion (120–180ms) and no decorative animation.",
        "Bold system-style headings with tight tracking; body copy at 13–14px in the interface.",
      ],
      avoid: [
        "Frosted glass everywhere. Use translucency only where a surface sits over content.",
        "Traffic-light window controls and title-bar treatments; Electron draws the frame.",
        "Rounded-corner overload on content blocks; document content stays square.",
      ],
    },
    {
      name: "Notion (page and sidebar colours in both themes, tag palette)",
      informs: ["colour", "editor", "navigation"],
      adopt: [
        "Paper white pages with #37352F ink and #787774 secondary text.",
        "Sidebar surface #F7F7F5 with hover fills at 6–8% ink alpha.",
        "Dark theme on soft greys, not black: #191919 pages, #202020 sidebar, #252525 popovers, #E3E2E0 text.",
        "The nine-colour tag palette (gray, brown, orange, yellow, green, blue, purple, pink, red) as the subject palette, always paired with a text label.",
        "Large bold page titles; the open page highlighted in the sidebar tree; tabs as rounded pills.",
        "Block-level content rhythm: generous vertical spacing, 44rem measure for reading.",
      ],
      avoid: [
        "Notion blue and the Notion logo. resit jade (#13795B) is the primary action, focus, link, and selection colour.",
        "Database-style tables and property rows as a general layout pattern.",
        "Emoji page icons as the primary identity for subjects.",
        "Very light gray text for anything the student must read.",
      ],
    },
    {
      name: "Vercel dashboard (Geist typography)",
      informs: ["typography", "chat"],
      adopt: [
        "Geist Sans for interface text and Geist Mono for code, paths, and tool output.",
        "Status colours kept saturated but small: dots, badges, and thin progress bars.",
        "Dark popovers are a lighter surface with a hairline, not a shadow.",
      ],
      avoid: [
        "Marketing gradients and glow effects.",
        "Full-width monospace layouts in the study views; monospace stays for code and diagnostics.",
        "Dashboard-card grids as the workspace home.",
      ],
    },
  ],
  openInputs: [
    "Reference pictures for the PDF reading treatment (toolbar, page controls, annotation overlays).",
    "Reference pictures for the AI panel density and citation styling.",
    "A decision on whether document text uses Geist or a serif for long reading.",
  ],
} as const;
