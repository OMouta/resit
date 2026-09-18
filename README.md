# resit

A local desktop study workspace built with Electron, React, and TypeScript.

## Development

Use Node.js 24.14.0 and pnpm 11.1.2. The Node version is recorded in `.node-version` and the package manager in `package.json`.

```sh
pnpm install --frozen-lockfile
pnpm dev:desktop
```

The desktop app starts on a screen to create or open a workspace. The browser viewer runs on its own with `pnpm dev:ui`.

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
| `pnpm test`          | Build the desktop app and run its tests with Vitest                    |

Tests launch Electron with a temporary profile, never the normal one. The end-to-end tests show their window off screen and without focus, and they replace the native file pickers, so they never take the mouse or keyboard. Linux requires a display server, such as Xvfb in CI.

## Using the app

A workspace is a folder you pick. resit writes plain files into it:

- `workspace.json` names the workspace.
- `subjects/<subject>/` holds `subject.json`, notes as Markdown with the note's ID in YAML frontmatter, and imported PDFs and images. Each imported file gets a `.resource.json` file beside it with its ID and hash.
- `conversations/<id>/` holds each chat as `conversation.json` and `events.jsonl`.
- `.resit/` holds the trash, the saved tabs, and the Claude session IDs for this computer.

Files added to a subject folder from outside resit show up in the sidebar, and edits made in another editor reload in open notes. If a note has unsaved changes when that happens, resit asks which version to keep.

The AI panel needs Claude Code installed and signed in. Run `claude` once in a terminal to sign in. resit starts that executable through the Claude Agent SDK and uses its sign-in. Claude's own file and shell tools are turned off. It reads notes and PDFs only through resit's study tools, and only from the subjects in the conversation's scope plus any files you add to it.

| Shortcut | Action                                                 |
| -------- | ------------------------------------------------------ |
| `Ctrl+K` | Find a file by title, or search the text of your files |
| `Ctrl+J` | Show or hide the AI panel                              |
| `Ctrl+N` | New note in the current subject                        |
| `Ctrl+\` | Split the editor into two panes                        |
| `Ctrl+W` | Close the tab                                          |

On macOS, use Cmd in place of Ctrl.

## Repository layout

- `apps/desktop`: Electron main process, sandboxed preload, React renderer, and background worker.
- `apps/ui-viewer`: Vite/React browser viewer for the design system, with fixtures and reference notes.
- `packages/ui`: `@resit/ui`, the shared design system: tokens, shadcn-based components, and study patterns.
- `tests/workspace`: workspace files, conversations, and search, tested against temporary folders.
- `tests/integration`: desktop startup and IPC boundary checks.
- `tests/e2e`: the main desktop flows, driven through the real window.
- `tests/tools`: Playwright helpers for screenshots (`shot.mjs`) and page evaluation (`eval.mjs`) against the running viewer, and `sample-pdf.mjs`, which writes a small text PDF.

The preload exposes one method per operation on `window.resit`, such as `readNote` or `sendMessage`. The main process checks that each call comes from the app's own window and validates its arguments before running it. The renderer gets no filesystem, process, or generic IPC access.

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
