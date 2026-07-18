# Glacier Notes — Milestones

Implementation plan derived from [SPECIFICATION.md](SPECIFICATION.md). Each milestone produces a runnable, testable increment; later milestones build on earlier ones. Spec section references in parentheses.

---

## M1 — Project Scaffold & App Shell

**Goal:** Electron + Angular skeleton that launches on all three platforms with the security baseline in place.

- [x] Repo setup: Angular workspace (standalone components, TypeScript), Electron main/preload in `electron/`, dev workflow (hot reload) and production build wired together (§2, §8)
- [x] Electron security baseline: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, CSP (`self` + `data:`/`blob:`), preload with `contextBridge` stub `window.glacierApi` (§2)
- [x] Font Awesome + fonts installed via npm and bundled — verify zero network requests with DevTools offline (§2)
- [x] App shell layout: header (title, search placeholder, theme toggle placeholder, settings), sidebar (notebooks/labels/archive/trash/import-export placeholders), main content area (§6)
- [x] Window bounds persisted and restored on launch (§7)

**Done when:** app starts on Linux (dev), shows the empty shell, works fully offline.

---

## M2 — Storage Layer & Data Model

**Goal:** JSON-file storage (Option A) behind a repository abstraction, exposed via typed IPC.

- [ ] Data model types: `Notebook`, `Note`, `ChecklistItem`, `Label`, `ImageAsset` (§3)
- [ ] Repository layer in main process: `notebook-repo`, `note-repo`, `image-store` over JSON files + `images/` dir in `userData` (§4, §8)
- [ ] Atomic writes (temp file + rename), debounced auto-save, `schemaVersion` field (§4)
- [ ] Settings store (`settings.json`) with defaults from §7
- [ ] IPC surface implemented and typed end-to-end: `notebooks.*`, `notes.*` (incl. `trash`/`restore`/`purge`), `labels.*`, `settings.*` (§9)
- [ ] Default notebook "Notes" created on first launch, not deletable (§5.1)

**Done when:** CRUD operations from renderer dev-console persist across app restarts; storage files human-readable.

---

## M3 — Notebooks & Text Notes (Core UX)

**Goal:** The core Keep-like experience with text notes.

- [ ] Notebook sidebar: create, rename, delete (with confirm + move-or-delete choice for contained notes), note counts, reorder (§5.1)
- [ ] Note card grid (masonry) with title + content preview; pinned section on top (§5.2, §6)
- [ ] Note editor modal: title + markdown content, debounced auto-save (§5.2)
- [ ] Markdown rendering with sanitization (marked/markdown-it + DOMPurify); external links open via `shell.openExternal` (§5.3)
- [ ] Markdown editor toolbar (bold, italic, headings, lists, link, code) (§5.3)
- [ ] Note actions: pin, archive (+ Archive view), move to notebook (§5.2)
- [ ] Trash: delete → trash, Trash view with restore / delete permanently / empty trash; auto-purge after `trashAutoPurgeDays` (default 30, 0 = never) (§5.2)

**Done when:** acceptance criteria 3 (partially), 4 (text half), 11 pass.

---

## M4 — Checklist Notes

**Goal:** Second note type, feature-complete.

- [ ] Checklist editor: add/edit/delete/reorder items, toggle checked; strike-through styling (§5.4)
- [ ] Toggle items directly on the note card (§5.4)
- [ ] "Move checked to bottom" setting (§5.4, §7)
- [ ] Inline markdown in item text (§5.3)
- [ ] Convert text ⇄ checklist (lines ⇄ items, best effort) (§5.4)

**Done when:** acceptance criterion 4 passes fully.

---

## M5 — Images in Notes

**Goal:** Image support end-to-end.

- [ ] Insert via file picker, drag & drop, clipboard paste; PNG/JPEG/WebP/GIF (§5.5)
- [ ] Binary storage in `images/`, referenced by ID; `glacier-img://` resolution in rendered markdown; image strip in editor; toolbar insert button (§3, §5.5)
- [ ] Card thumbnails; click for full-size view (§5.5)
- [ ] Auto-downscale/re-encode images > 10 MB on insert (§5.5)
- [ ] Garbage-collect unreferenced image files on removal (§5.5)

