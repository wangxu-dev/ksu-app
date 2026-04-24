# Architecture

## Runtime Boundaries

- Electron main: orchestration, IPC, request dispatch, authentication, assistant runtime, update manager.
- Electron preload: minimal bridge only. No business logic.
- Renderer: route composition, page state, UI interaction, local presentation logic.

## Layering Rules

- `request`: generic transport model and request dispatch.
- `auth`: login lifecycle, token persistence, session validation.
- `ksu`: KSU-specific endpoint definitions and response normalization.
- `assistant`: assistant runtime, tool registry, conversation state, tool execution.

Dependency direction:

- Renderer pages/components -> renderer services/clients
- Renderer services/clients -> IPC channels
- Electron main handlers -> `request` / `auth` / `ksu` / `assistant`
- `assistant` tools -> `ksu` access only through registered tool handlers

## Current Entry Points

- Renderer app entry: `src/main.tsx`
- Router entry: `src/routes/*`
- Page containers: `src/pages/*`
- Electron app entry: `electron/main.ts`

## Current Risk Areas

### 1. Assistant has two execution paths

- Renderer path: `src/pages/assistant.tsx` creates the agent directly.
- Main path: `electron/assistant/runtime.ts` implements streamed assistant execution via IPC.

Risk:

- duplicate model/tool configuration
- duplicate system prompt logic
- divergent error handling and observability

Target:

- one assistant entry: `assistant.run(input, context)` in main
- renderer only triggers requests and renders progress/result state

### 2. KSU MCP tool definitions are duplicated

- `electron/assistant/ksu-mcp.ts`
- `electron/assistant/mcp/ksu-mcp.ts`

Risk:

- tool schema, cache policy, and business validation can drift

Target:

- one canonical tool registry
- both `listTools()` and runtime execution derive from the same definitions

### 3. Cache responsibilities are split across multiple layers

- React Query stale times in pages
- local persisted caches in renderer service modules
- MCP tool metadata includes cache policy but is not yet enforced centrally

Risk:

- duplicated TTL logic
- inconsistent invalidation
- difficult refresh semantics after login/logout

Target:

- React Query manages view-state cache
- tool/runtime cache is explicit and centralized in main
- shared TTL constants remain single-source

### 4. Some renderer modules still know KSU transport details

Current pattern:

- pages call KSU-facing functions directly
- renderer modules still reference endpoint names and transport assumptions

Target:

- renderer calls stable service/use-case APIs
- KSU endpoint details remain centralized in main-side KSU/request modules

## Refactor Guardrails

- Do not edit `src/routeTree.gen.ts`.
- Do not move business logic into preload.
- Do not delete seemingly-unused files until call sites and build references are verified.
- Prefer no-behavior-change refactors first.
- Any behavior-changing assistant architecture move is a decision point and must be confirmed before merge.
