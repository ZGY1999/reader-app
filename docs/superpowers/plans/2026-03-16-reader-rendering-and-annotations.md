# Reader Rendering and Annotation Fixes Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix PDF page rendering, correct TXT annotation offsets, and add full EPUB annotation support without regressing existing reader flows.

**Architecture:** Keep the current Electron main/preload/React structure, but fix the renderer-side selection and rendering boundaries. TXT and EPUB should both compute stable text offsets relative to the rendered chapter container and reuse the existing annotation persistence model; PDF should stop relying on `iframe file://...` and render pages through `pdfjs-dist` directly in the renderer.

**Tech Stack:** Electron, React, TypeScript, Vitest, Testing Library, pdfjs-dist

---

## File Structure Lock-In

- Modify: `src/renderer/src/components/TextRenderer.tsx`
  - Compute stable selection offsets from the rendered container and render annotations without text corruption.
- Modify: `src/renderer/src/components/TextRenderer.test.tsx`
  - Cover offset calculation and annotation rendering edge cases.
- Modify: `src/renderer/src/components/RichContentRenderer.tsx`
  - Support rich-content selection, annotation rendering, and existing annotation interaction for EPUB.
- Create: `src/renderer/src/components/RichContentRenderer.test.tsx`
  - Cover EPUB annotation rendering and selection behavior.
- Modify: `src/renderer/src/components/PdfDocumentView.tsx`
  - Replace `iframe` rendering with `pdfjs-dist` page rendering.
- Create: `src/renderer/src/components/PdfDocumentView.test.tsx`
  - Cover PDF load, page render, and error state behavior.
- Modify: `src/renderer/src/pages/Reader.tsx`
  - Enable EPUB annotations, keep TXT offsets aligned, and preserve sidebar/jump/delete flows across TXT and EPUB.
- Modify: `tests/Reader.test.tsx`
  - Lock the reader-level regression behavior for TXT, EPUB, and PDF.

---

## Chunk 1: TXT Offset Integrity

### Task 1: Reproduce TXT annotation offset corruption in tests

**Files:**
- Modify: `src/renderer/src/components/TextRenderer.test.tsx`
- Modify: `tests/Reader.test.tsx`
- Test: `src/renderer/src/components/TextRenderer.test.tsx`, `tests/Reader.test.tsx`

- [ ] **Step 1: Write a failing renderer-level test for multi-node selection offset calculation**

Add a test that simulates a selection spanning text split across sibling nodes and expects the selection callback to receive offsets relative to the full rendered chapter text.

- [ ] **Step 2: Write a failing reader-level regression test for creating a second TXT annotation after one already exists**

Lock behavior so the second annotation stores the newly selected text only and does not duplicate unrelated text from elsewhere in the chapter.

- [ ] **Step 3: Run the focused tests to verify they fail for the expected reason**

Run:

```bash
npm.cmd test -- --run src/renderer/src/components/TextRenderer.test.tsx tests/Reader.test.tsx
```

Expected: FAIL because `TextRenderer` uses `Range.startOffset/endOffset` directly.

- [ ] **Step 4: Implement the minimal fix**

Compute selection offsets by cloning a prefix range from the chapter container start to the selection start, then use the resulting text length as the stable offset basis.

- [ ] **Step 5: Run the focused tests again**

Run:

```bash
npm.cmd test -- --run src/renderer/src/components/TextRenderer.test.tsx tests/Reader.test.tsx
```

Expected: PASS.

---

## Chunk 2: PDF Page Rendering

### Task 2: Replace `iframe` PDF rendering with `pdfjs-dist`

**Files:**
- Modify: `src/renderer/src/components/PdfDocumentView.tsx`
- Create: `src/renderer/src/components/PdfDocumentView.test.tsx`
- Modify: `tests/Reader.test.tsx`
- Test: `src/renderer/src/components/PdfDocumentView.test.tsx`, `tests/Reader.test.tsx`

