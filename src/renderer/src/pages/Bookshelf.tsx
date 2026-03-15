import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useBookStore } from '../store';

export default function Bookshelf() {
  const { books, setBooks, setCurrentBook } = useBookStore();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    void loadBooks();
  }, [setBooks]);

  const loadBooks = async () => {
    try {
      setBooks(await api.getBooks());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load bookshelf');
    }
  };

  const handleImport = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.epub,.pdf';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      setError('');

      try {
        const result = await api.importBook(file.path);
        if (!result.success) {
          setError(result.error || 'Failed to import book');
          return;
        }

        await loadBooks();
      } catch (importError) {
        setError(importError instanceof Error ? importError.message : 'Failed to import book');
      }
    };
    input.click();
  };

  const handleOpen = (book: (typeof books)[number]) => {
    setCurrentBook(book);
    navigate('/reader');
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>书架</h1>
      <button onClick={handleImport}>导入书籍</button>
      {error && <p role="alert">{error}</p>}
      {books.length === 0 ? (
        <p>暂无书籍</p>
      ) : (
        <div>
          {books.map((book) => (
            <div key={book.id} onClick={() => handleOpen(book)} style={{ cursor: 'pointer', padding: '10px', border: '1px solid #ccc', margin: '10px 0' }}>
              <h3>{book.title}</h3>
              {book.author && <p>作者：{book.author}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
