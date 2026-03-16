# PDF Continuous Reader Design

**Goal:** Upgrade PDF reading from a single-page canvas viewer into an EPUB-like continuous reading experience with usable PDF text selection, annotation, TTS, AI context, and generated TOC.

**Problem Summary:**
- Current PDF reading behaves like a page image viewer instead of a reading surface.
- Only the first page renders reliably because the view reloads the document on page changes.
- PDF pages have no text layer, so annotation, TTS, and AI selection cannot work.
- TOC is currently synthetic `Page N` output from the parser and does not reflect book structure.

## Design

### 1. Continuous PDF Reading Surface

Replace the current single-page PDF surface with a vertically scrollable page list. The reader should feel like EPUB: scroll the body continuously, let the footer progress update from scroll position, and keep the sidebar TOC synchronized with the visible section.

To keep performance stable, render only pages near the viewport and use spacer heights for far-away pages. The user sees a continuous document, but the renderer only paints a moving window of pages.

### 2. Cached PDF Document + Per-Page Render State

Load the PDF document once per book load and reuse the same `PDFDocumentProxy` for page rendering. Each page component should request `getPage(pageNumber)` from the cached document and render independently. Page changes must not re-run `getDocument(...)`.

This removes the current first-page-only behavior and substantially improves first-open and page-switch latency.

### 3. Text Layer for Selection-Based Tools

Each rendered PDF page should contain:
- a `canvas` layer for visual fidelity
- a `text layer` for selectable text

The text layer becomes the integration point for:
- highlight / underline annotations
- selection toolbar
- TTS selection
- AI “ask about selected text”

Annotation coordinates should be anchored to page number plus page-local text offsets so they can be restored after rerendering.

### 4. TOC Strategy

TOC should resolve in this order:
1. Native PDF outline/bookmarks if available.
2. Heuristic chapter detection from extracted page text if no outline exists.
3. `Page N` fallback only if no reasonable structure can be inferred.

The heuristic layer should prioritize heading-like candidates using:
- common chapter/title patterns (`第X章`, numbered headings, all-caps/short title lines, etc.)
- page position and line prominence
- uniqueness and density filters to avoid noisy body text entries

### 5. Integration with Existing Reader Tools

PDF should participate in the same reader toolchain as EPUB/TXT:
- selection toolbar appears on valid PDF text selections
- annotations are persisted and restorable
- TTS and AI consume current selection / current section context
- sidebar jump scrolls into the continuous PDF body, not a separate page switch action

## Risks

- PDF text extraction quality varies by source file; heuristics must degrade gracefully.
- Large PDFs require virtualization to avoid blowing up DOM and memory.
- Annotation restore for PDF must be page-aware; text layer DOM is less stable than TXT/EPUB DOM.

## Testing Strategy

- Unit tests for PDF view caching and page reuse
- Unit tests for TOC fallback logic
- Reader integration tests for continuous scroll + TOC sync
- Regression tests for PDF selection tools becoming enabled
