# Changelog

All notable changes to this project will be documented in this file.

## 0.0.2 - 2026-03-04

### Added

- Added assistant local time utility and tool-based current date/time response capability.
- Added conversation lifecycle improvements in assistant UI, including delete action and empty new-chat guard.
- Added normalized campus news feed handling with in-app article opening using token headers.

### Changed

- Migrated Electron main process modules to a TypeScript/ESM source tree and strengthened typing boundaries.
- Unified assistant runtime and data flow through main-process orchestration and TanStack Query cache integration.
- Refined request layer contracts with explicit route mode, standardized requestId tracing, and clearer user-facing error mapping.
- Polished core UI surfaces (home, grades, assistant, sidebar, command menu) with consistent Chinese copy and clearer status language.

### Fixed

- Stabilized preload bridge behavior for Electron renderer communication.
- Restored assistant baseline chat behavior and reduced non-essential development log noise.
- Improved request reliability with tuned timeout/retry handling for unstable upstream KSU endpoints.

## 0.0.1 - 2026-02-27

### Added

- Electron desktop runtime with React + TypeScript UI integration.
- Assistant module with local conversation persistence and settings storage.
- KSU local MCP tool registry for user info, personal info, grades, and calendar queries.
- Cross-platform release pipeline via GitHub Actions for Windows, macOS, and Linux.
- In-app update status flow in Electron main process with IPC bridge.
- Top-right update action UI: download progress, retry, and `重启更新` action.
- Updater source definitions with primary GitHub and fallback EdgeOne proxy.
- Release distribution documentation for installer and updater metadata files.

### Changed

- Standardized request flow and logging in Electron main/request layers.
- Refined assistant chat UI with clearer message layout and tool activity states.
- Release workflow enforces changelog-driven notes and fails when version notes are missing.
- Release artifacts include updater metadata files (`.yml`, `.blockmap`) and installer assets.
- Installer-oriented packaging strategy retained for Windows (`nsis`), macOS (`dmg`), and Linux (`AppImage`).

### Fixed

- Resolved assistant message persistence transaction handling in SQLite store.
- Improved request timeout/error visibility for renderer and MCP tool calls.
