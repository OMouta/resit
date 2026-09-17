# resit

A local desktop study workspace built with Electron, React, and TypeScript.

## Development

Use Node.js 24.14.0 and pnpm 11.1.2. The Node version is recorded in `.node-version` and the package manager in `package.json`.

```sh
pnpm install --frozen-lockfile
pnpm dev:desktop
```

The desktop opens the onboarding screen from the shared UI package. The browser viewer runs independently with `pnpm dev:ui`.

| Command              | Purpose                                                                |
| -------------------- | ---------------------------------------------------------------------- |
| `pnpm dev:desktop`   | Start Electron and its local renderer server                           |
| `pnpm dev:ui`        | Start the UI viewer at `http://127.0.0.1:5174`                         |
| `pnpm build:desktop` | Build main, preload, renderer, and worker code into `apps/desktop/out` |
| `pnpm build:ui`      | Build the viewer into `apps/ui-viewer/dist`                            |
| `pnpm typecheck`     | Check all packages, build configurations, and tests                    |
| `pnpm lint`          | Run ESLint                                                             |
| `pnpm format:check`  | Check formatting                                                       |
| `pnpm format`        | Format source, configuration, tests, and this README                   |
| `pnpm test`          | Build the desktop app and run its integration tests with Vitest        |

Tests launch their own hidden Electron windows using an isolated temporary profile. They do not move the mouse, send global keyboard input, or open the normal app profile. Linux requires a display server, such as Xvfb in CI.

## Repository layout

- `apps/desktop`: Electron main process, sandboxed preload, React renderer, and background worker.
- `apps/ui-viewer`: Vite/React browser viewer for the design system, with fixtures and reference notes.
- `packages/ui`: `@resit/ui`, the shared design system: tokens, shadcn-based components, and study patterns.
- `tests/integration`: desktop startup and IPC boundary checks.
- `tests/tools`: Playwright helpers for screenshots (`shot.mjs`) and page evaluation (`eval.mjs`) against the running viewer.

The renderer receives only `window.resit.healthCheck()`. Filesystem, process, and generic IPC APIs are not exposed through the preload.

Examples, demo content, and sample data are written in English.

## Design system

`@resit/ui` is imported by both apps through package exports:

- `@resit/ui/styles/globals.css`: the only stylesheet. Tokens for light and dark themes, typography, spacing, radii, shadows, motion, and layers live here.
- `@resit/ui/components/<name>`: buttons, fields, menus, dialogs, tabs, and other controls.
- `@resit/ui/patterns/<family>/<name>`: resit-specific patterns grouped as `navigation`, `document`, `ai`, `study`, `files`, and `screens`.
- `@resit/ui/hooks/*` and `@resit/ui/lib/*`: locale formatting, reduced motion, roving focus, subject colours, shortcut labels.

The package has no Electron, filesystem, or provider imports. Components take typed props and callbacks; the desktop supplies real data and the viewer supplies fixtures.

## UI viewer

Run `pnpm dev:ui` and open `http://127.0.0.1:5174`. Changes to `packages/ui` hot-reload in the open page.

- Pages are files under `apps/ui-viewer/src/pages/<section>/` that export `page`. Adding a file adds a route; nothing else needs registering.
- Each example has a stable URL: `/patterns/ai-panel/panel?panel.state=streaming`. State and prop controls are written to the URL, so a link reproduces the exact variant. The copy button on an example copies that link.
- Theme, locale, width, and reduced motion are in the top bar and persist across navigation. Append `?theme=dark&locale=pt-PT&viewport=800` to a link to share a specific view.
- The event log (list icon, top right) shows callbacks fired by the open examples.
- Source links on every page open the component file and the page file in VS Code.
- Reference pictures go in `apps/ui-viewer/public/references` and are described in `apps/ui-viewer/src/references/manifest.ts`. An example with a `reference` id gets a compare view with side-by-side and overlay modes.

Screenshots for review:

```sh
node tests/tools/shot.mjs "http://127.0.0.1:5174/screens/workspace?theme=dark" out.png 1280 800 dark
```
