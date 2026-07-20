# Glacier Notes — Release Checklist

Use this checklist for each release candidate. Record the version, artifact hashes, tester,
platform/version, and date. Do not mark the M10 cross-platform walkthrough complete until Linux
and at least one of Windows or macOS have a signed-off manual run.

## Automated Evidence

- [ ] `npm ci`
- [ ] `npm test -- --watch=false`
- [ ] `npm run build`
- [ ] `npm run verify:offline`
- [ ] Native GitHub matrix produced AppImage, deb, NSIS, portable EXE, and dmg artifacts
- [ ] Packaged smoke probe passed on Linux, Windows, and macOS with zero remote requests
- [ ] SHA-256 hashes recorded for every distributed artifact

## Acceptance Walkthrough

Run with networking disabled. Use a fresh user-data directory, then repeat persistence checks
after restarting the application.

- [ ] 1. App launches and core note workflows remain functional offline.
- [ ] 2. Dark theme is the first-launch default; light-theme selection persists.
- [ ] 3. Create, rename, reorder, and delete notebooks; move notes between them.
- [ ] 4. Create/render Markdown and create/edit/toggle/reorder checklist items.
- [ ] 5. Add PNG/JPEG/WebP/GIF images via picker, drag/drop, and paste; open the lightbox.
- [ ] 6. Live search finds title, content, and checklist matches across/current notebook.
- [ ] 7. Full export imports identically into fresh data; exercise copy/replace collisions.
- [ ] 8. Email sharing opens the external client with expected subject/body.
- [ ] 9. Data remains inside the platform user-data directory; no external service is contacted.
- [ ] 10. Install/uninstall or launch each required package on its target operating system.
- [ ] 11. Trash, restore, permanent delete, empty trash, and configured auto-purge work.
- [ ] 12. English/German runtime switching, dates, settings, tray, and quick-note text are localized.
- [ ] 13. Note colors remain readable in both themes; label filtering works.
- [ ] 14. Tray, close-to-tray, and global quick-note shortcut work or show the supported fallback.
- [ ] 15. Every documented keyboard shortcut and editor formatting shortcut works.
- [ ] Corrupt one metadata file and one note file; verify backups and the recovery dialog.
- [ ] Try malformed and structurally invalid imports; verify readable bounded error details.

## Platform Sign-off

| Platform | OS/version | Architecture | Tester | Date | Result/notes |
| -------- | ---------- | ------------ | ------ | ---- | ------------ |
| Linux    |            | x64          |        |      |              |
| Windows  |            | x64          |        |      |              |
| macOS    |            | x64          |        |      |              |
