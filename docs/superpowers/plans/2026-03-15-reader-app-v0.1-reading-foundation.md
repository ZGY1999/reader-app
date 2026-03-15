# Reader App v0.1 Reading Foundation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a publicly testable `v0.1` reading foundation where users can import and read TXT, EPUB, and PDF books through one stable app flow with working settings and progress restore.

**Architecture:** Keep the existing Electron main/preload/React renderer shape, but unify all renderer access through one typed preload API and one route structure. Implement one cross-format reading contract in the main process so TXT, EPUB, and PDF all produce the same renderer-facing payload, then make settings and progress operate against that contract.

**Tech Stack:** Electron, React, React Router, TypeScript, sql.js, Vitest, Testing Library, epubjs, pdfjs-dist

---

## Scope Split

The approved spec covers multiple future subsystems (`v0.1` to `v0.4`). This plan intentionally covers only the first executable sub-project:

- `v0.1` reading foundation

It does **not** implement:

- annotation closure
- AI question answering
- TTS playback closure

Those require separate implementation plans after `v0.1` is complete.

## File Structure Lock-In

These are the files that should exist or be modified for `v0.1`.

### Main Process and IPC

- Modify: `src/main/index.ts`
  - Register one stable IPC surface for books, settings, and progress.
- Modify: `src/main/ipc/book.handler.ts`
  - Route imports and content loading by file format.
- Modify: `src/main/ipc/settings.handler.ts`
  - Keep settings contract stable and renderer-friendly.

### Parsers and Data Contracts

- Create: `src/services/book-parser/types.ts`
  - Shared parsing and reading payload types used by all parsers and handlers.
- Modify: `src/services/book-parser/txt.parser.ts`
  - Conform to shared parser output.
- Modify: `src/services/book-parser/epub.parser.ts`
  - Conform to shared parser output.
- Modify: `src/services/book-parser/pdf.parser.ts`
  - Conform to shared parser output.

### Preload and Types

- Modify: `src/preload/index.ts`
  - Expose the only renderer-safe API used by the app.
- Modify: `src/preload/types.d.ts`
  - Make the API typed and remove legacy assumptions.
- Create: `src/renderer/src/api.ts`
  - Small wrapper over `window.electronAPI` for renderer use.

### Renderer Shell and Pages

- Modify: `src/renderer/src/App.tsx`
  - Add stable routes for bookshelf, reader, settings.
- Modify: `src/renderer/src/store.ts`
  - Store current book, reading payload, settings-derived UI state if needed.
- Modify: `src/renderer/src/types.ts`
  - Shared renderer-facing book and reading types.
- Modify: `src/renderer/src/pages/Bookshelf.tsx`
  - Support TXT, EPUB, PDF import and open flow.
- Modify: `src/renderer/src/pages/Reader.tsx`
  - Use unified reading payload, navigation, progress, and settings.
- Modify: `src/renderer/src/pages/Settings.tsx`
  - Stop using direct `window.electron.ipcRenderer`; use typed preload API.
- Modify: `src/renderer/src/components/TextRenderer.tsx`
  - Render unified content safely and support future extensibility.
- Modify: `src/renderer/src/styles/settings.css`
  - Ensure settings apply across reading views.

### Tests

- Modify: `tests\App.test.tsx`
- Modify: `tests\Bookshelf.test.tsx`
- Modify: `tests\Reader.test.tsx`
- Modify: `tests\preload\index.test.ts`
- Modify: `tests\store.test.ts`
- Modify: `tests\txt-parser.test.ts`
- Modify: `tests\pdf-parser.test.ts`
- Create: `tests\epub-parser.test.ts`
- Create: `tests\reading-flow.test.tsx`
- Create: `tests\settings-flow.test.tsx`
- Modify: `src\main\ipc\book.handler.test.ts`
- Modify: `src\main\ipc\settings.handler.test.ts`

### Documentation

- Modify: `README.md`
  - Describe actual `v0.1` scope and setup.
- Modify: `DEVELOPMENT.md`
  - Replace stale “completed” framing with current status if needed.

---

## Chunk 1: Isolated Baseline and Route/API Unification

### Task 1: Create isolated branch/worktree before changes

**Files:**
- Create: none
- Modify: none
- Test: none

- [ ] **Step 1: Create the isolated branch from the current stable point**

Run:

```bash
git checkout -b feat/v0.1-reading-foundation
```

Expected: branch created successfully from current `master`.

- [ ] **Step 2: Optionally create a dedicated worktree**

Run:

```bash
git worktree add ..\reader-app-v0.1 feat/v0.1-reading-foundation
```

