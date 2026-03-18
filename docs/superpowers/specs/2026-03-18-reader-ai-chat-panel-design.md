# Reader AI Chat Panel Design

Date: 2026-03-18
Branch: `feat/v0.1-reading-foundation`
Status: Proposed, approved for planning

## Goal

Replace the current right-side "AI 问书" drawer with a WeRead-like overlay chat panel that:

- overlays the reading area instead of shrinking it
- persists AI conversations locally
- groups conversations into lightweight chapter-based topics
- keeps one topic per chapter unless the user explicitly switches to an older topic

This design is scoped to the reader UI and local persistence only. It does not redesign the AI backend itself.

## Current Problems

1. The current AI drawer takes layout width from the reading area.
   The reading content can no longer reach the far right edge, and the drawer leaves visual gaps that do not match the expected WeRead-style interaction.

2. The current AI UI is a single answer panel, not a conversation.
   The user cannot see an ongoing thread of question/answer turns.

3. There is no durable topic model.
   AI answers are transient reader state rather than persisted per-book discussion history.

## User-Approved Direction

The approved direction is:

- overlay chat panel on top of the reading area
- lightweight topic management
- persistent local storage
- automatic topic creation when the user asks the first question in a different chapter
- continued follow-up questions in the same chapter stay in the same topic
- user questions and AI answers render as a chat stream

The user explicitly chose:

- persistent saved history
- chapter-based automatic topic creation
- same-chapter follow-ups stay in the same topic

## UX Design

### Layout

The reader remains the primary layout container. The AI panel becomes an overlay element anchored to the right edge of the reading viewport.

Behavior:

- Opening the AI panel does not reduce the width of the reading content.
- The reading surface remains scrollable at full width.
- The panel visually sits above the content with its own background, border, and shadow.
- The panel width is fixed in the 360-400px range.
- The panel height stretches from near the top toolbar to above the footer, matching the visible reading canvas.

### Panel Structure

Top to bottom:

1. Header
   - title: `AI 问书`
   - current book title
   - current chapter / page context
   - close button

2. Lightweight topic strip
   - shows current active topic
   - shows a small recent-topic switcher
   - does not introduce a heavy secondary navigation pane in v1

3. Chat stream
   - user messages on the right
   - AI messages on the left
   - AI citations rendered as attached reference blocks within the AI message
   - error states rendered inline as failed assistant/system blocks

4. Composer
   - quick prompt chips
   - multiline input
   - send button
   - reused for follow-up questions in the active topic

### Topic Model in the UI

The panel exposes topics lightly rather than as a full thread manager.

Rules:

- Each book can have multiple AI topics.
- A topic belongs to the chapter where it was created.
- The first question asked in a chapter creates a topic for that chapter if one does not already exist for the current flow.
- Additional follow-up questions in the same chapter continue in the active topic.
- If the user manually switches to an older topic, new questions continue in that selected topic until the user changes again.

### Source Context

Each user message carries the reading context used for that turn:

- selected text
- selected annotation
- current chapter fallback

This context is stored with the message so past chat history can be understood without re-fetching transient reader state.

## Data Model

Two new tables are introduced.

### `ai_threads`

Purpose: lightweight per-book conversation topics.

Fields:

- `id`
- `book_id`
- `chapter_id`
- `chapter_title`
- `title`
- `created_at`
- `updated_at`

Notes:

- `title` is auto-generated in v1, for example `第 1 章 · 估值倍数`.
- No manual rename support in v1.

### `ai_messages`

Purpose: store the ordered chat transcript.

Fields:

- `id`
- `thread_id`
- `book_id`
- `role`
- `text`
- `source_type`
- `source_text`
- `chapter_id`
- `chapter_title`
- `citations_json`
- `created_at`

Notes:

- `role` is expected to be `user`, `assistant`, or `system`.
- `citations_json` stores the serialized citations returned by the AI layer.
- `source_text` stores the exact text context sent for that turn.

## Behavior Rules

### Opening the Reader

- Load recent topics for the current book.
- Restore the most recently updated topic if one exists.
- If no topic exists, show an empty-state chat panel.

### Creating a Topic

- When the user sends a question and there is no active suitable topic for the current chapter, create a new topic.
- Topic creation is automatic; there is no explicit "new topic" button in v1.

### Reusing a Topic

- If the active topic belongs to the same chapter, append to it.
- If the user manually selected an older topic, continue appending there.

### Switching Topics

- Switching topics only changes the panel content.
- It does not move the reading viewport.
- It does not discard pending reading selection.

### Error Handling

- If the AI request fails, keep all existing thread history visible.
- If the user message has already been persisted, keep it.
- Add a failed assistant/system message instead of clearing the panel.
- If AI is not configured, history remains readable and the composer explains that configuration is required.

## Architecture Changes

### Main Process

Add new IPC handlers for:

- listing threads by book
- getting messages for a thread
- creating or resolving the active thread for a chapter
- appending messages

### Database Layer

Add migration(s) for `ai_threads` and `ai_messages`.

Add a repository or handler abstraction dedicated to AI chat persistence rather than mixing it into generic reader UI state.

### Renderer

Refactor `Reader.tsx` so AI UI state is no longer a single `aiAnswer` block.

Introduce view state for:

- thread list
- active thread id
- message list
- composer state
- loading and inline error states

The existing "tools drawer" state should be renamed conceptually into an overlay panel state because it no longer participates in page width calculation.

## Testing Strategy

### Reader Tests

Add tests for:

- overlay panel rendering without shrinking the reading area
- restoring the latest thread when opening a book
- showing chat messages in order
- same-chapter follow-up appending to the same topic
- first question in a different chapter creating a new topic
- manual thread switching
- failed AI request preserving prior conversation

### Persistence Tests

Add tests for:

- thread creation
- thread ordering by `updated_at`
- message insertion and retrieval
- citation serialization/deserialization

### Regression Coverage

Retain existing reader and PDF tests to ensure the UI refactor does not regress:

- PDF overlay rendering
- selection handling
- annotation workflow

## Out of Scope

This design does not include:

- topic rename
- topic deletion
- search across threads
- streaming token-by-token UI
- cross-book AI workspace
- automatic summary generation for topics

## Implementation Notes

This should be implemented incrementally:

1. persistence tables and IPC
2. reader overlay conversion
3. chat stream rendering
4. chapter-based topic creation rules
5. regression hardening

The first implementation should prefer small, reversible steps because `Reader.tsx` already carries multiple responsibilities.
