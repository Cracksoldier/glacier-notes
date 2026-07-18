# Glacier Notes — Specification

A cross-platform desktop note-taking app similar to Google Keep, built with Electron and Angular. Fully offline, no web backend.

**Targets:** Linux, Windows, macOS

---

## 1. Goals & Non-Goals

### Goals
- Local-first note taking with notebooks, search, markdown, checklists, and images
- Cold dark blue theme (default) with a light theme toggle
- Full export/import of all user data
- Share notes via the user's external email client
- All libraries vendored locally — no CDN or runtime network dependency

### Non-Goals (scoped out)
- Cloud connection / cloud backup / sync
- Any web backend dependency
- In-app email sending (SMTP) — sharing delegates to an external mail client
- Multi-user support / accounts
- Mobile targets

---

## 2. Technical Stack

| Layer | Technology |
|---|---|
| Desktop shell | Electron (latest LTS-compatible release) |
| UI framework | Angular (latest stable, standalone components) |
| Icons | Font Awesome (free set, installed via npm, bundled locally) |
| Markdown rendering | e.g. `marked` or `markdown-it` (npm, bundled) + sanitizer (e.g. `DOMPurify`) |
| Packaging | `electron-builder` (AppImage/deb for Linux, NSIS for Windows, dmg for macOS) |
| Language | TypeScript throughout (main + renderer) |

### Vendoring / Offline Requirement
- All dependencies installed via npm and bundled into the app package at build time.
- No `<script>`/`<link>` tags pointing to CDNs; no Google Fonts fetches — fonts (including Font Awesome webfonts) ship with the app.
- The app must be fully functional with networking disabled. The only network-adjacent action is opening a `mailto:` link, handled by the OS.

### Electron Architecture & Security
- **Main process:** window management, file system access (storage, import/export dialogs), `mailto:` handling via `shell.openExternal`.
- **Renderer process:** Angular app. `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- **Preload script:** exposes a minimal typed IPC API (`window.glacierApi`) via `contextBridge`.
- Content-Security-Policy restricting to `self` (plus `data:`/`blob:` for embedded images).
- All file system operations happen in the main process; the renderer never touches `fs` directly.

---

## 3. Data Model

```ts
interface Notebook {
  id: string;            // UUID v4
  name: string;
  color?: string;        // optional accent color
  createdAt: string;     // ISO 8601
  updatedAt: string;
  sortOrder: number;
}

type NoteType = 'text' | 'checklist';

interface Note {
  id: string;            // UUID v4
  notebookId: string;
  type: NoteType;
  title: string;
  content: string;       // markdown source (text notes)
  checklist?: ChecklistItem[];  // checklist notes
  imageIds: string[];    // references into image store
  pinned: boolean;
  archived: boolean;
  color?: string;        // Keep-style card accent color (from fixed palette)
  labels: string[];      // label IDs
  deletedAt?: string;    // set when note is in Trash; absent otherwise
  createdAt: string;
  updatedAt: string;
}

interface Label {
  id: string;            // UUID v4
  name: string;
}

interface ChecklistItem {
  id: string;
  text: string;          // supports inline markdown
  checked: boolean;
  sortOrder: number;
}

