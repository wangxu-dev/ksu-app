# Ksu-App

Ksu-App is a desktop campus portal for Kashgar University, now running on **Electron + React + TypeScript**.

## Current Direction

- Desktop runtime: Electron
- UI: React + TanStack Router + Tailwind CSS v4
- Request pipeline: Main-process dispatcher + session-based requester
- AI direction: built-in assistant with internal MCP-style tools

## Development

```bash
npm run electron:dev
```

## Quality Checks

```bash
npm run format
npm run lint
npm run typecheck
```

## Build

```bash
npm run electron:build
```
