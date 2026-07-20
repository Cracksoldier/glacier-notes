# Repository Guidelines

## Project Structure & Module Organization

Glacier Notes is an offline Electron 43 desktop app with an Angular 22 renderer. Renderer
code lives in `src/app/`: `core/` contains stores and cross-cutting services, `features/`
groups user-facing workflows, `shared/` holds reusable UI, and `testing/` provides test
stubs. Electron main-process code and the typed IPC boundary live in `electron/`; persistence
repositories are under `electron/storage/`. Static files belong in `public/`, while global
SCSS and design tokens live in `src/styles.scss` and `src/styles/`. Build output in `dist/`
and `dist-electron/` is generated and should not be edited.

Treat `SPECIFICATION.md` as the product authority and `MILESTONES.md` as the implementation
checklist. Mark an item complete only after verification.

## Build, Test, and Development Commands

- `npm start` runs Angular's development server and Electron together with hot reload.
- `npm run build` creates the production renderer and compiles the Electron TypeScript.
- `npm test` runs all Vitest unit tests through Angular's test builder.
- `npx ng test --include src/app/core/markdown/markdown.service.spec.ts` runs one spec.
- `npm run electron:prod` builds and launches the production-style application.
- `npm run format:check` checks Biome-supported files; use `npm run format` to fix them.

## Coding Style & Naming Conventions

Use strict TypeScript, two-space indentation, single quotes, and 100-character lines as
configured by `.editorconfig` and `biome.json`. Use kebab-case filenames (`note-card.ts`),
PascalCase for classes and components, and camelCase for functions and variables. Keep
component templates and SCSS beside their TypeScript files. Prefer Angular signals for
renderer state and plain exported functions for independently testable logic.

Biome is the sole formatter dependency. It formats supported TypeScript, JavaScript, JSON, and
CSS files; its experimental HTML formatter is disabled because it is not Angular-control-flow
safe, and Biome does not currently format SCSS, Markdown, or YAML. Keep those files consistent
with their surrounding style and `.editorconfig`.

IPC changes must update the full contract: `electron/api.ts`, `preload.ts`, `ipc.ts`, and
`src/app/testing/glacier-api-stub.ts`. Validate renderer input in the main process.

## Testing Guidelines

Place unit tests beside source files as `*.spec.ts`; tests run in Vitest with jsdom. Cover
new pure logic, stores, sanitization, and IPC-adjacent behavior. Run targeted tests while
iterating, then `npm test` and `npm run build` before submitting. No numeric coverage
threshold is configured.

## Commit & Pull Request Guidelines

Follow the history's imperative, scope-led subjects, for example `Add M5 images: ...`.
Keep commits focused and explain important behavior in the body. Pull requests should
summarize user-visible changes, reference the relevant specification or milestone, list
verification commands, link issues, and include screenshots for UI changes. Do not commit
generated output or local Electron user data.
