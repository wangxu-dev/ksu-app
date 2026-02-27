# AGENTS.md

This file defines collaboration rules for coding agents in this repository.

## Runtime & Stack

- Runtime: Electron
- UI: React 19 + TypeScript + TanStack Router
- Styling: Tailwind CSS v4
- Package manager: npm

## Execution Boundaries

- Main process: orchestration, IPC, request dispatch, assistant runtime.
- Renderer process: view layer and interaction only.
- Network definitions for KSU endpoints must be centralized.

## AI Dialogue System Rules

- Assistant entry is unified: `assistant.run(input, context)`.
- Assistant never calls page-level API code directly.
- Assistant can only access data via registered tools.
- Every tool must define:
  - stable input schema
  - stable output schema
  - error codes
  - cache policy

## Initial Tool Scope

- `get_user_info`
- `get_personal_info`
- `get_grades`
- `get_calendar`

## Development Quality Gate

```bash
npm run format
npm run lint
npm run typecheck
```

## Constraints

- Do not hand-edit `src/routeTree.gen.ts`.
- Keep layering strict: `request` / `auth` / `ksu` / `assistant`.
- Keep all assistant/tool types in TypeScript.

## Collaboration Preferences (Project Owner)

- Prioritize practical, stable delivery over theory-only proposals.
- Keep bridge/preload minimal: no business logic in bridge code.
- Enforce explicit decoupling and clear module boundaries.
- Prefer small, verifiable batches with clear commit boundaries.
- Always validate with `format/lint/typecheck` before shipping.
- Avoid over-design and avoid hidden technical debt.
- Keep logs explicit and useful during debugging; do not suppress root-cause signals.
- Keep UX behavior predictable: clear statuses, no noisy internal implementation details in final UI.
