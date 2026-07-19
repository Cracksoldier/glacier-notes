# Glacier Notes

Glacier Notes is a local-first desktop note-taking app inspired by Google Keep. It runs on
Electron and Angular, stores everything on the local filesystem, and remains fully functional
without a network connection. There are no accounts, cloud services, analytics, or runtime CDN
dependencies.

> Glacier Notes is currently at version 0.1.0. Core functionality is implemented; packaging and
> cross-platform release validation are tracked in M10.

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
| `npm run watch`          | Rebuild the Angular renderer when source files change      |
| `npx prettier --check .` | Check repository formatting                                |

Build artifacts are written to `dist/` and `dist-electron/`.

## Local Data and Privacy

Application data is stored below Electron's platform-specific `userData` directory, commonly:

- Linux: `~/.config/glacier-notes/`
- Windows: `%APPDATA%/glacier-notes/`
- macOS: `~/Library/Application Support/glacier-notes/`

Writes are atomic and debounced. Images larger than 10 MB are downscaled before storage.
Deleting an attachment or permanently deleting a note garbage-collects unreferenced image
files. The only network-adjacent operation is opening a `mailto:` URL in an external client.

## Backup and Restore

Portable `.glacier.json` exports use the stable schema-v1 envelope. It contains notebooks,
notes, labels, and base64-encoded images plus export scope and default-notebook metadata. Export
can cover all data, one notebook, or one note.

Imports validate entity IDs, structure, references, image types, and payloads before changing
local data. Collision-free imports preserve IDs; conflicts can be added as remapped copies or
replace matching IDs. A full backup imported into a pristine installation restores the original
default notebook. Interrupted imports are rolled back automatically on the next startup.

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
- [AGENTS.md](AGENTS.md) contains contributor workflow and coding conventions.

Packaging for AppImage/deb, NSIS/portable, and dmg is planned for M10. Until then, run the app
from source using the commands above.
