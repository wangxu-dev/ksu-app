# Refactor Plan

## Goal

Reduce duplicated assistant/request/cache logic without introducing behavior regressions.

## Phase 1: Safe Documentation And Boundary Lock-In

Status: ready to execute

Tasks:

- document current runtime boundaries and layering rules
- record known duplicate implementations and why they are risky
- define refactor guardrails so cleanup does not delete intentional code by mistake

Expected impact:

- no runtime behavior change
- shared understanding before code movement

## Phase 2: Assistant Contract Consolidation

Status: requires decision before implementation

Tasks:

- choose the canonical assistant execution path
- move toward one assistant entry in main
- remove duplicated prompt/model/tool declarations
- make tool registration single-source

Decision required:

- confirm whether renderer-side direct agent execution is legacy and can be phased out

## Phase 3: Tool Registry And Cache Execution

Status: low-to-medium risk after Phase 2 decision

Tasks:

- build one canonical KSU tool registry
- enforce `inputSchema`, `outputSchema`, `errorCodes`, and `cachePolicy`
- add real cache execution for tool calls
- return tool metadata such as `cached`, `cacheScope`, and `fetchedAt`

Expected impact:

- assistant calls become observable and repeatable
- MCP cache policy becomes real behavior instead of documentation-only metadata

## Phase 4: Renderer Data Access Cleanup

Status: medium risk

Tasks:

- reduce direct KSU transport knowledge in renderer modules
- prefer service/use-case APIs over page-level endpoint calls
- audit wrapper modules that add no value and either repurpose or remove them

Decision required:

- confirm whether renderer-side KSU API helpers remain an approved compatibility layer or should move behind service modules only

## Phase 5: Cache Policy Unification

Status: medium risk

Tasks:

- make one TTL source authoritative
- separate UI cache from tool/runtime cache responsibilities
- define invalidation on login, logout, and force refresh

Expected impact:

- predictable cache freshness
- fewer duplicate refresh rules across pages and assistant tools

## Execution Order

1. complete Phase 1 immediately
2. discuss and confirm Phase 2 decision
3. implement tool registry consolidation
4. implement real tool caching
5. clean renderer access patterns

## Current Decision Points For Review

1. Assistant canonical path:
   keep both temporarily, or converge to main-only runtime
2. Renderer KSU APIs:
   retain as compatibility facade, or gradually replace with service/use-case modules
3. Legacy entry cleanup:
   when to remove old entrypoints and wrappers after usage is fully verified
