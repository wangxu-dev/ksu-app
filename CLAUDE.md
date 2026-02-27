# CLAUDE.md

This file provides implementation guidance for Claude Code.

## Role

- Project owner makes product decisions.
- Claude Code makes concrete technical implementation under those decisions.

## Project Scope

Ksu-App is an Electron desktop app with a built-in AI assistant.

### Core stack

- Electron
- React 19 + TypeScript
- TanStack Router (file-based)
- Tailwind CSS v4

## AI Dialogue Development Guide

### Target architecture

- Main process hosts assistant runtime.
- Assistant uses internal tools through a single registry.
- Tool calls are function-contract based (schema-first).

### Required behavior

1. Parse user request.
2. Decide tool plan.
3. Execute tools with typed arguments.
4. Return answer with concise tool-result grounding.
5. Propagate typed errors without swallowing details.

### Tool contract template

- `name`
- `description`
- `inputSchema`
- `outputSchema`
- `execute(input, ctx)`
- `cacheTtlMs`
- `errorMap`

### First tool set

- `get_user_info`
- `get_personal_info`
- `get_grades`
- `get_calendar`

## Engineering Rules

- Keep endpoint construction centralized.
- Keep request/session behavior consistent across assistant and UI paths.
- Keep modules separated by layer: `request`, `ksu`, `assistant/tools`.
- Never manually edit `src/routeTree.gen.ts`.

## Collaboration Notes (Owner Preferences)

- Keep implementation pragmatic and directly executable.
- Avoid mixing concerns; especially keep preload/bridge as a thin IPC surface only.
- Prefer explicit architecture boundaries over convenience shortcuts.
- Deliver in small, testable increments and keep commits scoped.
- Run formatting, linting, and type checks before handoff.
- Do not hide runtime failures: preserve actionable debug logs and error context.
- UI should stay clean and minimal; internal tool mechanics should not leak into normal user-facing output.

## Commands

```bash
npm run electron:dev
npm run format
npm run lint
npm run typecheck
npm run electron:build
```
