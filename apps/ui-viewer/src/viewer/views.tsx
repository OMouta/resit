import { Button } from "@resit/ui/components/button";
import { EmptyState } from "@resit/ui/components/empty-state";
import { ArrowLeftIcon, ImageOffIcon } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router";

import { directionNotes, references } from "../references/manifest";
import { ReferenceCompare } from "./compare";
import { ExampleFrame, SourceLink } from "./example-frame";
import { findPage, pagePath, pagesInSection } from "./registry";
import { SECTIONS, type Section } from "./types";

export function HomeView() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-6 sm:p-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-[-0.02em]">resit UI</h1>
        <p className="mt-1 text-muted-foreground">
          Shared components, study patterns, and composed screens, rendered in
          the browser from the same package the desktop app imports.
        </p>
      </div>
      {SECTIONS.map((section) => {
        const list = pagesInSection(section);
        if (list.length === 0) return null;
        return (
          <section key={section} className="flex flex-col gap-2">
            <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {section}
            </h2>
            <ul className="grid grid-cols-2 gap-1 sm:grid-cols-3">
              {list.map((page) => (
                <li key={page.slug}>
                  <Link
                    to={`${pagePath(page)}`}
                    className="block rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                  >
                    {page.title}
                    {page.group ? (
                      <span className="block text-xs text-muted-foreground">
                        {page.group}
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

export function PageView() {
  const { section, slug } = useParams();
  const page = findPage(section, slug);
  if (!page) return <NotFound />;
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-6 sm:px-8 sm:py-8">
      <header className="flex flex-col gap-2 border-b pb-6">
        <p className="text-2xs font-semibold tracking-[0.08em] text-subtle-foreground uppercase">
          {page.section}
          {page.group ? ` · ${page.group}` : ""}
        </p>
        <h1 className="text-3xl font-semibold tracking-[-0.02em]">
          {page.title}
        </h1>
        {page.description ? (
          <p className="max-w-2xl text-base text-muted-foreground">
            {page.description}
          </p>
        ) : null}
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
          {page.source ? <SourceLink path={page.source} /> : null}
          <SourceLink path={page.pagePath} />
        </div>
      </header>
      <div className="flex flex-col gap-12">
        {page.examples.map((example) => (
          <ExampleFrame key={example.id} page={page} example={example} />
        ))}
      </div>
    </div>
  );
}

export function ExampleView() {
  const { section, slug, exampleId } = useParams();
  const [search] = useSearchParams();
  const page = findPage(section, slug);
  const example = page?.examples.find((entry) => entry.id === exampleId);
  if (!page || !example) return <NotFound />;
  const compareId = search.get("compare");
  const reference = compareId
    ? references.find((entry) => entry.id === compareId)
    : undefined;

  const back = new URLSearchParams(search);
  back.delete("compare");

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div className="flex items-center gap-2">
        <Button variant="subtle" size="sm" asChild>
          <Link
            to={`${pagePath(page)}${back.size ? `?${back.toString()}` : ""}#${example.id}`}
          >
            <ArrowLeftIcon />
            {page.title}
          </Link>
        </Button>
        {page.source ? <SourceLink path={page.source} /> : null}
      </div>
      {compareId && !reference ? (
        <EmptyState
          icon={<ImageOffIcon />}
          title="Reference not found"
          description={`No reference with id "${compareId}" is in the manifest.`}
        />
      ) : null}
      {reference ? (
        <ReferenceCompare reference={reference}>
          <ExampleFrame page={page} example={example} isolated />
        </ReferenceCompare>
      ) : (
        <ExampleFrame page={page} example={example} isolated />
      )}
    </div>
  );
}

export function ReferencesView() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 p-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">References</h1>
        <p className="mt-1 text-muted-foreground">{directionNotes.summary}</p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Pictures</h2>
        {references.length === 0 ? (
          <EmptyState
            icon={<ImageOffIcon />}
            title="No reference pictures yet"
            description="Add image files to apps/ui-viewer/public/references and describe them in the manifest."
            size="compact"
          />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {references.map((reference) => (
              <li
                key={reference.id}
                className="flex flex-col gap-2 rounded-lg border p-3"
              >
                <img
                  src={`/references/${reference.file}`}
                  alt={reference.title}
                  className="rounded-md border"
                />
                <p className="font-medium">{reference.title}</p>
                <p className="text-xs text-muted-foreground">
                  {reference.source} · {reference.permission}
                </p>
                <p className="text-xs text-muted-foreground">
                  Informs: {reference.areas.join(", ")}
                </p>
                <div className="text-sm">
                  <p className="font-medium text-success">Adopt</p>
                  <ul className="list-disc pl-4 text-muted-foreground">
                    {reference.adopt.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <p className="mt-2 font-medium text-destructive">Avoid</p>
                  <ul className="list-disc pl-4 text-muted-foreground">
                    {reference.avoid.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold tracking-tight">
          Direction notes
        </h2>
        {directionNotes.sources.map((source) => (
          <article key={source.name} className="rounded-lg border p-4">
            <h3 className="font-medium">{source.name}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Informs: {source.informs.join(", ")}
            </p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-success">Adopt</p>
                <ul className="mt-1 list-disc pl-4 text-sm text-muted-foreground">
                  {source.adopt.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-sm font-medium text-destructive">Avoid</p>
                <ul className="mt-1 list-disc pl-4 text-sm text-muted-foreground">
                  {source.avoid.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </article>
        ))}
      </section>

      <section>
        <h2 className="text-lg font-semibold tracking-tight">Open inputs</h2>
        <ul className="mt-2 list-disc pl-4 text-sm text-muted-foreground">
          {directionNotes.openInputs.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function SectionIndex({ section }: { section: Section }) {
  const list = pagesInSection(section);
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-8">
      <h1 className="text-2xl font-semibold tracking-tight capitalize">
        {section}
      </h1>
      {list.length === 0 ? (
        <EmptyState title="Nothing here yet" size="compact" />
      ) : (
        <ul className="grid grid-cols-2 gap-1 sm:grid-cols-3">
          {list.map((page) => (
            <li key={page.slug}>
              <Link
                to={`${pagePath(page)}`}
                className="block rounded-md px-2 py-1.5 text-sm hover:bg-accent"
              >
                {page.title}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function NotFound() {
  return (
    <EmptyState
      title="Page not found"
      description="Check the address or pick a page from the sidebar."
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link to="/">Home</Link>
        </Button>
      }
    />
  );
}
