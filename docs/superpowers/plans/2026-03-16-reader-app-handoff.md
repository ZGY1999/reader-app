# Reader App Handoff - 2026-03-16

## Workspace

- Repository: `D:\Code\reader-app`
- Active worktree: `D:\Code\reader-app\.worktrees\feat-v0.1-reading-foundation`
- Active branch: `feat/v0.1-reading-foundation`
- Startup script: `start-reader.cmd`

## Current Product State

- `TXT` reading path is still the most complete:
  - selection toolbar
  - annotations
  - AI ask-from-selection
  - renderer-side TTS via `speechSynthesis`
- `EPUB` now renders rich markup instead of flattening everything to plain text.
- `PDF` is rendered via a dedicated page viewer, not the old plain-text reading path.
- Right drawer is `AI-only`.
- TTS is no longer shown inside the AI drawer.

## What Was Fixed Today

### 1. PDF import failure in Electron

Root cause:
- `pdfjs-dist@5` expects `process.getBuiltinModule` to exist so it can polyfill `DOMMatrix`/`ImageData`/`Path2D`.
- Electron 28 ships Node 18, which does not expose that API.
- Result in real app: `DOMMatrix is not defined`.

Fix:
- In `src/services/book-parser/pdf.parser.ts`, before importing `pdfjs-dist`, patch `process.getBuiltinModule` to `require(...)` when missing.

### 2. EPUB images not showing

Root cause:
- EPUB markup sanitizer matched `data-src="..."` instead of the real `src="images/..."`
- Local images were therefore left as relative paths instead of being inlined.

Fix:
- In `src/services/book-parser/epub.parser.ts`, tighten the `<img ... src="...">` regex so only the real `src` attribute is transformed.
- Verified against the user's actual EPUB file: chapter `"案例一 哈德逊通用"` now contains `src="data:image/..."` instead of `src="images/..."`

### 3. EPUB rich-content selection did not open the toolbar

Root cause:
- `RichContentRenderer` used `dangerouslySetInnerHTML` only, with no selection capture path.

Fix:
- `src/renderer/src/components/RichContentRenderer.tsx` now:
  - listens for `mouseUp`
  - computes selection offsets relative to the chapter container
  - forwards selection rect/text/start/end back to `Reader`

### 4. Rich EPUB selection should not mislead users about annotations

Current behavior:
- Rich EPUB selection now opens the floating toolbar.
- Non-`TXT` annotation actions are disabled in the toolbar.
- `AI问书` and `朗读` remain usable from selection.

Files:
- `src/renderer/src/components/AnnotationToolbar.tsx`
- `src/renderer/src/pages/Reader.tsx`

## Tests Added/Updated Today

- `src/services/book-parser/epub.parser.test.ts`
  - verifies local EPUB images are inlined as `data:image/...`
- `tests/pdf-parser-electron-compat.test.ts`
  - verifies PDF parsing still works when `process.getBuiltinModule` is unavailable
- `tests/Reader.test.tsx`
  - verifies rich EPUB selection opens the floating toolbar

## Verification Completed

These passed after the fixes:

```powershell
npm run build
npm run build:electron
npm test -- --run src/services/book-parser/epub.parser.test.ts tests/pdf-parser-electron-compat.test.ts tests/Reader.test.tsx
npm test -- --run tests/Reader.test.tsx tests/Bookshelf.test.tsx --reporter=basic
npm test -- --run tests/electron-runtime.test.ts --reporter=basic
```

Notes:
- PDF parser tests still emit `standardFontDataUrl` warnings from `pdfjs-dist`, but the relevant tests pass.
- App was started successfully after rebuild.

## User-Reported Issues Resolved Today

- EPUB images not showing
- EPUB selection not opening the toolbar
- PDF import throwing `DOMMatrix is not defined`
- AI drawer incorrectly containing TTS

## 2026-03-17 PDF Follow-up

The work did continue after the original 2026-03-16 handoff. This is the latest state the next AI should trust.

### What changed on 2026-03-17

Files touched:
- `src/renderer/src/components/PdfDocumentView.tsx`
- `src/renderer/src/components/pdf-view.css`
- `src/renderer/src/pages/Reader.tsx`
- `src/renderer/src/components/TextRenderer.tsx`
- `src/renderer/src/components/RichContentRenderer.tsx`
- `src/renderer/src/components/PdfDocumentView.test.tsx`

Key changes made:
- PDF annotation/selection overlays no longer grab pointer events, to reduce drag-to-select failures.
- PDF selection offsets no longer depend on brittle DOM boundary guessing alone:
  - start/end are derived from prefix `Range` text lengths
  - this was intended to fix off-by-one behavior at later text nodes / element boundaries
