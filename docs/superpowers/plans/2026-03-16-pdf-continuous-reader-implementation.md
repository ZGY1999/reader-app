# PDF Continuous Reader Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn PDF reading into a continuous, EPUB-like reading experience with TOC generation, text selection, annotations, TTS, and AI support.

**Architecture:** Cache one loaded PDF document per open PDF book, render pages through a virtualized continuous page list, overlay text layers for selection-based tools, and generate TOC entries from native outline plus heuristic title detection. Reuse the existing reader toolchain wherever possible instead of creating PDF-only side systems.

**Tech Stack:** Electron, React, TypeScript, pdfjs-dist, Vitest, existing reader annotation/TTS/AI flows

---

## Chunk 1: PDF View Runtime

### Task 1: Stabilize PDF document lifecycle

**Files:**
- Modify: `src/renderer/src/components/PdfDocumentView.tsx`
- Test: `src/renderer/src/components/PdfDocumentView.test.tsx`

- [ ] Write failing tests that prove the PDF document is loaded once and page changes reuse the same loaded document.
- [ ] Run: `npm.cmd test -- --run src/renderer/src/components/PdfDocumentView.test.tsx`
- [ ] Implement cached document loading, cloned byte input, and per-page render reuse.
- [ ] Re-run: `npm.cmd test -- --run src/renderer/src/components/PdfDocumentView.test.tsx`

### Task 2: Add text layer rendering

**Files:**
- Modify: `src/renderer/src/components/PdfDocumentView.tsx`
- Create or modify: `src/renderer/src/components/PdfTextLayer*.tsx` if needed
- Test: `src/renderer/src/components/PdfDocumentView.test.tsx`

- [ ] Write failing tests for page text layer rendering and selectable text availability.
- [ ] Run the focused PDF component tests and confirm failure for the missing text layer.
- [ ] Implement text layer generation using pdf.js text content on each visible page.
- [ ] Re-run focused PDF component tests until green.

## Chunk 2: Reader Integration

### Task 3: Replace single-page PDF mode with continuous scroll mode

**Files:**
- Modify: `src/renderer/src/pages/Reader.tsx`
- Modify: `src/renderer/src/types.ts`
- Test: `tests/Reader.test.tsx`

- [ ] Write failing reader tests for continuous PDF body rendering, scroll-based current section tracking, and TOC highlight synchronization.
- [ ] Run: `npm.cmd test -- --run tests/Reader.test.tsx`
- [ ] Implement continuous PDF page list with viewport-near rendering / virtualization and footer progress integration.
- [ ] Re-run reader tests until green.

### Task 4: Enable PDF selection tools

**Files:**
- Modify: `src/renderer/src/pages/Reader.tsx`
- Modify: `src/renderer/src/components/PdfDocumentView.tsx`
- Test: `tests/Reader.test.tsx`

- [ ] Write failing tests for PDF selection toolbar, annotation creation, TTS selection, and AI context selection.
- [ ] Run the targeted reader tests and confirm failure.
- [ ] Wire PDF selection payloads into the existing annotation / TTS / AI handlers.
- [ ] Re-run the targeted reader tests until green.

## Chunk 3: TOC Generation

### Task 5: Generate PDF TOC from outline or heuristic headings

**Files:**
- Modify: `src/services/book-parser/pdf.parser.ts`
- Modify: `src/services/book-parser/types.ts` if needed
- Create or modify: `src/services/book-parser/pdf-outline*.ts` if needed
- Test: `tests/pdf-parser.test.ts`

- [ ] Write failing parser tests for native outline support and heuristic heading fallback when outline is absent.
- [ ] Run: `npm.cmd test -- --run tests/pdf-parser.test.ts`
- [ ] Implement outline extraction and heuristic heading inference that produces meaningful chapter entries instead of `Page N`.
- [ ] Re-run parser tests until green.

### Task 6: Connect generated TOC to continuous reader navigation

**Files:**
- Modify: `src/renderer/src/pages/Reader.tsx`
- Test: `tests/Reader.test.tsx`

- [ ] Write failing tests for TOC click-to-scroll and scroll-to-TOC synchronization using generated PDF chapter entries.
- [ ] Run the targeted reader tests and confirm failure.
- [ ] Implement TOC mapping from generated PDF chapters to page positions in the continuous reader.
- [ ] Re-run reader tests until green.

## Chunk 4: Verification

### Task 7: Run regression coverage

**Files:**
- No code changes expected

- [ ] Run: `npm.cmd test -- --run src/renderer/src/utils/pdfjs-runtime.test.ts tests/preload/index.test.ts tests/main/index.test.ts src/renderer/src/components/PdfDocumentView.test.tsx tests/Reader.test.tsx tests/pdf-parser.test.ts tests/electron-runtime.test.ts`
- [ ] Run: `npm.cmd run build`
- [ ] If failures appear, fix them before stopping.
