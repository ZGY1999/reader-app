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

## Still Open / To Verify Tomorrow

These are the next things to continue from:

1. Real-app confirmation from user
- Re-test inside the Electron app:
  - EPUB image display
  - EPUB selection toolbar
  - PDF import/open

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
3. Ask the user to re-check:
   - EPUB image display
   - EPUB selection toolbar
   - PDF import/open
4. Continue from the next real-app failure, not from assumptions.