Expected: isolated working directory created.

- [ ] **Step 3: Verify clean status inside the implementation workspace**

Run:

```bash
git status --short
```

Expected: no unexpected modifications.

- [ ] **Step 4: Commit the branch/worktree setup note only if project convention needs it**

No code commit required for this step.

### Task 2: Write failing renderer shell tests for the real route structure

**Files:**
- Modify: `tests\App.test.tsx`
- Create: `tests\settings-flow.test.tsx`
- Test: `tests\App.test.tsx`, `tests\settings-flow.test.tsx`

- [ ] **Step 1: Write the failing route tests**

```tsx
it('renders bookshelf at /', () => {
  window.history.pushState({}, '', '/');
  render(<App />);
  expect(screen.getByText('书架')).toBeInTheDocument();
});

it('renders settings at /settings', () => {
  window.history.pushState({}, '', '/settings');
  render(<App />);
  expect(screen.getByText('设置')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the route tests to verify failure**

Run:

```bash
npm test -- tests/App.test.tsx tests/settings-flow.test.tsx
```

Expected: FAIL because `/settings` is not registered and page wiring is incomplete.

- [ ] **Step 3: Implement the minimal route shell**

Update `src/renderer/src/App.tsx` so it includes:

```tsx
<Routes>
  <Route path="/" element={<Bookshelf />} />
  <Route path="/reader" element={<Reader />} />
  <Route path="/settings" element={<Settings />} />
</Routes>
```

- [ ] **Step 4: Run the route tests again**

Run:

```bash
npm test -- tests/App.test.tsx tests/settings-flow.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/App.test.tsx tests/settings-flow.test.tsx src/renderer/src/App.tsx
git commit -m "test: lock app route shell for v0.1"
```

### Task 3: Write failing preload API tests for one typed renderer API

**Files:**
- Modify: `tests\preload\index.test.ts`
- Modify: `src\preload\index.ts`
- Modify: `src\preload\types.d.ts`
- Create: `src\renderer\src\api.ts`
- Test: `tests\preload\index.test.ts`

- [ ] **Step 1: Write the failing preload API test**

```ts
expect(contextBridge.exposeInMainWorld).toHaveBeenCalledWith(
  'electronAPI',
  expect.objectContaining({
    importBook: expect.any(Function),
    getBookContent: expect.any(Function),
    settings: expect.objectContaining({
      save: expect.any(Function),
      getAll: expect.any(Function),
    }),
  })
);
```

- [ ] **Step 2: Run the preload test to verify failure**

Run:

```bash
npm test -- tests/preload/index.test.ts
```

Expected: FAIL if the exposed API shape does not match the locked contract.

- [ ] **Step 3: Implement the unified preload API and renderer wrapper**

Expose only the supported surface:

```ts
contextBridge.exposeInMainWorld('electronAPI', {
  importBook,
  getBooks,
  getBook,
  getBookContent,
  saveProgress,
  getProgress,
  settings: { save, get, getAll },
});
```

And add `src/renderer/src/api.ts`:

```ts
export const api = window.electronAPI;
```

- [ ] **Step 4: Run the preload test again**

Run:

```bash
npm test -- tests/preload/index.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/preload/index.test.ts src/preload/index.ts src/preload/types.d.ts src/renderer/src/api.ts
git commit -m "refactor: unify renderer preload api"
```

---

## Chunk 2: Cross-Format Import and Reading Contract

### Task 4: Introduce a shared parser contract

**Files:**
- Create: `src/services/book-parser/types.ts`
- Modify: `src/services/book-parser/txt.parser.ts`
- Modify: `src/services/book-parser/epub.parser.ts`
- Modify: `src/services/book-parser/pdf.parser.ts`
- Test: `tests/txt-parser.test.ts`, `tests/pdf-parser.test.ts`, `tests/epub-parser.test.ts`

- [ ] **Step 1: Write the failing parser contract tests**

Use the same expectations for all formats:

```ts
expect(book).toMatchObject({
  id: expect.any(String),
  title: expect.any(String),
  content: expect.any(String),
  chapters: expect.any(Array),
});
```

- [ ] **Step 2: Run parser tests to verify failure**

Run:

```bash
npm test -- tests/txt-parser.test.ts tests/pdf-parser.test.ts tests/epub-parser.test.ts
```

Expected: FAIL because EPUB test file does not exist yet or output shapes are inconsistent.

- [ ] **Step 3: Implement the shared contract**

Create:

```ts
export interface ParsedChapter {
  id: string;
  title: string;
  content: string;
}