- [ ] **Step 1: Write failing PDF component tests**

Cover:
- loading a page through `pdfjs-dist`
- rendering a canvas for the active page
- showing a visible error message when rendering fails

- [ ] **Step 2: Run the PDF-focused tests to verify failure**

Run:

```bash
npm.cmd test -- --run src/renderer/src/components/PdfDocumentView.test.tsx tests/Reader.test.tsx
```

Expected: FAIL because the component still renders an `iframe`.

- [ ] **Step 3: Implement the minimal `pdfjs-dist` renderer**

Load the document once per file path, render the active page into a canvas, cancel stale work when page/file changes, and expose a readable loading/error state.

- [ ] **Step 4: Run the PDF-focused tests again**

Run:

```bash
npm.cmd test -- --run src/renderer/src/components/PdfDocumentView.test.tsx tests/Reader.test.tsx
```

Expected: PASS.

---

## Chunk 3: Full EPUB Annotation Closure

### Task 3: Add rich-content annotation rendering and interaction

**Files:**
- Modify: `src/renderer/src/components/RichContentRenderer.tsx`
- Create: `src/renderer/src/components/RichContentRenderer.test.tsx`
- Modify: `src/renderer/src/pages/Reader.tsx`
- Modify: `tests/Reader.test.tsx`
- Test: `src/renderer/src/components/RichContentRenderer.test.tsx`, `tests/Reader.test.tsx`

- [ ] **Step 1: Write failing rich-content tests**

Cover:
- creating a selection from rendered EPUB markup
- rendering saved annotations back into the EPUB chapter
- clicking an existing EPUB annotation to activate it

- [ ] **Step 2: Write failing reader-level EPUB tests**

Cover:
- EPUB selection toolbar enables annotation actions
- created EPUB annotations show in the sidebar and the chapter body
- sidebar jump/delete work for EPUB annotations

- [ ] **Step 3: Run the EPUB-focused tests to verify failure**

Run:

```bash
npm.cmd test -- --run src/renderer/src/components/RichContentRenderer.test.tsx tests/Reader.test.tsx
```

Expected: FAIL because EPUB annotation actions are disabled and rich markup does not re-render saved annotations.

- [ ] **Step 4: Implement the minimal EPUB closure**

Update `Reader.tsx` to enable annotations for EPUB, pass chapter annotations into `RichContentRenderer`, and keep existing create/select/jump/delete flows shared with TXT where possible.

Update `RichContentRenderer.tsx` to:
- compute stable offsets relative to the rendered chapter container
- wrap annotated text ranges in styled markers without breaking the surrounding markup more than necessary
- emit annotation selection callbacks on click

- [ ] **Step 5: Run the EPUB-focused tests again**

Run:

```bash
npm.cmd test -- --run src/renderer/src/components/RichContentRenderer.test.tsx tests/Reader.test.tsx
```

Expected: PASS.

---

## Chunk 4: Verification

### Task 4: Run focused and broad verification

**Files:**
- Modify: none unless fixes are required
- Test: all touched files

- [ ] **Step 1: Run the focused reader/component tests**

Run:

```bash
npm.cmd test -- --run src/renderer/src/components/TextRenderer.test.tsx src/renderer/src/components/RichContentRenderer.test.tsx src/renderer/src/components/PdfDocumentView.test.tsx tests/Reader.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run supporting regression tests**

Run:

```bash
npm.cmd test -- --run tests/Bookshelf.test.tsx tests/reading-flow.test.tsx tests/settings-flow.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Run the full suite if focused tests are clean**

Run:

```bash
npm.cmd test -- --run
```

Expected: PASS, or document any unrelated pre-existing failures explicitly.

- [ ] **Step 4: Capture remaining risks**

Record any unresolved PDF fidelity or EPUB complex-markup limitations before claiming completion.

---

Plan complete and saved to `docs/superpowers/plans/2026-03-16-reader-rendering-and-annotations.md`. Ready to execute.
