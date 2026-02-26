# Changelog

All notable changes to this project will be documented in this file.

## 0.0.2 - 2026-02-26

### Added

- In-app update status flow in Electron main process with IPC bridge.
- Top-right update action UI: download progress, retry, and `重启更新` action.
- Updater source definitions with primary GitHub and fallback EdgeOne proxy.
- Release distribution documentation for installer and updater metadata files.

### Changed

- Release workflow now enforces changelog-driven notes and fails when version notes are missing.
- Release artifacts now include updater metadata files (`.yml`, `.blockmap`) and installer assets.
- Installer-oriented packaging strategy retained for Windows (`nsis`), macOS (`dmg`), and Linux (`AppImage`).

### Notes

- App-side auto update requires `electron-updater` dependency to be installed.

## 0.0.1 - 2026-02-26

### Added

- Electron desktop runtime with React + TypeScript UI integration.
- Assistant module with local conversation persistence and settings storage.
- KSU local MCP tool registry for user info, personal info, grades, and calendar queries.
- Cross-platform release pipeline via GitHub Actions for Windows, macOS, and Linux.

### Changed

- Standardized request flow and logging in Electron main/request layers.
- Refined assistant chat UI with clearer message layout and tool activity states.
- Release notes workflow now prefers `CHANGELOG.md` and falls back to commit summaries.

### Fixed

- Resolved assistant message persistence transaction handling in SQLite store.
- Improved request timeout/error visibility for renderer and MCP tool calls.