export interface ParsedBook {
  id: string;
  title: string;
  author?: string;
  format: 'txt' | 'epub' | 'pdf';
  content: string;
  chapters: ParsedChapter[];
}
```

Update all parsers to return `ParsedBook`.

- [ ] **Step 4: Run parser tests again**

Run:

```bash
npm test -- tests/txt-parser.test.ts tests/pdf-parser.test.ts tests/epub-parser.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/book-parser/types.ts src/services/book-parser/txt.parser.ts src/services/book-parser/epub.parser.ts src/services/book-parser/pdf.parser.ts tests/txt-parser.test.ts tests/pdf-parser.test.ts tests/epub-parser.test.ts
git commit -m "refactor: unify parser output contract"
```

### Task 5: Make `BookHandler` import and open all three formats

**Files:**
- Modify: `src/main/ipc/book.handler.ts`
- Modify: `src/main/ipc/book.handler.test.ts`
- Modify: `tests/reading-flow.test.tsx`
- Test: `src/main/ipc/book.handler.test.ts`, `tests/reading-flow.test.tsx`

- [ ] **Step 1: Write failing `BookHandler` tests for format routing**

```ts
it('imports epub books through EpubParser', async () => {
  const result = await handler.importBook('/books/test.epub');
  expect(result.success).toBe(true);
});

