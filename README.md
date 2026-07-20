# Glacier Notes

Glacier Notes is a local-first desktop note-taking app inspired by Google Keep. It runs on
Electron and Angular, stores everything on the local filesystem, and remains fully functional
without a network connection. There are no accounts, cloud services, analytics, or runtime CDN
dependencies.

> Glacier Notes is currently at version 0.1.0. Release packages are unsigned and distributed
> manually; the app does not contain an updater.

## Features

- Markdown text notes with live preview and formatting shortcuts
- Checklist notes with reordering, inline Markdown, and card-level toggles
- Notebooks, labels, colors, pinning, archive, trash, and automatic trash cleanup
- Global search across titles, content, and checklist items
- PNG, JPEG, WebP, and GIF attachments via picker, drag-and-drop, or clipboard
- Dark and light themes with runtime English/German switching
- Versioned `.glacier.json` backup, restore, notebook export, and single-note export
- Email sharing through the operating system's default mail client
- System tray, close-to-tray behavior, keyboard shortcuts, and an always-on-top quick-note window

## Technology and Architecture

The Angular 22 renderer lives in `src/`; the Electron 43 main process, preload bridge, local
repositories, and desktop integrations live in `electron/`. Renderer code cannot access Node.js
directly. All privileged operations cross the typed `window.glacierApi` bridge with context
isolation and sandboxing enabled.

Notes and metadata are stored as human-readable JSON, with one file per note and binary images
in a separate directory. Markdown is rendered with `marked`, sanitized with DOMPurify, and
protected by a restrictive Content Security Policy.

## Development

Prerequisites: a current Node.js LTS release, npm 11, and the desktop libraries required by
Electron on your operating system.

```bash
npm install
npm start
```

`npm start` launches Angular's development server and Electron together with hot reload. Other
useful commands:

| Command                  | Purpose                                                    |
| ------------------------ | ---------------------------------------------------------- |
| `npm test`               | Run the Vitest unit suite through Angular's test builder   |
| `npm run build`          | Build the Angular renderer and compile Electron TypeScript |
| `npm run electron:prod`  | Build and launch the production-style application          |
| `npm run verify:offline` | Check production resources for remote runtime dependencies |
| `npm run format:check`   | Check Biome-supported files for formatting                  |
| `npm run format`         | Format Biome-supported files                                |
| `npm run watch`          | Rebuild the Angular renderer when source files change      |

Build artifacts are written to `dist/` and `dist-electron/`.

## Packaging and Release Builds

Installers are built with `electron-builder` for x64. Run the command for the current host:

| Command                 | Artifacts                          |
| ----------------------- | ---------------------------------- |
| `npm run package:linux` | AppImage and Debian package        |
| `npm run package:win`   | NSIS installer and portable EXE    |
| `npm run package:mac`   | Unsigned macOS disk image (`.dmg`) |

Generated packages and unpacked applications are written to the ignored `release/` directory.
`npm run smoke:packaged -- <linux|win32|darwin>` launches the corresponding unpacked package
with isolated temporary data and rejects any renderer network request. GitHub's
`release-builds.yml` workflow runs quality checks and builds each target on a native runner when
started manually or by a `v*` tag; it uploads artifacts but does not publish a GitHub Release.

Unsigned Windows and macOS packages can trigger operating-system trust warnings. Signing and
notarization credentials are intentionally outside the v1 scope.

## Local Data and Privacy

Application data is stored below Electron's platform-specific `userData` directory, commonly:

- Linux: `~/.config/glacier-notes/`
- Windows: `%APPDATA%/glacier-notes/`
- macOS: `~/Library/Application Support/glacier-notes/`

Writes are atomic and debounced. Images larger than 10 MB are downscaled before storage.
Deleting an attachment or permanently deleting a note garbage-collects unreferenced image
files. The only network-adjacent operation is opening a `mailto:` URL in an external client.

If a local JSON file is malformed, Glacier Notes renames the original with a
`.corrupt-<timestamp>` suffix before recovering. Damaged metadata is reset to a safe default and
an individual damaged note is skipped without affecting other notes. A localized startup dialog
lists the preserved backup paths for manual inspection or recovery. Filesystem failures that
prevent safe backup or initialization stop startup instead of overwriting data.

## Backup and Restore

Portable `.glacier.json` exports use the stable schema-v1 envelope. It contains notebooks,
notes, labels, and base64-encoded images plus export scope and default-notebook metadata. Export
can cover all data, one notebook, or one note.

Imports validate entity IDs, structure, references, image types, and payloads before changing
local data. Collision-free imports preserve IDs; conflicts can be added as remapped copies or
replace matching IDs. A full backup imported into a pristine installation restores the original
default notebook. Interrupted imports are rolled back automatically on the next startup.

### Export format v1

Every export is UTF-8 JSON with this envelope:

```json
{
  "format": "glacier-notes-export",
  "schemaVersion": 1,
  "exportedAt": "2026-07-20T12:00:00.000Z",
  "notebooks": [],
  "notes": [],
  "labels": [],
  "images": [],
  "scope": { "kind": "all" },
  "defaultNotebookId": "uuid"
}
```

- IDs are UUIDs. Timestamps use ISO 8601 strings, and note image/label/notebook references must
  resolve inside the same envelope.
- `notebooks`, `notes`, and `labels` use the data model documented in `SPECIFICATION.md` §3.
  Checklist items are embedded in checklist notes.
- Each image is `{ id, mimeType, fileName?, base64 }`; supported MIME types are PNG, JPEG, WebP,
  and GIF, with decoded image payloads limited to 10 MB.
- `scope` is `all`, `notebook`, or `note`. Full exports also carry `defaultNotebookId` so a fresh
  install can restore the original default notebook.
- Import accepts schema version 1 and rejects newer versions, duplicate IDs, broken references,
  invalid payloads, and malformed entity data before making changes. Older v1 exports may omit
  `scope` and `defaultNotebookId`.
- Collision-free imports preserve IDs. On collision, “Add as copies” remaps every entity and
  reference; “Replace existing” overwrites matching IDs transactionally.

## Keyboard Shortcuts

Use `Ctrl` on Linux/Windows or `Cmd` on macOS.

| Shortcut           | Action                         |
| ------------------ | ------------------------------ |
| `Ctrl/Cmd+N`       | New text note                  |
| `Ctrl/Cmd+Shift+N` | New checklist                  |
| `Ctrl/Cmd+F`       | Focus search                   |
| `Ctrl/Cmd+Enter`   | Save and close the editor      |
| `Ctrl/Cmd+E`       | Open import/export             |
| `Ctrl/Cmd+,`       | Open settings                  |
| `Ctrl/Cmd+/`       | Show shortcut help             |
| `Ctrl/Cmd+Alt+G`   | Open Quick Note (configurable) |

Tray icons and global shortcuts depend on desktop-environment support. Some Linux Wayland
compositors do not expose global shortcuts; Glacier Notes disables the control and explains the
limitation when unavailable.

## Project Documentation

- [SPECIFICATION.md](SPECIFICATION.md) defines product behavior and acceptance criteria.
- [MILESTONES.md](MILESTONES.md) tracks implementation and release readiness.
- [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) records automated evidence and platform sign-off.
- [AGENTS.md](AGENTS.md) contains contributor workflow and coding conventions.
