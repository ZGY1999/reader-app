# Legacy TTS Cleanup Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove legacy TTS UI and IPC paths so the app only exposes the v0.4 public reading flow.

**Architecture:** Keep `tts:synthesize + HTMLAudio` as the only shipped TTS path. Delete the old renderer `components/Reader` path, remove `player:*` / `highlight:*` IPC registration, and drop compatibility types that only existed to keep dead code compiling.

**Tech Stack:** Electron, React, TypeScript, Vitest

---

## Files

- Modify: `tests/main/index.test.ts`
- Delete: `src/renderer/src/components/Reader.tsx`
- Delete: `src/renderer/src/components/Reader.test.tsx`
- Modify: `src/main/index.ts`
- Modify: `src/preload/types.d.ts`
- Modify: `DEVELOPMENT.md`
- Modify: `README.md`

## Tasks

### Task 1: Lock removal behavior with tests
- [x] Strengthen main-process test so legacy `player:*` and `highlight:*` handlers are not part of the registered surface.
- [x] Run the focused test and confirm it fails before implementation.

### Task 2: Remove dead renderer and main IPC paths
- [x] Delete the old renderer-only `components/Reader` implementation and its test.
- [x] Remove legacy player/highlight services from `src/main/index.ts`.
- [x] Remove compatibility types from `src/preload/types.d.ts`.
- [x] Run focused tests until green.

### Task 3: Re-verify and align docs
- [x] Update docs to describe the single TTS path.
- [x] Run full verification: focused removal tests, full test coverage, `npm run build`, `npm run build:electron`.
- [x] Commit once the worktree is clean.
