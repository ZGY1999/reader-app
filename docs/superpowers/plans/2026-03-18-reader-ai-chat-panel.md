# Reader AI Chat Panel Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current AI drawer with an overlay chat panel and persist chapter-based AI topics and messages per book.

**Architecture:** Add local persistence for AI threads and messages in the existing SQL.js database, expose it through new IPC handlers, then refactor the reader to render a right-side overlay chat panel backed by the persisted thread/message model. Keep AI request behavior in the existing `AIHandler`, but move reader-side state from single-answer fields to thread/message collections.

**Tech Stack:** Electron, React, TypeScript, SQL.js, Vitest, Testing Library

---

## Chunk 1: Persistence And Backend Surface

### Task 1: Add AI chat schema

**Files:**
- Modify: `src/database/schema.sql`
- Test: `tests/main/index.test.ts`

- [ ] **Step 1: Write the failing test**

Extend `tests/main/index.test.ts` so the main process is expected to register AI thread/message IPC channels in addition to the existing AI status/ask handlers.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- --run tests/main/index.test.ts`
Expected: FAIL because the new IPC channel names are not registered yet.

- [ ] **Step 3: Add schema tables**

Add:
- `ai_threads`
- `ai_messages`

Include the fields defined in the approved spec and `ON DELETE CASCADE` book/thread relationships.

- [ ] **Step 4: Run targeted tests**

Run: `npm.cmd test -- --run tests/main/index.test.ts`
Expected: still FAIL, but schema change is in place for later steps.

- [ ] **Step 5: Commit**

Commit message: `feat: add ai chat schema`

### Task 2: Add backend persistence handler

**Files:**
- Create: `src/main/ipc/ai-chat.handler.ts`
- Create: `src/main/ipc/ai-chat.handler.test.ts`
- Modify: `src/database/sqlite.ts`

- [ ] **Step 1: Write the failing test**

Add `src/main/ipc/ai-chat.handler.test.ts` covering:
- list threads by book ordered by `updated_at`
- create a thread
- append user/assistant messages
- load thread messages
- update thread `updated_at`

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- --run src/main/ipc/ai-chat.handler.test.ts`
Expected: FAIL because handler does not exist.

- [ ] **Step 3: Implement minimal handler**

Create `AIChatHandler` with methods:
- `listThreads(bookId)`
- `createThread(...)`
- `listMessages(threadId)`
- `appendMessage(...)`
- `touchThread(threadId)`

Reuse the existing `Database` helper and call `db.save()` after writes.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd test -- --run src/main/ipc/ai-chat.handler.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

Commit message: `feat: add ai chat persistence handler`

### Task 3: Register IPC and preload types

**Files:**
- Modify: `src/main/index.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/preload/types.d.ts`
- Test: `tests/main/index.test.ts`
- Test: `tests/preload/index.test.ts`

- [ ] **Step 1: Write the failing tests**

Update:
- `tests/main/index.test.ts` to expect AI chat IPC channels
- `tests/preload/index.test.ts` to expect the new `aiChat` preload API surface

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm.cmd test -- --run tests/main/index.test.ts tests/preload/index.test.ts`
Expected: FAIL because IPC/preload surface does not expose `aiChat`.

- [ ] **Step 3: Implement IPC registration and preload bridge**

Register handlers for:
- `ai-chat:listThreads`
- `ai-chat:createThread`
- `ai-chat:listMessages`
- `ai-chat:appendMessage`
- `ai-chat:touchThread`

Expose them through `window.electronAPI.aiChat`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm.cmd test -- --run tests/main/index.test.ts tests/preload/index.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

Commit message: `feat: expose ai chat ipc surface`

## Chunk 2: Renderer API And Reader State

### Task 4: Add renderer API helpers for AI chat persistence

**Files:**
- Modify: `src/renderer/src/api.ts`
- Modify: `src/preload/types.d.ts`
- Create or modify types in `src/renderer/src/types.ts`
- Test: `tests/Reader.test.tsx`

- [ ] **Step 1: Write the failing test**

Update `tests/Reader.test.tsx` expectations so the mocked `window.electronAPI` includes AI chat APIs used by the reader.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- --run tests/Reader.test.tsx`
Expected: FAIL because the test mock and reader code are not aligned yet.

- [ ] **Step 3: Implement API types/helpers**

Add typed helpers for:
- listing threads
- creating thread
- listing messages
- appending message
- touching thread

- [ ] **Step 4: Run test to verify it passes or fails for the next missing reader behavior**

Run: `npm.cmd test -- --run tests/Reader.test.tsx`
Expected: either PASS for API-only changes or FAIL later for missing UI behavior.

- [ ] **Step 5: Commit**

Commit message: `refactor: add renderer ai chat api types`

