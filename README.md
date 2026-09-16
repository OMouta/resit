# resit

A local desktop study workspace built with Electron, React, and TypeScript.

## Development

Use Node.js 24.14.0 and pnpm 11.1.2. The Node version is recorded in `.node-version` and the package manager in `package.json`.

```sh
pnpm install --frozen-lockfile
pnpm dev:desktop
```

The desktop currently opens an empty application window. The browser entry point is also empty; it runs independently with `pnpm dev:ui`.

| Command              | Purpose                                                                |
| -------------------- | ---------------------------------------------------------------------- |
| `pnpm dev:desktop`   | Start Electron and its local renderer server                           |
| `pnpm dev:ui`        | Start the browser app at `http://127.0.0.1:5174`                       |
| `pnpm build:desktop` | Build main, preload, renderer, and worker code into `apps/desktop/out` |
| `pnpm build:ui`      | Build the browser app into `apps/ui-viewer/dist`                       |
| `pnpm typecheck`     | Check all packages, build configurations, and tests                    |
| `pnpm lint`          | Run ESLint                                                             |
| `pnpm format:check`  | Check formatting                                                       |
| `pnpm format`        | Format source, configuration, tests, and this README                   |
| `pnpm test`          | Build the desktop app and run its integration tests with Vitest        |

Tests launch their own hidden Electron windows using an isolated temporary profile. They do not move the mouse, send global keyboard input, or open the normal app profile. Linux requires a display server, such as Xvfb in CI.

## Repository layout

- `apps/desktop`: Electron main process, sandboxed preload, React renderer, and background worker.
- `apps/ui-viewer`: independent Vite/React browser app.
- `packages/ui`: shared UI package boundary, imported by both apps.
- `tests/integration`: desktop startup and IPC boundary checks.

The renderer receives only `window.resit.healthCheck()`. Filesystem, process, and generic IPC APIs are not exposed through the preload.

Examples, demo content, and sample data are written in English.