**Done when:** acceptance criterion 5 passes.

---

## M6 — Search, Colors & Labels

**Goal:** Finding and organizing notes.

- [ ] Global search: title, content, checklist items; case-insensitive, debounced live results, match highlighting; all-notebooks vs. current-notebook filter (§5.6)
- [ ] Note colors from fixed palette (readable in both themes), on card + editor (§5.2, §5.9)
- [ ] Labels: manage (create/rename/delete), assign multiple per note, sidebar filter view (§5.2, §6)

**Done when:** acceptance criteria 6 and 13 pass.

---

## M7 — Theming & i18n

**Goal:** Visual identity and both languages.

- [ ] Theme tokens as CSS custom properties; cold dark blue theme (default) + light theme; header toggle persisted (§5.9, §7)
- [ ] Full UI pass on both themes, incl. note color palette pairs (§5.9)
- [ ] i18n framework (runtime switching); English + German translation files, bundled locally; language setting with OS-locale default; localized dates (§5.10)

**Done when:** acceptance criteria 2 and 12 pass.

---

## M8 — Export / Import & Email Share

**Goal:** Data portability and sharing.

- [ ] Export to `.glacier.json` (schema version, notebooks, notes, labels, images base64) via save dialog; scope: all or single notebook (§5.7)
- [ ] Import with validation; conflict dialog "add as copies" / "replace by ID", skipped when no collisions (§5.7)
- [ ] Round-trip test: export → fresh install → import → identical data (§11.7)
- [ ] Share via `mailto:` (subject = title, body = markdown/`- [x]` lines) through `shell.openExternal`; UI hint re: no image attachments + "export note as file" alternative (§5.8)

**Done when:** acceptance criteria 7 and 8 pass.

---

## M9 — Keyboard Shortcuts, Tray & Quick Note

**Goal:** Power-user and desktop-integration features.

- [ ] Shortcut set from §5.11 via menu accelerators + in-app handlers; shortcut help dialog (`Ctrl/Cmd+/`)
- [ ] Tray icon + context menu (open / quick note / quit); close-to-tray setting (§5.12, §7)
- [ ] Quick-note window on global shortcut (default `Ctrl/Cmd+Alt+G`, configurable); saves to default notebook (§5.12)
- [ ] Graceful degradation on Linux/Wayland (hide/disable with settings hint) (§5.12)

**Done when:** acceptance criteria 14 and 15 pass.

---

## M10 — Packaging, Polish & Release

**Goal:** Distributable builds and final QA.

- [ ] `electron-builder` config: Linux (AppImage + deb), Windows (NSIS + portable), macOS (dmg); app ID `com.glacier.notes` (§10)
- [ ] App icons for all platforms
- [ ] Full offline verification: no network access at runtime, no CDN references in bundles (§2, §11.1)
- [ ] Full acceptance-criteria walkthrough (§11.1–15) on at least Linux + one other platform
- [ ] Error handling polish: corrupt storage file recovery message, import validation errors, empty states
- [ ] README with build/run instructions and export-format documentation (§5.7)

**Done when:** all acceptance criteria in §11 pass; installers produced for all three targets.

---

## Dependency Overview

```
M1 ──► M2 ──► M3 ──► M4 ──► M5
               │
               ├──► M6 ──┐
               ├──► M7 ──┼──► M10
               ├──► M8 ──┤
               └──► M9 ──┘
```

M4–M9 are largely independent of each other after M3; M6–M9 can be parallelized or reordered. M10 requires everything.

## Suggested order rationale

- Storage (M2) before any UI so features are built against the real persistence layer, not mocks.
- Text notes (M3) establish editor, rendering, and grid patterns that checklists (M4) and images (M5) extend.
- Theming/i18n (M7) after the bulk of UI exists to avoid retrofitting churn, but before release polish.
- Packaging (M10) last, but a smoke build of `electron-builder` early (during M1) is recommended to surface packaging issues before the codebase grows.