### Task 5: Replace single-answer reader state with thread/message state

**Files:**
- Modify: `src/renderer/src/pages/Reader.tsx`
- Test: `tests/Reader.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add reader tests for:
- restoring latest thread on book open
- rendering chat history instead of one answer panel
- appending user and assistant messages
- preserving user message when AI request fails

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm.cmd test -- --run tests/Reader.test.tsx`
Expected: FAIL because `Reader.tsx` still uses transient `aiAnswer` state.

- [ ] **Step 3: Implement minimal reader chat state**

Replace transient fields with:
- `threads`
- `activeThreadId`
- `threadMessages`
- `composer text`
- `loading/error state`

Load threads/messages when opening the reader.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm.cmd test -- --run tests/Reader.test.tsx`
Expected: PASS for the covered chat-state behaviors.

- [ ] **Step 5: Commit**

Commit message: `feat: persist reader ai chat state`

## Chunk 3: Overlay Panel UX

### Task 6: Convert the AI drawer into an overlay panel

**Files:**
- Modify: `src/renderer/src/pages/Reader.tsx`
- Optionally create: `src/renderer/src/components/ReaderAIChatPanel.tsx`
- Test: `tests/Reader.test.tsx`

- [ ] **Step 1: Write the failing test**

Add a reader test asserting:
- opening AI does not shrink the reading content container width contract
- panel renders as an overlay container
- panel close/open behavior still works

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- --run tests/Reader.test.tsx`
Expected: FAIL because the current drawer still participates in layout width.

- [ ] **Step 3: Implement overlay panel**

Refactor layout so:
- reader content always keeps full flex width
- AI panel is absolutely positioned over the right side
- annotation toolbar offsets adapt to overlay presence

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm.cmd test -- --run tests/Reader.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

Commit message: `feat: render ai panel as reader overlay`

### Task 7: Render messages as chat bubbles with citations

**Files:**
- Modify: `src/renderer/src/pages/Reader.tsx`
- Optionally create: `src/renderer/src/components/ReaderAIChatPanel.tsx`
- Test: `tests/Reader.test.tsx`

- [ ] **Step 1: Write the failing test**

Add reader tests for:
- user messages rendering on the right
- assistant messages rendering on the left
- citations rendering under assistant messages
- empty-state rendering when no thread exists

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- --run tests/Reader.test.tsx`
Expected: FAIL because the old answer panel layout is still in place.

- [ ] **Step 3: Implement minimal chat presentation**

Render:
- chat bubbles
- citations as a message sub-block
- bottom composer
- quick prompt chips feeding the composer

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd test -- --run tests/Reader.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

Commit message: `feat: render ai responses as chat conversation`

## Chunk 4: Topic Rules

### Task 8: Implement chapter-based topic creation and switching

**Files:**
- Modify: `src/renderer/src/pages/Reader.tsx`
- Modify: `src/main/ipc/ai-chat.handler.ts`
- Test: `tests/Reader.test.tsx`
- Test: `src/main/ipc/ai-chat.handler.test.ts`

- [ ] **Step 1: Write the failing tests**

Cover:
- first question in a new chapter creates a new thread
- same-chapter follow-up reuses the active thread
- manually selected older thread remains active for continued questions

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm.cmd test -- --run tests/Reader.test.tsx src/main/ipc/ai-chat.handler.test.ts`
Expected: FAIL because thread routing rules are not implemented.

- [ ] **Step 3: Implement topic resolution logic**

Add a small resolver in the reader:
- derive current chapter context
- reuse active thread when appropriate
- auto-create thread for the current chapter on first ask

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm.cmd test -- --run tests/Reader.test.tsx src/main/ipc/ai-chat.handler.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

Commit message: `feat: add chapter-based ai topics`

## Chunk 5: Final Verification

### Task 9: Run regression suite and launch app

**Files:**
- Verify existing files only

- [ ] **Step 1: Run focused regression suite**

Run: `npm.cmd test -- --run src/main/ipc/ai-chat.handler.test.ts tests/main/index.test.ts tests/preload/index.test.ts tests/Reader.test.tsx src/renderer/src/components/PdfDocumentView.test.tsx src/renderer/src/utils/pdfjs-runtime.test.ts tests/pdf-parser.test.ts`
Expected: PASS

- [ ] **Step 2: Launch the app**

Run: `cmd /c start-reader.cmd`
Expected: Electron opens with the overlay AI panel behavior available for manual validation.

- [ ] **Step 3: Confirm no obvious regressions**

Manually check:
- PDF reading still works
- AI panel overlays instead of shrinking content
- chat history persists after reopening the same book

- [ ] **Step 4: Commit final integration**

Commit message: `feat: ship persistent reader ai chat overlay`
