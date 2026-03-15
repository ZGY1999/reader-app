import { useBookStore } from '../store';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function Bookshelf() {
  const { books, setBooks, setCurrentBook } = useBookStore();
  const navigate = useNavigate();

  useEffect(() => {
    api.getBooks().then(setBooks);
  }, [setBooks]);

  const handleImport = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.epub,.pdf';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const result = await api.importBook(file.path);
        if (result.success) {
          const books = await api.getBooks();
          setBooks(books);
        }
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
