import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Bookshelf from './pages/Bookshelf';
import Reader from './pages/Reader';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Bookshelf />} />
        <Route path="/reader" element={<Reader />} />
      </Routes>
    </BrowserRouter>
  );
}