interface ImageAsset {
  id: string;            // UUID v4
  mimeType: string;      // image/png, image/jpeg, image/webp, image/gif
  fileName?: string;     // original name, if known
  // stored as binary file on disk; base64-encoded only in export files
}
```

Notes reference images by ID; markdown content embeds them with a custom scheme, e.g. `![alt](glacier-img://<imageId>)`, resolved at render time.

---

## 4. Local Storage — Approaches (Suggestions)

All approaches store data under Electron's per-user data directory (`app.getPath('userData')`), e.g. `~/.config/glacier-notes/` on Linux.

### Option A — JSON files on disk (recommended for v1)
- One `notebooks.json`, one JSON file per note (or per notebook), images as raw binary files in an `images/` directory.
- **Pros:** zero dependencies, human-inspectable, trivially matches the export format, easy backup, robust against schema drift.
- **Cons:** search/filtering done in memory; fine up to thousands of notes, no transactions.

### Option B — SQLite (via `better-sqlite3`)
- Single database file; notes/notebooks/checklist items as tables; optional FTS5 full-text search index; images as BLOBs or on-disk files.
- **Pros:** fast indexed full-text search at scale, transactional integrity, single-file storage.
- **Cons:** native module (must be rebuilt per platform/Electron version — complicates packaging), less human-readable.

### Option C — IndexedDB (renderer-side, e.g. via Dexie)
- Browser-native storage inside the Chromium profile.
- **Pros:** no native modules, async API, decent capacity.
- **Cons:** data lives inside opaque Chromium profile internals (hostile to user backups), tied to the renderer partition, harder to export/inspect, risk of data loss on profile corruption.

### Option D — Embedded JS document store (e.g. LokiJS / lowdb)
- JSON-backed document database with query API in the main process.
- **Pros:** query convenience over plain JSON, no native modules.
- **Cons:** extra dependency for modest benefit; several such libraries are lightly maintained.

**Recommendation:** Start with **Option A** (JSON + image files) behind a storage-service abstraction (repository pattern in the main process). If note counts grow or search becomes slow, migrate to **Option B (SQLite + FTS5)** without touching UI code.

### Persistence details (applies to chosen option)
- Atomic writes (write to temp file, then rename) to prevent corruption on crash.
- Debounced auto-save while editing (e.g. 500 ms after last keystroke).
- Schema version field in stored data to support future migrations.

---

## 5. Features

### 5.1 Notebooks
- Create, rename, delete notebooks; deleting prompts for confirmation and deletes contained notes (or offers moving them).
- A default notebook ("Notes") exists on first launch and cannot be deleted, only renamed.
- Sidebar lists notebooks with note counts; drag to reorder (or up/down actions).
- Notes can be moved between notebooks.

### 5.2 Notes
- Two types, chosen at creation: **text note** (markdown) and **checklist note**.
- Card grid view per notebook (masonry-style, like Keep) with title, content preview, image thumbnail.
- Pin notes (pinned section on top); archive notes (hidden from default view, reachable via "Archive").
- **Trash with restore:** deleting a note moves it to a Trash section (sets `deletedAt`). Trashed notes can be restored or permanently deleted; "Empty trash" purges all. Auto-purge after 30 days by default, with an opt-out in settings (`trashAutoPurgeDays = 0` → never).
- Note colors: assignable accent color per note from a fixed palette (tuned for both themes), shown on the card and in the editor.
- Labels: user-managed tags assignable to notes; sidebar lists labels for filtering; multiple labels per note.
- Edit in a modal or detail view with live preview or side-by-side markdown rendering.

### 5.3 Markdown Support
- Text notes: full markdown rendering (headings, bold/italic, lists, links, code blocks, blockquotes, tables).
- **Editor toolbar:** buttons for bold, italic, headings, lists, checklist, link, code, and image insertion; toolbar actions wrap/insert markdown syntax at the cursor.
- Checklist item text: inline markdown only (bold, italic, code, links).
- Rendered HTML is sanitized (DOMPurify) — no raw HTML passthrough by default.
- External links open in the OS default browser (`shell.openExternal`), never inside the app window.

### 5.4 Checklist Notes
- Add, edit, reorder, delete items; toggle checked state directly on the note card and in the editor.
- Checked items visually struck through; optional "move checked to bottom" toggle.
- Convert text note ⇄ checklist note (best-effort conversion: lines ⇄ items).

### 5.5 Images in Notes
- Insert via file picker, drag & drop, and paste from clipboard.
- Supported formats: PNG, JPEG, WebP, GIF.
- Stored as binary files in the app data directory, referenced by ID (see §3).
- Displayed inline in the rendered note and as thumbnails on cards; click to view full size.
- Removing an image from a note garbage-collects the file if no other note references it.
- Size guard: images larger than **10 MB** are automatically downscaled/re-encoded on insert to keep storage and export files manageable; smaller images are stored untouched.

### 5.6 Search
- Global search field in the header; searches across all notebooks by default, filterable to the current notebook.
- Matches: note title, text content, checklist item text. Case-insensitive substring match for v1.
- Live results as you type (debounced), with match highlighting in the results list.
- (If SQLite/FTS5 is adopted: upgrade to ranked full-text search.)

### 5.7 Export / Import
- **Export:** single JSON file (`.glacier.json`) via OS save dialog containing schema version, all notebooks, all notes, and all images **base64-encoded** inline. Scope options: everything, or a single notebook.
- **Import:** OS open dialog; validates schema version and structure.
  - **Conflict strategy — ask on import:** after selecting a file, a dialog lets the user choose:
    - *Add as copies* — all imported items get fresh IDs (safe default, may duplicate).
    - *Replace existing by ID* — matching IDs are overwritten with the imported version (true backup restore).
  - If no ID collisions exist, the import proceeds without the choice dialog.
- Export format is documented and stable so users can rely on it as a backup format.

Example export envelope:

```json
{
  "format": "glacier-notes-export",
  "schemaVersion": 1,
  "exportedAt": "2026-07-18T10:00:00Z",
  "notebooks": [ ... ],
  "notes": [ ... ],
  "images": [ { "id": "...", "mimeType": "image/png", "base64": "..." } ]
}
```

### 5.8 Share via Email
- "Share" action on each note builds a `mailto:` URL: subject = note title, body = note content as plain markdown text (checklists rendered as `- [x] item` lines).
- Opened via `shell.openExternal` — composition and sending happen entirely in the user's default external email client.
- Limitation (documented in UI): `mailto:` cannot carry image attachments; body length is capped by OS/client limits. For notes with images, offer "Export note as file" as the alternative sharing path.

### 5.9 Theming
- **Dark theme (default):** cold dark blue palette. Suggested tokens:
  - Background: deep navy (e.g. `#0d1b2a`), surfaces `#1b263b`, elevated surfaces `#243447`
  - Accent: ice blue (e.g. `#4cc9f0` / `#63b3ed`), text: `#e0e6ed`, muted text: `#8899aa`
- **Light theme:** cool white/light blue-grey counterpart (e.g. background `#f4f7fa`, surfaces `#ffffff`, same accent family).
- Toggle in the header (Font Awesome sun/moon icon); choice persisted in settings; applied via CSS custom properties + a root-level theme class.
- First launch defaults to dark regardless of OS preference (per requirements).
- Note accent colors are defined as palette pairs so they remain readable in both themes.

### 5.10 Internationalization (i18n)
- Supported languages: **English** and **German**; switcher in settings, persisted.
- Implemented with runtime translation (e.g. `ngx-translate` or Angular's `$localize` with runtime loading) so switching does not require separate builds; translation files bundled locally.
- First launch: default to OS locale if `de`/`en`, otherwise English.
- Dates formatted per selected language.

### 5.11 Keyboard Shortcuts
| Shortcut | Action |
|---|---|
| `Ctrl/Cmd+N` | New text note |
| `Ctrl/Cmd+Shift+N` | New checklist note |
| `Ctrl/Cmd+F` | Focus search |
| `Ctrl/Cmd+Enter` | Save/close editor |
| `Esc` | Close editor/dialog |
| `Ctrl/Cmd+B` / `Ctrl/Cmd+I` | Bold / italic in editor |
| `Ctrl/Cmd+E` | Toggle export dialog |
| `Ctrl/Cmd+,` | Open settings |

- Shortcuts listed in a help dialog (`?` icon or `Ctrl/Cmd+/`); implemented via Electron menu accelerators + in-app handlers.

### 5.12 System Tray & Quick Note
- Tray icon with context menu: *Open Glacier Notes*, *Quick note*, *Quit*.
- Closing the window minimizes to tray (configurable in settings: minimize to tray vs. quit on close).
- **Quick note:** a global shortcut (default `Ctrl/Cmd+Alt+G`, configurable) opens a small always-on-top capture window; entered text is saved as a new note in the default notebook. Registered via Electron `globalShortcut`.
- Linux caveat: tray behavior varies by desktop environment (needs `libappindicator` on some distros); global shortcuts may be unavailable under some Wayland compositors — degrade gracefully (feature hidden/disabled with a hint in settings).

---

## 6. UI Layout

```
+----------------------------------------------------------------+
| ☰  Glacier Notes        [ Search............ ]     ☾/☀  ⚙      |
+------------------+---------------------------------------------+
| NOTEBOOKS        |  [ + Text note ] [ + Checklist ]            |
|  • Notes (12)    |                                             |
|  • Work (5)      |  📌 Pinned                                  |
|  • Ideas (3)     |  +--------+  +--------+  +--------+         |
|  + New notebook  |  | note   |  | note   |  | note   |         |
|                  |  +--------+  +--------+  +--------+         |
| LABELS           |  Others                                     |
|  # shopping      |  +--------+  +--------+  ...                |
|  # todo          |                                             |
|                  |                                             |
|  Archive         |                                             |
|  Trash           |                                             |
| Import / Export  |                                             |
+------------------+---------------------------------------------+
```

- Left sidebar: notebooks, labels, archive, trash, import/export.
- Main area: note card grid of the selected notebook (or search results).
- Note editor: modal overlay (Keep-style) with title, markdown toolbar, content/checklist editor, image strip, and actions (pin, archive, color, labels, move, share, delete).
- Icons throughout via Font Awesome (pin, trash, archive, share, image, sun/moon, plus, search, checkbox…).

---

## 7. Application Settings

Stored as `settings.json` in the user data directory:
- `theme`: `"dark" | "light"` (default `"dark"`)
- `language`: `"en" | "de"` (default: OS locale if supported, else `"en"`)
- `moveCheckedToBottom`: boolean
- `closeToTray`: boolean (default `true`)
- `quickNoteShortcut`: string (default `"Ctrl/Cmd+Alt+G"`)
- `trashAutoPurgeDays`: number (default `30`, `0` = never)
- `lastSelectedNotebookId`: string
- Window bounds/state (restored on launch)

---

## 8. Project Structure (proposed)

```
glacier-notes/
├── package.json
├── electron/
│   ├── main.ts              # app lifecycle, window, IPC handlers
│   ├── preload.ts           # contextBridge API
│   ├── storage/             # repository layer (JSON v1)
│   │   ├── notebook-repo.ts
│   │   ├── note-repo.ts
│   │   └── image-store.ts
│   ├── export-import.ts
│   └── mailto.ts
├── src/                     # Angular renderer
│   ├── app/
│   │   ├── core/            # services: storage client (IPC), theme, search
│   │   ├── features/
│   │   │   ├── notebooks/
│   │   │   ├── notes/       # grid, card, editor (text + checklist)
│   │   │   ├── search/
│   │   │   └── settings/
│   │   └── shared/          # markdown pipe, sanitizer, dialogs, icons
│   ├── styles/              # theme tokens (CSS custom properties)
│   └── assets/              # bundled fonts, Font Awesome
└── build/                   # electron-builder config, icons
```

---

## 9. IPC API Surface (preload)

```ts
interface GlacierApi {
  notebooks: { list; create; update; delete; };
  notes:     { list; get; create; update; trash; restore; purge; move; search; };
  labels:    { list; create; update; delete; };
  images:    { add; getDataUrl; delete; };
  transfer:  { exportData(scope): Promise<void>;   // save dialog + write
               importData(): Promise<ImportResult> }; // open dialog + read
  share:     { emailNote(noteId): Promise<void>; };  // opens mailto:
  settings:  { get; set; };
}
```

---

## 10. Packaging & Distribution

- `electron-builder` targets: Linux (AppImage + deb), Windows (NSIS installer + portable), macOS (dmg; unsigned in v1 unless certificates are available).
- App ID: `com.glacier.notes`; product name: **Glacier Notes**.
- No auto-update in v1 (would imply network dependency); releases distributed manually.

---

## 11. Acceptance Criteria (summary)

1. App launches and works fully with all networking disabled.
2. Dark cold-blue theme by default; toggle switches to light theme and persists across restarts.
3. User can create/rename/delete notebooks and move notes between them.
4. User can create text notes with rendered markdown and checklist notes with toggleable items.
5. Images can be added to notes (picker, drag & drop, paste) and render inline.
6. Search returns matching notes across notebooks as the user types.
7. Export produces a single JSON file with images base64-encoded; importing it on a fresh install restores all data; on collision the user is asked to add as copies or replace by ID.
8. "Share via email" opens the OS default mail client with subject and body prefilled.
9. All notes, images, and settings live in the local user data directory; no external services contacted.
10. Installers/packages build for Linux, Windows, and macOS.
11. Deleted notes land in Trash and can be restored; "Empty trash" purges permanently.
12. UI is fully available in English and German; language switchable at runtime and persisted.
13. Notes can be colored and labeled; sidebar label filter shows matching notes.
14. Tray icon with quick-note global shortcut works (where the OS/DE supports it); close-to-tray is configurable.
15. Documented keyboard shortcuts work, including the markdown toolbar formatting shortcuts.

---

## 12. Decisions Log

Resolved with stakeholder (2026-07-18):
- **Deletion:** Trash with restore (§5.2), optional 30-day auto-purge.
- **Languages:** English + German with runtime switching (§5.10).
- **V1 scope additions:** note colors & labels, markdown editor toolbar, keyboard shortcuts, system tray + quick note.
- **Import conflicts:** ask on import — "add as copies" or "replace by ID" (§5.7).
- **Image size:** auto-downscale/re-encode images above 10 MB on insert (§5.5).
- **Trash auto-purge:** 30 days by default, opt-out available in settings (§5.2, §7).

All open questions are resolved — the specification is complete and ready for implementation planning.