it('imports pdf books through PdfParser', async () => {
  const result = await handler.importBook('/books/test.pdf');
  expect(result.success).toBe(true);
});
```

- [ ] **Step 2: Run handler tests to verify failure**

Run:

```bash
npm test -- src/main/ipc/book.handler.test.ts
```

Expected: FAIL because the handler currently only routes TXT.

- [ ] **Step 3: Implement format-based parser routing**

Use file extension dispatch:

```ts
switch (extname(filePath).toLowerCase()) {
  case '.txt': return this.txtParser.parse(filePath);
  case '.epub': return this.epubParser.parse(filePath);
  case '.pdf': return this.pdfParser.parse(filePath);
  default: throw new Error('Unsupported book format');
}
```

- [ ] **Step 4: Run handler tests again**

Run:

```bash
npm test -- src/main/ipc/book.handler.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/ipc/book.handler.ts src/main/ipc/book.handler.test.ts
git commit -m "feat: add multi-format import routing"
```

### Task 6: Define one renderer-facing reading payload

**Files:**
- Modify: `src/renderer/src/types.ts`
- Modify: `src/main/ipc/book.handler.ts`
- Modify: `src/renderer/src/store.ts`
- Test: `tests/reading-flow.test.tsx`, `tests/store.test.ts`

- [ ] **Step 1: Write the failing reading payload tests**

```ts
expect(data).toEqual({
  book: expect.objectContaining({
    id: expect.any(String),
    title: expect.any(String),
    format: expect.any(String),
  }),
  content: expect.any(String),
  chapters: expect.any(Array),
});
```

- [ ] **Step 2: Run the reading payload tests to verify failure**

Run:

```bash
npm test -- tests/reading-flow.test.tsx tests/store.test.ts
```

Expected: FAIL because store/page assumptions are still TXT-centric or too loose.

- [ ] **Step 3: Implement the minimal shared reading payload**

Renderer type:

```ts
export interface ReadingPayload {
  book: Book;
  content: string;
  chapters: Array<{ id: string; title: string; content: string }>;
}
```

Return that shape from `getBookContent`.

- [ ] **Step 4: Run the payload tests again**

Run:

```bash
npm test -- tests/reading-flow.test.tsx tests/store.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/types.ts src/main/ipc/book.handler.ts src/renderer/src/store.ts tests/reading-flow.test.tsx tests/store.test.ts
git commit -m "refactor: add unified reading payload"
```

---

## Chunk 3: Reader, Settings, and Progress Closure

### Task 7: Make the bookshelf import/open flow pass through the typed API

**Files:**
- Modify: `src/renderer/src/pages/Bookshelf.tsx`
- Modify: `tests/Bookshelf.test.tsx`
- Test: `tests/Bookshelf.test.tsx`

- [ ] **Step 1: Write the failing bookshelf flow tests**

```tsx
it('accepts txt, epub, and pdf imports', () => {
  render(<Bookshelf />);
  fireEvent.click(screen.getByText('导入书籍'));
  expect(mockInput.accept).toBe('.txt,.epub,.pdf');
});
```

- [ ] **Step 2: Run the bookshelf tests to verify failure**

Run:

```bash
npm test -- tests/Bookshelf.test.tsx
```

Expected: FAIL because the import accept list is TXT-only or open flow is incomplete.

- [ ] **Step 3: Implement the minimal bookshelf flow**

Use:

```tsx
input.accept = '.txt,.epub,.pdf';
const result = await api.importBook(file.path);
if (result.success) setBooks(await api.getBooks());
```

- [ ] **Step 4: Run the bookshelf tests again**

Run:

```bash
npm test -- tests/Bookshelf.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/pages/Bookshelf.tsx tests/Bookshelf.test.tsx
git commit -m "feat: enable multi-format bookshelf import flow"
```

### Task 8: Make the reader page consume the unified reading payload

**Files:**
- Modify: `src/renderer/src/pages/Reader.tsx`
- Modify: `src/renderer/src/components/TextRenderer.tsx`
- Modify: `tests/Reader.test.tsx`
- Test: `tests/Reader.test.tsx`, `tests/reading-flow.test.tsx`

- [ ] **Step 1: Write the failing reader page tests**

```tsx
it('loads book content through the preload api', async () => {
  render(<Reader />);
  expect(await screen.findByText('章节一内容')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run reader tests to verify failure**

Run:

```bash
npm test -- tests/Reader.test.tsx tests/reading-flow.test.tsx
```

Expected: FAIL because the page still uses ad hoc state and incomplete payload assumptions.

- [ ] **Step 3: Implement the minimal reader closure**

Use:

```tsx
const payload = await api.getBookContent(currentBook.id);
setReading(payload);
setContent(payload.content);
setChapters(payload.chapters);
```

Render content through `TextRenderer` rather than dumping raw text in the page body.

- [ ] **Step 4: Run reader tests again**

Run:

```bash
npm test -- tests/Reader.test.tsx tests/reading-flow.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/pages/Reader.tsx src/renderer/src/components/TextRenderer.tsx tests/Reader.test.tsx tests/reading-flow.test.tsx
git commit -m "feat: wire reader page to unified reading payload"
```

### Task 9: Make settings apply through the typed preload API and visible CSS state

**Files:**
- Modify: `src/renderer/src/pages/Settings.tsx`
- Modify: `src/renderer/src/styles/settings.css`
- Modify: `tests/settings-flow.test.tsx`
- Modify: `src/main/ipc/settings.handler.test.ts`
- Test: `tests/settings-flow.test.tsx`, `src/main/ipc/settings.handler.test.ts`

- [ ] **Step 1: Write the failing settings flow tests**

```tsx
it('loads settings through electronAPI.settings.getAll', async () => {
  render(<Settings />);
  expect(mockSettingsGetAll).toHaveBeenCalled();
});

it('applies theme changes to documentElement', async () => {
  render(<Settings />);
  fireEvent.click(screen.getByLabelText('夜间'));
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
});
```

- [ ] **Step 2: Run the settings tests to verify failure**

Run:

```bash
npm test -- tests/settings-flow.test.tsx src/main/ipc/settings.handler.test.ts
```

Expected: FAIL because the page still uses `window.electron.ipcRenderer`.

- [ ] **Step 3: Implement the minimal settings bridge**

Use:

```tsx
const data = await api.settings.getAll();
await api.settings.save(key, value);
```

Ensure shared CSS variables apply to the reader layout.

- [ ] **Step 4: Run the settings tests again**

Run:

```bash
npm test -- tests/settings-flow.test.tsx src/main/ipc/settings.handler.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/pages/Settings.tsx src/renderer/src/styles/settings.css tests/settings-flow.test.tsx src/main/ipc/settings.handler.test.ts
git commit -m "refactor: connect settings page to stable renderer api"
```

### Task 10: Restore reading progress on the reader page

**Files:**
- Modify: `src/renderer/src/pages/Reader.tsx`
- Modify: `src/main/ipc/book.handler.test.ts`
- Create: `tests/progress-flow.test.tsx`
- Test: `tests/progress-flow.test.tsx`, `src/main/ipc/book.handler.test.ts`

- [ ] **Step 1: Write the failing progress restore tests**

```tsx
it('requests saved progress when opening a book', async () => {
  render(<Reader />);
  expect(mockGetProgress).toHaveBeenCalledWith('book-1');
});
```

- [ ] **Step 2: Run the progress tests to verify failure**

Run:

```bash
npm test -- tests/progress-flow.test.tsx src/main/ipc/book.handler.test.ts
```

Expected: FAIL because the page does not restore saved progress in a testable way.

- [ ] **Step 3: Implement minimal progress restore**

Reader page should:

```tsx
const progress = await api.getProgress(currentBook.id);
if (progress?.offset) {
  requestAnimationFrame(() => contentRef.current?.scrollTo({ top: progress.offset }));
}
```

And save progress on scroll with a small debounce.

- [ ] **Step 4: Run the progress tests again**

Run:

```bash
npm test -- tests/progress-flow.test.tsx src/main/ipc/book.handler.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/pages/Reader.tsx src/main/ipc/book.handler.test.ts tests/progress-flow.test.tsx
git commit -m "feat: restore reader progress on open"
```

---

## Chunk 4: Error Handling, Verification, and Docs

### Task 11: Make unsupported format and load failures user-safe

**Files:**
- Modify: `src/main/ipc/book.handler.ts`
- Modify: `src/renderer/src/pages/Bookshelf.tsx`
- Create: `tests/import-error-flow.test.tsx`
- Test: `tests/import-error-flow.test.tsx`, `src/main/ipc/book.handler.test.ts`

- [ ] **Step 1: Write the failing error-flow tests**

```tsx
it('shows a basic failure message when import fails', async () => {
  mockImportBook.mockResolvedValue({ success: false, error: 'Unsupported book format' });
  render(<Bookshelf />);
  expect(await screen.findByText('Unsupported book format')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the error-flow tests to verify failure**

Run:

```bash
npm test -- tests/import-error-flow.test.tsx src/main/ipc/book.handler.test.ts
```

Expected: FAIL because the UI has no visible user-safe error surface.

- [ ] **Step 3: Implement minimal error handling**

Bookshelf page should keep a simple local error message:

```tsx
if (!result.success) {
  setError(result.error ?? '导入失败');
  return;
}
```

- [ ] **Step 4: Run the error-flow tests again**

Run:

```bash
npm test -- tests/import-error-flow.test.tsx src/main/ipc/book.handler.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/ipc/book.handler.ts src/renderer/src/pages/Bookshelf.tsx tests/import-error-flow.test.tsx src/main/ipc/book.handler.test.ts
git commit -m "feat: add user-safe import failure handling"
```

### Task 12: Run the full v0.1 verification suite

**Files:**
- Modify: none
- Test: all touched tests

- [ ] **Step 1: Run focused unit and UI tests**

Run:

```bash
npm test -- tests/App.test.tsx tests/Bookshelf.test.tsx tests/Reader.test.tsx tests/settings-flow.test.tsx tests/reading-flow.test.tsx tests/progress-flow.test.tsx tests/import-error-flow.test.tsx tests/txt-parser.test.ts tests/pdf-parser.test.ts tests/epub-parser.test.ts src/main/ipc/book.handler.test.ts src/main/ipc/settings.handler.test.ts tests/preload/index.test.ts tests/store.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run the broader regression suite**

Run:

```bash
npm test
```

Expected: PASS, or if unrelated legacy failures remain, document them explicitly before claiming success.

- [ ] **Step 3: Capture remaining risks**

Record:

- any parser edge cases not covered
- any flaky tests
- any behavior intentionally deferred to `v0.2`

- [ ] **Step 4: Commit verification fixes if needed**

```bash
git add .
git commit -m "test: verify v0.1 reading foundation"
```

Only commit if this step required actual code changes.

### Task 13: Update user-facing documentation to match reality

**Files:**
- Modify: `README.md`
- Modify: `DEVELOPMENT.md`
- Test: none

- [ ] **Step 1: Update the README scope**

Document:

- `v0.1` supports TXT / EPUB / PDF reading
- AI and TTS are not part of the `v0.1` acceptance scope
- setup and run instructions that match the actual route and preload structure

- [ ] **Step 2: Update the development status file**

Replace stale “complete” framing with:

- current version goal
- current status
- known deferred features

- [ ] **Step 3: Review docs for factual consistency**

Check that documentation does not claim:

- complete public-ready AI
- complete TTS
- complete annotation closure

- [ ] **Step 4: Commit**

```bash
git add README.md DEVELOPMENT.md
git commit -m "docs: align project docs with v0.1 scope"
```

---

## Suggested Execution Order

1. Chunk 1
2. Chunk 2
3. Chunk 3
4. Chunk 4

Do not skip ahead to annotation, AI, or TTS while `v0.1` reading foundation still has open `P0` or `P1` items.

## Expected v0.1 End State

At the end of this plan:

- the app has one stable renderer API
- the app has one stable route shell
- TXT / EPUB / PDF import and open all work through one flow
- reader settings visibly apply
- reading progress restores
- import/load failures surface cleanly
- docs describe the real state of the product

This creates the base required for the next plan: `v0.2` annotation closure.

---

Plan complete and saved to `docs/superpowers/plans/2026-03-15-reader-app-v0.1-reading-foundation.md`. Ready to execute?
