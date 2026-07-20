# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Glacier Notes — an offline, Google Keep-like note-taking desktop app (Electron 43 + Angular 22). Strictly local: JSON storage in Electron `userData`, no web backend, no CDN — all libraries (incl. Font Awesome) are vendored via npm. Development is milestone-driven: `SPECIFICATION.md` is the authoritative spec (with §-references), `MILESTONES.md` tracks M1–M10 with checkboxes. Check off milestone items only after verification; commit only when the user asks.

## Commands

- `npm start` — dev mode: `ng serve` + Electron with hot reload (`GLACIER_DEV=1`, loads localhost:4200)
- `npm run build` — production build: `ng build` + `tsc -p electron` (renderer → `dist/`, main/preload → `dist-electron/`)
- `npm test` — unit tests (Vitest via `ng test`, jsdom; watch mode auto-enables in a TTY, one-shot otherwise)
- `npx ng test --include src/app/core/markdown/markdown.service.spec.ts` — run a single spec file (glob relative to project root)
- `npx ng test --filter '^MarkdownService'` — filter by suite/test name regex
- `npm run electron:prod` — build then run the packaged-style app

Formatting: Biome (`biome.json`): two-space indentation, 100-char lines, and single quotes for
supported files. Angular HTML, SCSS, Markdown, and YAML remain manually formatted because Biome
does not safely support those repository formats.

### Headless smoke probes

The established end-to-end verification method (no test framework drives Electron; a probe script does):

```bash
npm run build
GLACIER_SMOKE=1 GLACIER_SMOKE_PROBE=/tmp/probe.js npx electron . 2>&1 | grep -E '\[smoke|\[renderer\]'
```

The harness in `electron/main.ts` evaluates the probe file in the renderer and prints its resolved value as `[smoke:probe]`. Probe conventions (see git history for examples): async IIFE returning a results object; `waitFor` helper must `await fn()` (async callbacks); drive real UI via `.click()` and `dispatchEvent(new Event('input', { bubbles: true }))`; run from clean state and clean up all created data at the end (app data lives in `~/.config/glacier-notes/`). For images, assert `img.complete && img.naturalWidth > 0`. Synthetic `DataTransfer`/`ClipboardEvent`/`DragEvent` construction works in Chromium for testing picker/drop/paste paths.

## Architecture

### Process split and IPC contract

- `electron/main.ts` — window creation, CSP installation (via `onHeadersReceived`), `glacier-img://` protocol, smoke harness, repo bootstrap.
- `electron/api.ts` — the single typed contract (`GlacierApi`) shared by preload and renderer. Every IPC surface change touches: `api.ts` → `preload.ts` (ipcRenderer.invoke mirror) → `ipc.ts` (ipcMain.handle + input validation) → `src/app/testing/glacier-api-stub.ts` (in-memory fake for renderer unit tests).
- `electron/ipc.ts` — validates all inputs from the renderer (`requireString`/`requireObject`); `shell:openExternal` allows http(s) only.
- Renderer accesses everything through `window.glacierApi` (contextBridge; `contextIsolation: true`, `sandbox: true`, no nodeIntegration).

### Storage (main process, `electron/storage/`)

JSON repos held in-memory in Maps, persisted via `DebouncedWriter` (debounced atomic writes: temp file + rename). One file per note in `notes/`, plus `notebooks.json`, `labels.json`, `images.json` + binary `images/` dir, `settings.json`, `window-state.json`. All files carry `schemaVersion` (`SCHEMA_VERSION` in `models.ts`). Trash = `deletedAt` timestamp; purge is physical deletion and returns purged notes' `imageIds` for image garbage collection (`gcImages` in `ipc.ts` — an image is referenced if any note has it in `imageIds` or mentions its id in `content`).

### Images

`glacier-img://<uuid>` custom protocol (registered as privileged in `main.ts`) serves files from the image store; the id is validated against a UUID pattern (path-traversal guard) — strip the scheme prefix manually, don't parse with `new URL()`. The scheme must be allowed in three places: CSP `img-src` (main.ts), DOMPurify's `ALLOWED_URI_REGEXP` (markdown.service.ts), and Angular's URL sanitizer (bypassed via `GlacierImgPipe`). `Note.imageIds` is the source of truth for attachments; markdown embeds (`![alt](glacier-img://id)`) additionally appear in `content`. `ImageUploadService` downscales >10 MB images via OffscreenCanvas before storing. When removing an image from a note, update the note *first*, then call `images.deleteIfUnreferenced` — otherwise the reference check sees the stale note.

### Renderer state (no router, no zone.js)

Signal-based stores in `src/app/core/store/`: `NoteStore`, `NotebookStore`, `SettingsStore`, `UiStore` (view selection, editor/lightbox open state — views are a discriminated union, not routes). `NoteStore.updateInPlace(id, patch)` patches the note inside the signal array without a reload, deliberately avoiding masonry-grid reshuffle; use it for auto-save and in-card mutations. `reloadAll()` happens on editor close.

**Stale-input-signal pitfall:** deriving new state from an `input()` signal during synchronous event sequences reads stale values (inputs update on the next CD pass). For editable child components use `model.required<T>()` and mutate via `.update()`/`.set()` (see `ChecklistEditor`); in async loops keep a local copy instead of re-reading the input (see `addImages` in `note-editor-dialog.ts`).

### Markdown pipeline

All rendering goes through `MarkdownService` (the only place allowed to call `bypassSecurityTrustHtml`): `marked` → DOMPurify (forbids style/form/input/button; `<img>` only with a valid `glacier-img://` src, removed entirely otherwise; anchors get `rel="noopener"`) → SafeHtml. `renderInline()` for checklist item text forbids `img` entirely. Strict CSP is the backstop. Links in rendered content are intercepted and opened via `shell.openExternal`.

### UI patterns

- Modals are native `<dialog>` + `showModal()` (ConfirmDialog, NoteEditorDialog, ImageLightbox); nested top-layer dialogs work natively.
- The editor auto-saves with a 500 ms debounce (`scheduleSave`/`flush` + `beforeunload` flush).
- Theme tokens are CSS custom properties in `src/styles/_tokens.scss`; global markdown styles (`.markdown-body`, `.markdown-inline`) in `src/styles.scss`.
- Pure logic lives in plain exported functions for unit testing (`checklist-model.ts`, `markdown-edit.ts`, `scaleDimensions` in `image-upload.ts`).

## Commit style

Imperative subject describing the milestone/feature scope, short body explaining what's included (see `git log`).
