import type { ExamplePage, RegisteredPage, Section } from "./types";

/**
 * Every module under src/pages that exports `page` becomes a route. Adding a
 * page is adding a file; nothing else needs registering.
 */
const modules = import.meta.glob<{ page?: ExamplePage }>("../pages/**/*.tsx", {
  eager: true,
});

const sectionOrder: Record<Section, number> = {
  foundations: 0,
  components: 1,
  patterns: 2,
  screens: 3,
};

export const pages: RegisteredPage[] = Object.entries(modules)
  .flatMap(([path, module]) => {
    if (!module.page) return [];
    const pagePath = path.replace(/^\.\.\//, "apps/ui-viewer/src/");
    return [{ ...module.page, pagePath }];
  })
  .sort((a, b) => {
    const bySection = sectionOrder[a.section] - sectionOrder[b.section];
    if (bySection !== 0) return bySection;
    const byGroup = (a.group ?? "").localeCompare(b.group ?? "");
    if (byGroup !== 0) return byGroup;
    return a.title.localeCompare(b.title);
  });

const duplicates = pages.filter(
  (page, index) =>
    pages.findIndex(
      (other) => other.section === page.section && other.slug === page.slug,
    ) !== index,
);
if (duplicates.length > 0) {
  throw new Error(
    `Duplicate viewer pages: ${duplicates.map((page) => `${page.section}/${page.slug}`).join(", ")}`,
  );
}

export function findPage(
  section: string | undefined,
  slug: string | undefined,
): RegisteredPage | undefined {
  return pages.find((page) => page.section === section && page.slug === slug);
}

export function pagesInSection(section: Section): RegisteredPage[] {
  return pages.filter((page) => page.section === section);
}

export function pagePath(page: ExamplePage, exampleId?: string): string {
  const base = `/${page.section}/${page.slug}`;
  return exampleId ? `${base}/${exampleId}` : base;
}