- Pending PDF selection now carries real `client rects` from the actual selection, so the viewer can render selection feedback from real geometry instead of fully reconstructing it from offsets.
- PDF overlay rendering now:
  - merges nearby rects on the same line
  - uses wider right-side padding
  - distinguishes drag-time preview vs post-mouseup confirmed selection styling
- Reader scroll persistence is now debounced, which improved PDF smoothness.
- PDF initial visible page/overscan work was reduced slightly for performance.

### Verification completed after the 2026-03-17 changes

These passed:

```powershell
npm test -- --run src/renderer/src/components/PdfDocumentView.test.tsx
npm test -- --run tests/Reader.test.tsx
npm run build
```

### Important real-app feedback from the user after those fixes

This is the most important part for the next AI:

- `PDF selection no longer frequently fails`
- `PDF performance feels better / smoother than before`
- `BUT the selection/highlight still does not fully cover the right side of the selected text`
- `BUT the interaction still does not feel right`

The user's wording:
- selection still "盖不住" on the right side
- it is still not as smooth as EPUB
- they want the marker/highlight to feel progressive while dragging:
  - "划到那，加深的马克笔跟随加深"
  - i.e. not a sudden post-selection block appearing all at once

### What is likely still wrong

The current codebase has improved the PDF selection path, but it is not yet user-confirmed fixed.

Most likely remaining problems:
- Real Electron `Range.getClientRects()` in the PDF text layer is still narrower than the painted glyphs near line ends, even after extra padding / rect merging.
- The current preview is still not visually convincing enough compared with EPUB:
  - the user wants a more continuous "marker following the drag" feel
  - not just "selection succeeds and then an overlay appears"
- If the right-edge leak is still present after the latest preview/merge changes, the next AI should assume that simple padding tweaks are not enough.

### Suggested next debugging direction

Do this in the real Electron app, not just by tests:

1. Launch `start-reader.cmd`.
2. Reproduce with the user's current PDF selection flow.
3. Inspect whether the visible blue highlight is:
   - coming from the custom overlay divs
   - or from native selection in the PDF text layer
4. Compare:
   - `range.getClientRects()`
   - actual text layer span boxes
   - visible canvas text extents near the right edge
5. If right-edge coverage is still short:
   - stop only tweaking padding
   - consider computing line-level highlight geometry from text-layer spans / per-line text items instead of relying purely on range rects
6. If the feel is still too abrupt:
   - make the drag-time preview visually stronger and more continuous
   - think in terms of a live marker stroke, not just a final overlay

### Do not waste time re-fixing these

These are already improved and no longer the primary blocker:
- PDF import/runtime compatibility
- repeated PDF selection outright failing
- general PDF performance being completely unusable

## Still Open / To Verify Tomorrow

These are the next things to continue from now:

1. Highest priority: real-app PDF selection fidelity
- Re-test inside the Electron app:
  - right-edge coverage of selection/highlight
  - drag-time marker feel vs EPUB
  - whether the latest `selection preview -> confirmed selection` path actually feels better

2. TTS coverage for EPUB/PDF
- User previously reported:
  - TTS works in TXT
  - EPUB/PDF were not verified
- Current architecture:
  - TTS is renderer-side `speechSynthesis`
  - Need explicit real-app confirmation for EPUB/PDF selection/reading behavior

3. EPUB/PDF fidelity beyond current baseline
- Current EPUB behavior:
  - rich text
  - inline images
  - basic preserved markup
- Current PDF behavior:
  - page viewer
  - selection works more reliably than before
  - still visually wrong at the right edge according to the user
- Possible remaining fidelity gaps:
  - complex layout edge cases
  - image-heavy chapters
  - selection behavior in PDF page view

4. Worktree cleanup and commit hygiene
- The worktree is still dirty with many modified files.
- Not all recent fixes have been split into clean commits yet.
- Before merging or finishing the branch:
  - review changed files carefully
  - separate runtime fixes from UI/reader behavior if needed

## Important Local Facts

- User database path:
  - `C:\Users\colezhang\AppData\Roaming\reader-app\reader.db`
- User's active EPUB in DB:
  - `C:\Users\colezhang\Downloads\价值投资从格雷厄姆到巴菲特(第2版) (布鲁斯·C.格林沃尔德) (Z-Library).epub`
- Startup instruction for tomorrow:

```powershell
cd D:\Code\reader-app\.worktrees\feat-v0.1-reading-foundation
start-reader.cmd
```

## Tomorrow's First Step

1. Open this handoff file.
2. Launch via `start-reader.cmd`.
3. Reproduce the PDF selection issue first.
4. Focus on these two remaining user-facing problems before touching anything else:
   - right side of the selected/highlighted text still not fully covered
   - PDF selection feedback still does not feel like a live marker the way EPUB does
5. Continue from the real Electron behavior, not from assumptions or test-only reasoning.
